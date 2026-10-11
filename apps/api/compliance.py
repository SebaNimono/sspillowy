"""Compliance continuo: evalúa los controles comunes con los datos de la plataforma y calcula la
preparación de cada marco (ISO 27001, SOC 2, NIST, PCI DSS, CIS, OWASP, Ley 21.663…).
"""

from __future__ import annotations

import re
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from compliance_catalog import CONTROLS, DOMAINS, FRAMEWORK_BY_ID, FRAMEWORKS
from database import db_ping
from email_service import mailer_configured
from models import (
    AuditEvent,
    ComplianceControlState,
    ComplianceFrameworkSetting,
    ComplianceSnapshot,
    Finding,
    GateBypassRequest,
    Repository,
    Runbook,
    RunbookExecution,
    SbomComponent,
    Scan,
    SecretIncident,
    SecurityGate,
)
from velocity import compute_velocity, fingerprint
from workspaces import WorkspaceCtx, admin_recipients, require_ws, require_ws_write

router = APIRouter(prefix="/api/v1/compliance", tags=["Compliance"])

OPEN = ("OPEN", "IN_REVIEW")
ATTESTATION_DAYS = 365
STATUS_RANK = {"GAP": 0, "PENDING": 1, "PARTIAL": 2, "COMPLIANT": 3, "NOT_APPLICABLE": 4}
ENGINE_NAME = {"semgrep": "Semgrep", "trivy": "Trivy", "gitleaks": "Gitleaks", "owasp_zap": "OWASP ZAP"}
RESPONSE_TRIGGERS = ("SECRET_DETECTED", "GATE_BLOCKED", "NEW_FINDING")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    dt = _aware(dt)
    return dt.isoformat() if dt else None


def _fmt(dt: datetime | None) -> str:
    dt = _aware(dt)
    return dt.strftime("%d/%m/%Y") if dt else "—"


def _n(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def current_period(now: datetime | None = None) -> str:
    now = now or _now()
    return f"{now.year}-Q{(now.month - 1) // 3 + 1}"


# --------------------------------------------------------------------------- datos


class _Ctx:
    """Todo lo que necesitan las pruebas, consultado una sola vez."""

    def __init__(self, db, now: datetime, workspace_id: str):
        self.now = now
        recent = now - timedelta(days=90)
        ws = workspace_id
        self.repos = (
            db.query(Repository).filter(Repository.is_active.is_(True), Repository.workspace_id == ws).all()
        )
        ids = [r.id for r in self.repos]
        self.repo_ids = ids
        scans = (
            db.query(Scan)
            .filter(Scan.status == "COMPLETED", Scan.created_at >= recent, Scan.repository_id.in_(ids or ["__none__"]))
            .all()
        )
        self.scans = scans
        self.engine_last: dict[str, datetime] = {}
        for s in scans:
            for e in (s.engines_ok or "").split(","):
                e = e.strip()
                if e:
                    t = _aware(s.completed_at) or _aware(s.created_at)
                    if e not in self.engine_last or t > self.engine_last[e]:
                        self.engine_last[e] = t
        if scans:
            by_scan = {s.id: s for s in scans}
            rows = db.query(Finding.engine, Finding.scan_id).filter(Finding.scan_id.in_(list(by_scan))).distinct().all()
            for engine, scan_id in rows:
                e = (engine or "").lower()
                s = by_scan[scan_id]
                t = _aware(s.completed_at) or _aware(s.created_at)
                if e not in self.engine_last or t > self.engine_last[e]:
                    self.engine_last[e] = t

        self.open = db.query(Finding).filter(Finding.status.in_(OPEN), Finding.repository_id.in_(ids or ["__none__"])).all()
        self.decided = {
            (f.repository_id, fingerprint(f.engine, f.title, f.file_path))
            for f in db.query(Finding)
            .filter(Finding.status.in_(["FALSE_POSITIVE", "ACCEPTED_RISK"]), Finding.repository_id.in_(ids or ["__none__"]))
            .all()
        }
        self.ai_reviewed = (
            db.query(Finding)
            .filter(Finding.ai_feedback.isnot(None), Finding.repository_id.in_(ids or ["__none__"]))
            .count()
        )

        sbom_rows = db.query(SbomComponent.repository_id).filter(SbomComponent.repository_id.in_(ids or ["__none__"])).all()
        self.sbom_counts: dict[str, int] = defaultdict(int)
        for (rid,) in sbom_rows:
            self.sbom_counts[rid] += 1

        self.secrets_open = (
            db.query(SecretIncident)
            .filter(SecretIncident.status.in_(["OPEN", "IN_PROGRESS"]), SecretIncident.repository_id.in_(ids or ["__none__"]))
            .all()
        )
        self.secrets_resolved = (
            db.query(SecretIncident)
            .filter(
                SecretIncident.status == "RESOLVED",
                SecretIncident.resolved_at >= recent,
                SecretIncident.repository_id.in_(ids or ["__none__"]),
            )
            .count()
        )
        self.gate = db.get(SecurityGate, ws)
        self.bypasses = (
            db.query(GateBypassRequest)
            .filter(GateBypassRequest.created_at >= recent, GateBypassRequest.workspace_id == ws)
            .all()
        )
        audit_q = db.query(AuditEvent).filter(AuditEvent.workspace_id == ws)
        self.audit_count = audit_q.filter(AuditEvent.created_at >= recent).count()
        last_event = audit_q.order_by(AuditEvent.created_at.desc()).first()
        self.audit_last = _aware(last_event.created_at) if last_event else None
        self.runbooks = db.query(Runbook).filter(Runbook.enabled.is_(True), Runbook.workspace_id == ws).all()
        self.executions = (
            db.query(RunbookExecution)
            .filter(
                RunbookExecution.created_at >= recent,
                RunbookExecution.status != "SIMULATED",
                RunbookExecution.workspace_id == ws,
            )
            .all()
        )
        self.velocity = compute_velocity(db, range_days=90, repo_ids=ids or ["__none__"], now=now)
        self.mail_ready = mailer_configured()
        self.recipients = admin_recipients(db, ws)


# --------------------------------------------------------------------------- pruebas automáticas


def _result(status: str, reason: str, evidence: list[tuple[str, str]]) -> dict:
    return {"status": status, "reason": reason, "evidence": [{"label": k, "value": v} for k, v in evidence]}


def _engine_check(c: _Ctx, engine: str, items: list[Finding], what: str) -> dict:
    severe = sum(1 for f in items if (f.severity or "").upper() in ("CRITICAL", "HIGH"))
    last = c.engine_last.get(engine)
    evidence = [
        ("Último análisis con " + ENGINE_NAME[engine], _fmt(last) if last else "sin análisis en 90 días"),
        (f"{what} abiertos", str(len(items))),
        ("Críticos o altos", str(severe)),
    ]
    if severe:
        return _result("GAP", f"{_n(severe, 'hallazgo crítico o alto abierto', 'hallazgos críticos o altos abiertos')}.", evidence)
    if items:
        return _result("PARTIAL", f"{_n(len(items), 'hallazgo medio o bajo abierto', 'hallazgos medios o bajos abiertos')}.", evidence)
    if not last:
        return _result("PARTIAL", f"Sin análisis de {ENGINE_NAME[engine]} en los últimos 90 días: falta evidencia.", evidence)
    return _result("COMPLIANT", "Sin hallazgos abiertos en los análisis recientes.", evidence)


def _by_engine(c: _Ctx, engine: str) -> list[Finding]:
    return [f for f in c.open if (f.engine or "").lower() == engine]


def _check_sbom(c: _Ctx) -> dict:
    total = len(c.repos)
    covered = sum(1 for r in c.repos if c.sbom_counts.get(r.id))
    components = sum(c.sbom_counts.values())
    evidence = [("Repositorios con SBOM", f"{covered} de {total}"), ("Componentes inventariados", str(components))]
    if not total:
        return _result("PARTIAL", "No hay repositorios registrados.", evidence)
    if covered == total:
        return _result("COMPLIANT", "Todos los repositorios tienen inventario de librerías.", evidence)
    if covered:
        return _result("PARTIAL", f"{_n(total - covered, 'repositorio no tiene', 'repositorios no tienen')} inventario.", evidence)
    return _result("GAP", "Ningún repositorio tiene inventario de librerías. Analiza con Trivy.", evidence)


def _check_secrets(c: _Ctx) -> dict:
    week = c.now - timedelta(days=7)
    orphan = [s for s in c.secrets_open if not s.owner_email]
    stale = [s for s in c.secrets_open if _aware(s.first_seen_at) and _aware(s.first_seen_at) < week]
    last = c.engine_last.get("gitleaks")
    evidence = [
        ("Último análisis con Gitleaks", _fmt(last) if last else "sin análisis en 90 días"),
        ("Secretos en atención", str(len(c.secrets_open))),
        ("Sin responsable", str(len(orphan))),
        ("Resueltos en 90 días", str(c.secrets_resolved)),
    ]
    if orphan:
        return _result("GAP", f"{_n(len(orphan), 'secreto expuesto sin responsable', 'secretos expuestos sin responsable')}.", evidence)
    if stale:
        return _result("GAP", f"{_n(len(stale), 'secreto lleva', 'secretos llevan')} más de 7 días sin resolverse.", evidence)
    if c.secrets_open:
        return _result("PARTIAL", f"{_n(len(c.secrets_open), 'secreto en proceso', 'secretos en proceso')} con responsable.", evidence)
    if not last:
        return _result("PARTIAL", "Sin análisis de secretos en los últimos 90 días: falta evidencia.", evidence)
    return _result("COMPLIANT", "No hay secretos expuestos pendientes.", evidence)


def _check_dast(c: _Ctx) -> dict:
    targets = [r for r in c.repos if r.dast_url]
    if not targets:
        return _result(
            "PARTIAL",
            "Ninguna aplicación tiene URL configurada para probarla. Si no publicas aplicaciones web, márcalo como «No aplica».",
            [("Aplicaciones con URL", "0")],
        )
    res = _engine_check(c, "owasp_zap", _by_engine(c, "owasp_zap"), "Hallazgos")
    res["evidence"].insert(0, {"label": "Aplicaciones con URL", "value": str(len(targets))})
    return res


def _check_coverage(c: _Ctx) -> dict:
    month = c.now - timedelta(days=30)
    scanned = {s.repository_id for s in c.scans if _aware(s.created_at) >= month}
    total = len(c.repos)
    stale = [r.name for r in c.repos if r.id not in scanned]
    evidence = [
        ("Analizados en 30 días", f"{total - len(stale)} de {total}"),
        ("Análisis en 90 días", str(len(c.scans))),
    ]
    if stale:
        evidence.append(("Sin analizar", ", ".join(stale[:5]) + ("…" if len(stale) > 5 else "")))
    if not total:
        return _result("PARTIAL", "No hay repositorios registrados.", evidence)
    if not stale:
        return _result("COMPLIANT", f"Los {total} repositorios se analizaron en los últimos 30 días.", evidence)
    if len(stale) < total:
        return _result("PARTIAL", f"{_n(len(stale), 'repositorio sin analizar', 'repositorios sin analizar')} en 30 días.", evidence)
    return _result("GAP", "Ningún repositorio se analizó en los últimos 30 días.", evidence)


def _check_gate(c: _Ctx) -> dict:
    g = c.gate
    enabled = g is None or bool(g.enabled)
    max_crit = g.max_critical_allowed if g else 0
    max_high = g.max_high_allowed if g else 0
    secrets = g.block_on_secrets if g else True
    month = c.now - timedelta(days=30)
    evaluated = sum(1 for s in c.scans if _aware(s.created_at) >= month and s.gate_status in ("PASSED", "BLOCKED", "BYPASSED"))
    evidence = [
        ("Gate", "activo" if enabled else "desactivado"),
        ("Críticos permitidos", str(max_crit)),
        ("Altos permitidos", str(max_high)),
        ("Bloquea secretos", "sí" if secrets else "no"),
        ("Cambios evaluados en 30 días", str(evaluated)),
    ]
    if not enabled:
        return _result("GAP", "El Security Gate está desactivado: los cambios llegan a producción sin control.", evidence)
    if max_crit > 0 or not secrets:
        lax = []
        if max_crit > 0:
            lax.append(f"permite {max_crit} críticos")
        if not secrets:
            lax.append("no bloquea secretos")
        return _result("PARTIAL", "La política es permisiva: " + " y ".join(lax) + ".", evidence)
    return _result("COMPLIANT", "El gate bloquea críticos y secretos antes de desplegar.", evidence)


def _check_exceptions(c: _Ctx) -> dict:
    g = c.gate
    approval = g is None or bool(g.require_ciso_approval_for_bypass)
    late = [b for b in c.bypasses if b.status == "PENDING" and _aware(b.created_at) < c.now - timedelta(days=2)]
    approved = sum(1 for b in c.bypasses if b.status in ("APPROVED", "EXPIRED"))
    rejected = sum(1 for b in c.bypasses if b.status == "REJECTED")
    evidence = [
        ("Solicitudes en 90 días", str(len(c.bypasses))),
        ("Aprobadas", str(approved)),
        ("Rechazadas", str(rejected)),
        ("Requieren aprobación", "sí" if approval else "no"),
    ]
    if not approval:
        return _result("PARTIAL", "Las excepciones no requieren aprobación de un responsable.", evidence)
    if late:
        return _result("PARTIAL", f"{_n(len(late), 'solicitud lleva', 'solicitudes llevan')} más de 2 días sin respuesta.", evidence)
    return _result("COMPLIANT", "Las excepciones se aprueban con motivo y vencen solas.", evidence)


def _check_sla(c: _Ctx) -> dict:
    k = c.velocity["kpis"]
    crit = next((s for s in c.velocity["by_severity"] if s["severity"] == "CRITICAL"), {"overdue": 0})
    evidence = [
        ("Corregidos en plazo (90 días)", f"{k['sla_met_pct']}%" if k["sla_met_pct"] is not None else "sin correcciones"),
        ("Pendientes fuera de plazo", str(k["overdue"])),
        ("Tiempo medio de corrección", f"{k['mttr_days']} días" if k["mttr_days"] is not None else "—"),
    ]
    if crit["overdue"]:
        return _result("GAP", f"{_n(crit['overdue'], 'crítico superó', 'críticos superaron')} su plazo de 7 días.", evidence)
    if k["overdue"]:
        return _result("PARTIAL", f"{_n(k['overdue'], 'hallazgo fuera de plazo', 'hallazgos fuera de plazo')}.", evidence)
    if k["sla_met_pct"] is not None and k["sla_met_pct"] < 80:
        return _result("PARTIAL", f"Solo el {k['sla_met_pct']}% se corrigió dentro del plazo (meta: 80%).", evidence)
    return _result("COMPLIANT", "No hay hallazgos fuera de plazo.", evidence)


def _check_audit(c: _Ctx) -> dict:
    evidence = [("Acciones registradas en 90 días", str(c.audit_count)), ("Última acción", _fmt(c.audit_last))]
    if c.audit_count:
        return _result("COMPLIANT", "Las acciones quedan registradas con autor y fecha.", evidence)
    return _result("PARTIAL", "No hay acciones registradas en los últimos 90 días.", evidence)


def _check_human(c: _Ctx) -> dict:
    evidence = [
        ("Decisiones humanas registradas", str(len(c.decided))),
        ("Sugerencias de Pillow revisadas", str(c.ai_reviewed)),
        ("Cierre automático", "deshabilitado por diseño"),
    ]
    return _result("COMPLIANT", "Cada falso positivo o riesgo aceptado lo decide una persona y queda registrado.", evidence)


def _check_response(c: _Ctx) -> dict:
    relevant = [r for r in c.runbooks if r.trigger in RESPONSE_TRIGGERS]
    failed = [e for e in c.executions if e.status == "FAILED"]
    evidence = [
        ("Automatizaciones activas", str(len(c.runbooks))),
        ("De respuesta a incidentes", str(len(relevant))),
        ("Ejecuciones en 90 días", str(len(c.executions))),
        ("Ejecuciones fallidas", str(len(failed))),
    ]
    if not relevant:
        return _result("PARTIAL", "No hay automatizaciones activas para secretos, críticos o gate bloqueado.", evidence)
    if failed:
        return _result("PARTIAL", f"{_n(len(failed), 'ejecución falló', 'ejecuciones fallaron')} en los últimos 90 días.", evidence)
    return _result("COMPLIANT", "Hay respuestas automáticas activas ante incidentes.", evidence)


def _check_alerts(c: _Ctx) -> dict:
    evidence = [
        ("Envío de correo", "configurado" if c.mail_ready else "no configurado"),
        ("Responsables que reciben alertas", str(len(c.recipients))),
    ]
    if c.mail_ready and c.recipients:
        return _result("COMPLIANT", "Los eventos graves se avisan por correo a los responsables.", evidence)
    if not c.recipients:
        return _result("PARTIAL", "No hay una lista de responsables que reciba las alertas.", evidence)
    return _result("PARTIAL", "El envío de correo no está configurado: las alertas solo se ven en la plataforma.", evidence)


AUTO_CHECKS = {
    "SSP-01": _check_sbom,
    "SSP-02": lambda c: _engine_check(c, "trivy", _by_engine(c, "trivy"), "Hallazgos en dependencias"),
    "SSP-03": lambda c: _engine_check(c, "semgrep", _by_engine(c, "semgrep"), "Hallazgos en el código"),
    "SSP-04": _check_secrets,
    "SSP-05": _check_dast,
    "SSP-06": _check_coverage,
    "SSP-07": _check_gate,
    "SSP-08": _check_exceptions,
    "SSP-09": _check_sla,
    "SSP-10": _check_audit,
    "SSP-11": _check_human,
    "SSP-12": _check_response,
    "SSP-13": _check_alerts,
}


def _check_manual(state: Optional[ComplianceControlState], now: datetime) -> dict:
    if state and state.attested_at:
        at = _aware(state.attested_at)
        until = at + timedelta(days=ATTESTATION_DAYS)
        evidence = [("Verificado por", state.attested_by or "—"), ("Fecha", _fmt(at)), ("Vigente hasta", _fmt(until))]
        if until >= now:
            return _result("COMPLIANT", f"Verificado el {_fmt(at)}; vigente hasta el {_fmt(until)}.", evidence)
        return _result("PARTIAL", f"La verificación venció el {_fmt(until)}. Revisa la evidencia y vuelve a verificar.", evidence)
    return _result("PENDING", "Falta aportar evidencia y verificarlo.", [])


# --------------------------------------------------------------------------- evaluación


def _worst(statuses: list[str]) -> str:
    applicable = [s for s in statuses if s != "NOT_APPLICABLE"]
    if not applicable:
        return "NOT_APPLICABLE"
    return min(applicable, key=lambda s: STATUS_RANK[s])


def _owasp_status(c: _Ctx, code: str) -> dict:
    items = [f for f in c.open if (f.owasp_category or "").upper().startswith(code)]
    if code == "A06":
        items += [f for f in _by_engine(c, "trivy") if not f.owasp_category]
    severe = sum(1 for f in items if (f.severity or "").upper() in ("CRITICAL", "HIGH"))
    if severe:
        return {"status": "GAP", "reason": f"{_n(severe, 'hallazgo crítico o alto abierto', 'hallazgos críticos o altos abiertos')} de esta categoría.", "findings": len(items)}
    if items:
        return {"status": "PARTIAL", "reason": f"{_n(len(items), 'hallazgo medio o bajo abierto', 'hallazgos medios o bajos abiertos')} de esta categoría.", "findings": len(items)}
    if any(e in c.engine_last for e in ("semgrep", "trivy", "owasp_zap")):
        return {"status": "COMPLIANT", "reason": "Sin hallazgos abiertos de esta categoría en los análisis recientes.", "findings": 0}
    return {"status": "PARTIAL", "reason": "Sin análisis recientes que lo demuestren.", "findings": 0}


def _enabled_map(db, workspace_id: str) -> dict[str, bool]:
    rows = {
        r.framework_id: bool(r.enabled)
        for r in db.query(ComplianceFrameworkSetting).filter(ComplianceFrameworkSetting.workspace_id == workspace_id)
    }
    return {f["id"]: rows.get(f["id"], f["default"]) for f in FRAMEWORKS}


def evaluate(db, workspace_id: str, now: datetime | None = None) -> dict:
    now = now or _now()
    ctx = _Ctx(db, now, workspace_id)
    states = {
        s.control_id: s
        for s in db.query(ComplianceControlState).filter(ComplianceControlState.workspace_id == workspace_id)
    }
    enabled = _enabled_map(db, workspace_id)

    mappings: dict[str, list[dict]] = defaultdict(list)
    for fw in FRAMEWORKS:
        per_control: dict[str, list[str]] = defaultdict(list)
        for req in fw["requirements"]:
            for cid in req["controls"]:
                per_control[cid].append(req["id"])
        for cid, reqs in per_control.items():
            mappings[cid].append({"framework_id": fw["id"], "short": fw["short"], "enabled": enabled[fw["id"]], "requirements": reqs})

    controls: dict[str, dict] = {}
    for cid, meta in CONTROLS.items():
        st = states.get(cid)
        res = AUTO_CHECKS[cid](ctx) if meta["type"] == "auto" else _check_manual(st, now)
        if st and st.not_applicable:
            res = {**res, "status": "NOT_APPLICABLE", "reason": f"No aplica: {st.na_reason or 'sin justificación'}"}
        attested_at = _aware(st.attested_at) if st and st.attested_at else None
        controls[cid] = {
            "id": cid,
            "name": meta["name"],
            "domain": meta["domain"],
            "type": meta["type"],
            "description": meta["description"],
            "guidance": meta.get("guidance"),
            **res,
            "owner_email": st.owner_email if st else None,
            "note": st.note if st else None,
            "evidence_url": st.evidence_url if st else None,
            "attested_by": st.attested_by if st else None,
            "attested_at": _iso(attested_at),
            "expires_at": _iso(attested_at + timedelta(days=ATTESTATION_DAYS)) if attested_at else None,
            "not_applicable": bool(st and st.not_applicable),
            "na_reason": st.na_reason if st else None,
            "updated_by": st.updated_by if st else None,
            "updated_at": _iso(st.updated_at) if st else None,
            "mappings": mappings.get(cid, []),
        }

    frameworks = []
    for fw in FRAMEWORKS:
        reqs = []
        for req in fw["requirements"]:
            if req["owasp"]:
                ow = _owasp_status(ctx, req["owasp"])
                status, reason, findings = ow["status"], ow["reason"], ow["findings"]
                if all(controls[c]["status"] == "NOT_APPLICABLE" for c in req["controls"]):
                    status, reason = "NOT_APPLICABLE", "Sus controles están marcados como «No aplica»."
            else:
                status = _worst([controls[c]["status"] for c in req["controls"]])
                worst = [controls[c] for c in req["controls"] if controls[c]["status"] == status]
                reason = f"{worst[0]['name']}: {worst[0]['reason']}" if worst and status != "COMPLIANT" else "Todos sus controles cumplen."
                if status == "NOT_APPLICABLE":
                    reason = "Sus controles están marcados como «No aplica»."
                findings = None
            reqs.append({**{k: req[k] for k in ("id", "title", "group", "controls")}, "status": status, "reason": reason, "findings": findings})
        counts = {s: sum(1 for r in reqs if r["status"] == s) for s in STATUS_RANK}
        applicable = len(reqs) - counts["NOT_APPLICABLE"]
        score = round(100 * (counts["COMPLIANT"] + 0.5 * counts["PARTIAL"]) / applicable) if applicable else 100
        frameworks.append(
            {
                "id": fw["id"],
                "name": fw["name"],
                "short": fw["short"],
                "category": fw["category"],
                "description": fw["description"],
                "enabled": enabled[fw["id"]],
                "score": score,
                "counts": counts,
                "total": len(reqs),
                "requirements": reqs,
            }
        )

    ctl = list(controls.values())
    return {
        "generated_at": now.isoformat(),
        "period": current_period(now),
        "domains": DOMAINS,
        "frameworks": frameworks,
        "controls": ctl,
        "summary": {
            "controls": len(ctl),
            "passing": sum(1 for c in ctl if c["status"] == "COMPLIANT"),
            "failing": sum(1 for c in ctl if c["status"] == "GAP"),
            "partial": sum(1 for c in ctl if c["status"] == "PARTIAL"),
            "pending": sum(1 for c in ctl if c["status"] == "PENDING"),
            "not_applicable": sum(1 for c in ctl if c["status"] == "NOT_APPLICABLE"),
        },
    }


def _snapshot(db, data: dict, workspace_id: str) -> dict[str, list[dict]]:
    """Guarda la preparación de hoy y devuelve la tendencia de 90 días por marco."""
    today = _now().date()
    snaps = db.query(ComplianceSnapshot).filter(ComplianceSnapshot.workspace_id == workspace_id)
    existing = {s.framework_id: s for s in snaps.filter(ComplianceSnapshot.day == today).all()}
    for fw in data["frameworks"]:
        row = existing.get(fw["id"])
        if row is None:
            row = ComplianceSnapshot(id=str(uuid.uuid4()), workspace_id=workspace_id, day=today, framework_id=fw["id"])
            db.add(row)
        row.score = fw["score"]
        row.passing = fw["counts"]["COMPLIANT"]
        row.total = fw["total"] - fw["counts"]["NOT_APPLICABLE"]
    db.commit()
    since = today - timedelta(days=90)
    trend: dict[str, list[dict]] = defaultdict(list)
    for s in snaps.filter(ComplianceSnapshot.day >= since).order_by(ComplianceSnapshot.day.asc()).all():
        trend[s.framework_id].append({"day": s.day.isoformat(), "score": s.score})
    return trend


def iso_controls(db, workspace_id: str, now: datetime | None = None) -> list[dict]:
    """Compatibilidad con /compliance/iso27001: requisitos de ISO 27001 con estados Cumple/Parcial/Brecha."""
    data = evaluate(db, workspace_id, now)
    iso = next(f for f in data["frameworks"] if f["id"] == "iso27001")
    legacy = {"PENDING": "PARTIAL", "NOT_APPLICABLE": "COMPLIANT"}
    return [
        {
            "code": r["id"],
            "title": r["title"],
            "status": legacy.get(r["status"], r["status"]),
            "related_engine": None,
            "open_findings": r["findings"] or 0,
            "reason": r["reason"],
        }
        for r in iso["requirements"]
    ]


# --------------------------------------------------------------------------- API


def _require_db():
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible")


def _audit(db, actor: str, action: str, target: str, detail: str = "") -> None:
    db.add(AuditEvent(id=str(uuid.uuid4()), action=action, target=target[:200], detail=detail[:1000], actor_email=actor, created_at=_now()))


def _overview(db, workspace_id: str) -> dict:
    data = evaluate(db, workspace_id)
    trend = _snapshot(db, data, workspace_id)
    for fw in data["frameworks"]:
        fw["trend"] = trend.get(fw["id"], [])
    return data


@router.get("")
def compliance_overview(ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    db = ws.session()
    try:
        return _overview(db, ws.id)
    finally:
        db.close()


class FrameworkPatch(BaseModel):
    enabled: bool


@router.put("/frameworks/{framework_id}")
def set_framework(framework_id: str, body: FrameworkPatch, ws: WorkspaceCtx = Depends(require_ws_write)):
    _require_db()
    fw = FRAMEWORK_BY_ID.get(framework_id)
    if not fw:
        raise HTTPException(status_code=404, detail="Marco no encontrado")
    db = ws.session()
    try:
        row = db.get(ComplianceFrameworkSetting, (ws.id, framework_id))
        if row is None:
            row = ComplianceFrameworkSetting(workspace_id=ws.id, framework_id=framework_id)
            db.add(row)
        row.enabled = body.enabled
        row.updated_by = ws.actor
        row.updated_at = _now()
        _audit(db, ws.actor, "COMPLIANCE_FRAMEWORK_ENABLED" if body.enabled else "COMPLIANCE_FRAMEWORK_DISABLED", fw["short"])
        db.commit()
        return _overview(db, ws.id)
    finally:
        db.close()


class ControlPatch(BaseModel):
    owner_email: Optional[str] = Field(default=None, max_length=255)
    note: Optional[str] = Field(default=None, max_length=2000)
    evidence_url: Optional[str] = Field(default=None, max_length=500)
    attest: Optional[bool] = None
    not_applicable: Optional[bool] = None
    na_reason: Optional[str] = Field(default=None, max_length=500)


@router.put("/controls/{control_id}")
def update_control(control_id: str, body: ControlPatch, ws: WorkspaceCtx = Depends(require_ws_write)):
    _require_db()
    meta = CONTROLS.get(control_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Control no encontrado")
    fields = body.model_dump(exclude_unset=True)
    if "owner_email" in fields and fields["owner_email"]:
        if not _EMAIL_RE.match(fields["owner_email"].strip()):
            raise HTTPException(status_code=400, detail="El correo del responsable no es válido.")
    if "evidence_url" in fields and fields["evidence_url"]:
        if not re.match(r"^https?://", fields["evidence_url"].strip(), re.I):
            raise HTTPException(status_code=400, detail="El enlace de evidencia debe empezar por http:// o https://.")
    if fields.get("not_applicable") and len((fields.get("na_reason") or "").strip()) < 5:
        raise HTTPException(status_code=400, detail="Explica por qué no aplica (al menos 5 caracteres).")

    actor = ws.actor
    db = ws.session()
    try:
        st = db.get(ComplianceControlState, (ws.id, control_id))
        if st is None:
            st = ComplianceControlState(workspace_id=ws.id, control_id=control_id)
            db.add(st)
        for key in ("owner_email", "note", "evidence_url"):
            if key in fields:
                setattr(st, key, (fields[key] or "").strip() or None)
        if "not_applicable" in fields:
            st.not_applicable = bool(fields["not_applicable"])
            st.na_reason = (fields.get("na_reason") or "").strip() or None if st.not_applicable else None
            _audit(db, actor, "COMPLIANCE_NOT_APPLICABLE" if st.not_applicable else "COMPLIANCE_APPLICABLE", control_id, st.na_reason or "")
        if fields.get("attest") is True:
            if meta["type"] != "manual":
                raise HTTPException(status_code=400, detail="Los controles automáticos se verifican solos con cada análisis.")
            if not (st.evidence_url or st.note):
                raise HTTPException(status_code=400, detail="Aporta un enlace o una nota de evidencia antes de verificar.")
            st.attested_by = actor
            st.attested_at = _now()
            _audit(db, actor, "COMPLIANCE_ATTESTED", control_id, st.evidence_url or st.note or "")
        elif fields.get("attest") is False:
            st.attested_by = None
            st.attested_at = None
            _audit(db, actor, "COMPLIANCE_ATTESTATION_REVOKED", control_id)
        if any(k in fields for k in ("owner_email", "note", "evidence_url")):
            _audit(db, actor, "COMPLIANCE_CONTROL_UPDATED", control_id, ", ".join(k for k in fields if k in ("owner_email", "note", "evidence_url")))
        st.updated_by = actor
        st.updated_at = _now()
        db.commit()
        return _overview(db, ws.id)
    finally:
        db.close()


@router.get("/frameworks/{framework_id}/evidence")
def framework_evidence(framework_id: str, ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    if framework_id not in FRAMEWORK_BY_ID:
        raise HTTPException(status_code=404, detail="Marco no encontrado")
    db = ws.session()
    try:
        data = evaluate(db, ws.id)
        fw = next(f for f in data["frameworks"] if f["id"] == framework_id)
        controls = {c["id"]: c for c in data["controls"]}
        used = {cid for r in fw["requirements"] for cid in r["controls"]}
        events = (
            db.query(AuditEvent)
            .filter(AuditEvent.workspace_id == ws.id, AuditEvent.created_at >= _now() - timedelta(days=90))
            .order_by(AuditEvent.created_at.desc())
            .limit(500)
            .all()
        )
        _audit(db, ws.actor, "COMPLIANCE_EVIDENCE_EXPORTED", fw["short"])
        db.commit()
        return {
            "platform": "SSPILLOWY",
            "framework": {k: fw[k] for k in ("id", "name", "short", "category")},
            "generated_at": data["generated_at"],
            "period": data["period"],
            "readiness_score": fw["score"],
            "status_counts": fw["counts"],
            "disclaimer": "Evaluación automática orientativa para preparar auditorías. No reemplaza la opinión de un auditor.",
            "human_in_the_loop": True,
            "requirements": fw["requirements"],
            "controls": [controls[c] for c in sorted(used)],
            "audit_trail": [
                {"at": _iso(e.created_at), "actor": e.actor_email or "system", "action": e.action, "target": e.target, "detail": e.detail}
                for e in events
            ],
        }
    finally:
        db.close()
