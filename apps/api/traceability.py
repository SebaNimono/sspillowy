"""Trazabilidad: historia completa de cada hallazgo y bitácora de auditoría consultable.

Un hallazgo se sigue por (repositorio, fingerprint) porque cada re-escaneo crea filas nuevas.
Su historia se reconstruye con los análisis donde apareció (y su commit), el análisis en que dejó
de aparecer, las decisiones humanas registradas, el análisis de Pillow, las excepciones al gate,
la respuesta a secretos y las automatizaciones que disparó.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_

from database import SessionLocal, db_ping
from models import AuditEvent, Finding, GateBypassRequest, Repository, RunbookExecution, Scan, SecretIncident
from velocity import DECIDED, SLA_DAYS, fingerprint
from workspaces import WorkspaceCtx, require_ws

router = APIRouter(prefix="/api/v1/traceability", tags=["Trazabilidad"])

RUNBOOK_PREFIX = "runbook:"
ENGINE_LABEL = {"semgrep": "Semgrep", "gitleaks": "Gitleaks", "trivy": "Trivy", "owasp_zap": "OWASP ZAP"}
STATUS_LABEL = {
    "OPEN": "Abierto",
    "IN_REVIEW": "En revisión",
    "FIXED": "Corregido",
    "FALSE_POSITIVE": "Falso positivo",
    "ACCEPTED_RISK": "Riesgo aceptado",
}
VERDICT_LABEL = {
    "LIKELY_REAL": "probablemente real",
    "NEEDS_REVIEW": "requiere revisión",
    "LIKELY_FALSE_POSITIVE": "probable falso positivo",
}

ACTION_LABEL = {
    "FINDING_OPEN": "Reabrió un hallazgo",
    "FINDING_IN_REVIEW": "Puso un hallazgo en revisión",
    "FINDING_FIXED": "Marcó un hallazgo como corregido",
    "FINDING_FALSE_POSITIVE": "Marcó un falso positivo",
    "FINDING_ACCEPTED_RISK": "Aceptó un riesgo",
    "FINDINGS_CLEARED": "Vació la matriz de hallazgos",
    "FINDINGS_SUPERSEDED": "Reemplazó hallazgos por un análisis nuevo",
    "SCAN_TRIGGERED": "Lanzó un análisis",
    "SCAN_COMPLETED": "Terminó un análisis",
    "SCAN_FAILED": "Falló un análisis",
    "SCAN_STALE_EXPIRED": "Cerró un análisis atascado",
    "SCAN_CLONE_FALLBACK": "No pudo clonar el repositorio",
    "ENGINE_FAILED": "Falló un motor de análisis",
    "SBOM_FAILED": "Falló el inventario de dependencias",
    "TRIAGE_CARRY_FAILED": "No pudo conservar el triaje anterior",
    "SECRET_SYNC_FAILED": "No pudo sincronizar secretos",
    "GATE_PASSED": "El gate permitió el despliegue",
    "GATE_BLOCK": "El gate bloqueó el despliegue",
    "GATE_UPDATED": "Cambió la política del gate",
    "GATE_BYPASS_REQUESTED": "Pidió una excepción al gate",
    "GATE_BYPASS_APPROVED": "Aprobó una excepción al gate",
    "GATE_BYPASS_REJECTED": "Rechazó una excepción al gate",
    "SECRET_ROTATED": "Rotó una credencial filtrada",
    "SECRET_REVOKED": "Revocó una credencial filtrada",
    "SECRET_HISTORY_CLEANED": "Limpió un secreto del historial",
    "SECRET_VERIFIED": "Verificó la respuesta a un secreto",
    "SECRET_RESOLVED": "Cerró un incidente de secreto",
    "SECRET_FALSE_POSITIVE": "Descartó un secreto como falso positivo",
    "SECRET_REOPENED": "Reabrió un incidente de secreto",
    "SECRET_REAPPEARED": "Un secreto volvió a aparecer",
    "SECRET_ASSIGNED": "Asignó un incidente de secreto",
    "SECRET_STEP_UNDONE": "Desmarcó un paso de un secreto",
    "FIX_INTEL_TRIAGE": "Pidió a Pillow analizar hallazgos",
    "FIX_INTEL_ACCEPTED": "Aceptó la sugerencia de Pillow",
    "FIX_INTEL_DISMISSED": "Descartó la sugerencia de Pillow",
    "RUNBOOK_EXECUTED": "Ejecutó una automatización",
    "RUNBOOK_CREATED": "Creó una automatización",
    "RUNBOOK_UPDATED": "Editó una automatización",
    "RUNBOOK_ENABLED": "Activó una automatización",
    "RUNBOOK_DISABLED": "Pausó una automatización",
    "RUNBOOK_DELETED": "Eliminó una automatización",
    "COMPLIANCE_FRAMEWORK_ENABLED": "Activó un marco de cumplimiento",
    "COMPLIANCE_FRAMEWORK_DISABLED": "Desactivó un marco de cumplimiento",
    "COMPLIANCE_ATTESTED": "Verificó un control",
    "COMPLIANCE_ATTESTATION_REVOKED": "Retiró la verificación de un control",
    "COMPLIANCE_NOT_APPLICABLE": "Marcó un control como no aplicable",
    "COMPLIANCE_APPLICABLE": "Volvió a aplicar un control",
    "COMPLIANCE_CONTROL_UPDATED": "Actualizó un control",
    "COMPLIANCE_EVIDENCE_EXPORTED": "Exportó evidencia de cumplimiento",
    "TRACE_EVIDENCE_EXPORTED": "Exportó la historia de un hallazgo",
    "REPO_REGISTERED": "Registró un repositorio",
    "REPO_DELETED": "Eliminó un repositorio",
    "DASHBOARD_CREATED": "Creó un dashboard",
    "DASHBOARD_DELETED": "Eliminó un dashboard",
    "WEBHOOK_REPO_UNKNOWN": "Recibió un webhook de un repositorio no registrado",
    "SECURITY_ALERT_SENT": "Envió una alerta por correo",
    "SECURITY_ALERT_POSTED": "Publicó una alerta en Slack o Teams",
    "INTEGRATION_CONNECTED": "Conectó una integración",
    "INTEGRATION_REMOVED": "Desconectó una integración",
    "WORKSPACE_RENAMED": "Renombró el espacio",
    "WORKSPACE_MEMBER_INVITED": "Invitó a una persona al espacio",
    "WORKSPACE_MEMBER_ROLE": "Cambió el rol de una persona",
    "WORKSPACE_MEMBER_REMOVED": "Quitó a una persona del espacio",
    "WORKSPACE_MEMBER_LEFT": "Salió del espacio",
}

CATEGORIES = [
    ("findings", "Hallazgos", ("FINDING_", "FINDINGS_")),
    ("scans", "Análisis", ("SCAN_", "ENGINE_", "SBOM_", "TRIAGE_CARRY", "SECRET_SYNC")),
    ("gate", "Gate y excepciones", ("GATE_",)),
    ("secrets", "Secretos", ("SECRET_ROTATED", "SECRET_REVOKED", "SECRET_HISTORY", "SECRET_VERIFIED",
                             "SECRET_RESOLVED", "SECRET_FALSE", "SECRET_REOPENED", "SECRET_REAPPEARED",
                             "SECRET_ASSIGNED", "SECRET_STEP")),
    ("pillow", "Pillow", ("FIX_INTEL_",)),
    ("automations", "Automatizaciones", ("RUNBOOK_",)),
    ("compliance", "Cumplimiento", ("COMPLIANCE_", "TRACE_")),
    ("config", "Configuración", ("REPO_", "DASHBOARD_", "WEBHOOK_", "WORKSPACE_", "INTEGRATION_")),
    ("alerts", "Alertas", ("SECURITY_ALERT",)),
]
CATEGORY_LABEL = {cid: label for cid, label, _ in CATEGORIES}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    dt = _aware(dt)
    return dt.isoformat() if dt else None


def _require_db() -> None:
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible.")


def issue_key(repo_id: str, fp: str) -> str:
    return hashlib.sha1(f"{repo_id}|{fp}".encode("utf-8")).hexdigest()[:20]


def category_of(action: str) -> str:
    for cid, _label, prefixes in CATEGORIES:
        if any(action.startswith(p) for p in prefixes):
            return cid
    return "other"


def actor_label(raw: str | None) -> str:
    a = (raw or "").strip()
    if not a or a in ("web_hub", "manual_web"):
        return "Usuario del hub"
    if a.startswith("github_push:"):
        return f"{a.split(':', 1)[1]} (push en GitHub)"
    if a.startswith("github_pr:"):
        return f"{a.split(':', 1)[1]} (pull request en GitHub)"
    if a.startswith(RUNBOOK_PREFIX):
        return f"Automatización «{a[len(RUNBOOK_PREFIX):]}»"
    return {
        "scan-worker": "Plataforma",
        "security-gate": "Security Gate",
        "secret-management": "Plataforma",
        "github_webhook": "Webhook de GitHub",
        "webhook": "Webhook",
        "ci": "Pipeline CI",
        "mailer": "Correo",
        "auditor": "Usuario del hub",
        "pillow": "Pillow",
    }.get(a, a)


def is_person(raw: str | None) -> bool:
    a = (raw or "").strip()
    return "@" in a or a.startswith("github_push:") or a.startswith("github_pr:")


def _clean_path(path: str | None) -> str | None:
    if not path:
        return None
    s = str(path).replace("\\", "/").strip()
    for marker in ("/repo/", "/vuln_sample/"):
        if marker in s:
            return s.split(marker, 1)[1]
    return s.lstrip("./") or None


def _repo_web(url: str | None) -> tuple[str | None, str | None]:
    """(url base navegable, proveedor) para enlazar commits y archivos."""
    u = (url or "").strip()
    if not u:
        return None, None
    if u.startswith("git@"):
        u = "https://" + u[4:].replace(":", "/", 1)
    if not u.startswith("http"):
        u = f"https://{u}"
    u = u.rstrip("/")
    if u.endswith(".git"):
        u = u[:-4]
    low = u.lower()
    if "github.com/" in low:
        return u, "github"
    if "gitlab" in low:
        return u, "gitlab"
    if "bitbucket.org/" in low:
        return u, "bitbucket"
    return None, None


def _commit_out(scan: Scan | None, repo: Repository | None) -> dict | None:
    sha = getattr(scan, "commit_sha", None) if scan else None
    if not sha:
        return None
    base, provider = _repo_web(repo.url if repo else None)
    url = None
    if base and provider == "github":
        url = f"{base}/commit/{sha}"
    elif base and provider == "gitlab":
        url = f"{base}/-/commit/{sha}"
    elif base and provider == "bitbucket":
        url = f"{base}/commits/{sha}"
    return {
        "sha": sha,
        "short": sha[:7],
        "message": scan.commit_message,
        "author": scan.commit_author,
        "url": url,
    }


def _file_url(repo: Repository | None, sha: str | None, path: str | None, line: int | None) -> str | None:
    base, provider = _repo_web(repo.url if repo else None)
    if not base or not path:
        return None
    ref = sha or (repo.branch if repo else None) or "main"
    anchor = f"#L{line}" if line else ""
    if provider == "github":
        return f"{base}/blob/{ref}/{path}{anchor}"
    if provider == "gitlab":
        return f"{base}/-/blob/{ref}/{path}{anchor}"
    return None


# ---------------------------------------------------------------------------
# Reconstrucción de hallazgos
# ---------------------------------------------------------------------------


@dataclass
class _Row:
    id: str
    scan_id: str
    severity: str
    status: str
    created_at: datetime | None
    line: int | None


@dataclass
class Issue:
    key: str
    repo_id: str
    fp: str
    engine: str
    title: str
    path: str | None
    cwe: str | None = None
    rows: list[_Row] = field(default_factory=list)
    # Calculado por _lifecycle
    periods: list[dict] = field(default_factory=list)
    detections: list[str] = field(default_factory=list)
    status: str = "OPEN"
    first_seen: datetime | None = None
    last_seen: datetime | None = None
    closed_at: datetime | None = None
    severity: str = "INFO"
    latest: _Row | None = None

    @property
    def row_ids(self) -> set[str]:
        return {r.id for r in self.rows}


def _load(db, repo_ids: list[str], *, key: str | None = None) -> tuple[dict[str, Issue], dict[str, list[Scan]], dict[str, set]]:
    q = db.query(
        Finding.id,
        Finding.repository_id,
        Finding.scan_id,
        Finding.engine,
        Finding.title,
        Finding.file_path,
        Finding.severity,
        Finding.status,
        Finding.created_at,
        Finding.line_number,
        Finding.cwe,
    ).filter(Finding.repository_id.in_(repo_ids or ["__none__"]))

    issues: dict[str, Issue] = {}
    engines_seen: dict[str, set] = defaultdict(set)
    for fid, repo_id, scan_id, engine, title, path, sev, status, created, line, cwe in q.all():
        fp = fingerprint(engine, title, path)
        k = issue_key(repo_id, fp)
        engines_seen[scan_id].add((engine or "").lower())
        if key and k != key:
            continue
        it = issues.get(k)
        if it is None:
            it = issues[k] = Issue(
                key=k, repo_id=repo_id, fp=fp, engine=(engine or "").lower(), title=title or "", path=_clean_path(path)
            )
        if cwe and not it.cwe:
            it.cwe = cwe
        it.rows.append(_Row(fid, scan_id, (sev or "INFO").upper(), status or "OPEN", _aware(created), line))

    scan_q = db.query(Scan).filter(Scan.status == "COMPLETED")
    wanted = sorted({it.repo_id for it in issues.values()})
    if wanted:
        scan_q = scan_q.filter(Scan.repository_id.in_(wanted))
    scans_by_repo: dict[str, list[Scan]] = defaultdict(list)
    for s in scan_q.order_by(Scan.created_at.asc()).all():
        scans_by_repo[s.repository_id].append(s)

    for it in issues.values():
        _lifecycle(it, scans_by_repo.get(it.repo_id, []), engines_seen)
    return issues, scans_by_repo, engines_seen


def _scan_time(s: Scan) -> datetime:
    return _aware(s.completed_at) or _aware(s.created_at) or _now()


def _lifecycle(it: Issue, scans: list[Scan], engines_seen: dict[str, set]) -> None:
    it.rows.sort(key=lambda r: r.created_at or datetime.min.replace(tzinfo=timezone.utc))
    it.latest = it.rows[-1] if it.rows else None
    it.severity = it.latest.severity if it.latest else "INFO"
    by_scan = {r.scan_id: r for r in it.rows}
    superseded_in = {r.scan_id for r in it.rows if r.status == "SUPERSEDED"}

    current: dict | None = None
    prev_superseded = False
    for s in scans:
        when = _scan_time(s)
        if s.id in by_scan:
            it.detections.append(s.id)
            if current is None:
                current = {"opened": when, "opened_scan": s.id, "closed": None, "closed_scan": None,
                           "regression": bool(it.periods)}
            prev_superseded = s.id in superseded_in
            continue
        if current is None:
            continue
        if s.engines_ok is not None:
            ran = it.engine in s.engines_ok.split(",")
        else:
            ran = it.engine in engines_seen.get(s.id, set()) or prev_superseded
        if ran:
            current["closed"] = when
            current["closed_scan"] = s.id
            it.periods.append(current)
            current = None
            prev_superseded = False
    if current is not None:
        it.periods.append(current)

    if not it.periods and it.rows:
        # Filas sin análisis completado (p. ej. datos de ejemplo): un periodo desde la primera fila
        it.periods.append({"opened": it.rows[0].created_at, "opened_scan": it.rows[0].scan_id, "closed": None,
                           "closed_scan": None, "regression": False})
    it.first_seen = it.periods[0]["opened"] if it.periods else None
    seen_times = [_scan_time(s) for s in scans if s.id in by_scan] or [r.created_at for r in it.rows if r.created_at]
    it.last_seen = max(seen_times) if seen_times else None

    last = it.periods[-1] if it.periods else None
    latest_status = it.latest.status if it.latest else "OPEN"
    if latest_status in DECIDED:
        it.status = latest_status
    elif last and last["closed"]:
        it.status = "FIXED"
        it.closed_at = last["closed"]
    elif latest_status == "FIXED":
        it.status = "FIXED"
        it.closed_at = it.last_seen
    elif latest_status == "IN_REVIEW":
        it.status = "IN_REVIEW"
    else:
        it.status = "OPEN"


def _sla(it: Issue, now: datetime) -> dict:
    days = SLA_DAYS.get(it.severity, 365)
    opened = it.periods[-1]["opened"] if it.periods else it.first_seen
    if not opened:
        return {"days": days, "due_at": None, "met": None, "overdue": False}
    due = opened + timedelta(days=days)
    if it.status in DECIDED:
        return {"days": days, "due_at": _iso(due), "met": None, "overdue": False}
    if it.status == "FIXED" and it.closed_at:
        return {"days": days, "due_at": _iso(due), "met": it.closed_at <= due, "overdue": False}
    return {"days": days, "due_at": _iso(due), "met": None if now <= due else False, "overdue": now > due}


def _issue_out(it: Issue, repo_names: dict[str, str], now: datetime) -> dict:
    last_activity = max(filter(None, [it.last_seen, it.closed_at, it.first_seen]), default=None)
    return {
        "key": it.key,
        "title": it.title,
        "engine": it.engine,
        "engine_label": ENGINE_LABEL.get(it.engine, it.engine),
        "severity": it.severity,
        "file_path": it.path,
        "line": it.latest.line if it.latest else None,
        "cwe": it.cwe,
        "repository_id": it.repo_id,
        "repository_name": repo_names.get(it.repo_id, it.repo_id),
        "status": it.status,
        "status_label": STATUS_LABEL.get(it.status, it.status),
        "first_seen": _iso(it.first_seen),
        "last_seen": _iso(it.last_seen),
        "closed_at": _iso(it.closed_at),
        "last_activity": _iso(last_activity),
        "detections": len(it.detections) or len(it.rows),
        "regressions": sum(1 for p in it.periods if p["regression"]),
        "finding_id": it.latest.id if it.latest else None,
        "sla": _sla(it, now),
    }


def _parse_day(raw: str | None, end: bool = False) -> datetime | None:
    if not raw:
        return None
    try:
        d = date.fromisoformat(raw[:10])
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha inválida. Usa el formato AAAA-MM-DD.")
    return datetime.combine(d, time.max if end else time.min, tzinfo=timezone.utc)


def _person_matches(db, issues: list[Issue], scans_by_id: dict[str, Scan], person: str) -> set[str]:
    p = person.strip().lower()
    hits: set[str] = set()
    row_to_key = {r.id: it.key for it in issues for r in it.rows}
    for it in issues:
        for sid in it.detections:
            s = scans_by_id.get(sid)
            if s and (p in (s.triggered_by or "").lower() or p in (s.commit_author or "").lower()):
                hits.add(it.key)
                break
    q = db.query(AuditEvent.finding_id, AuditEvent.target).filter(AuditEvent.actor_email.ilike(f"%{p}%"))
    q = q.filter(or_(AuditEvent.action.like("FINDING_%"), AuditEvent.action.like("FIX_INTEL_%")))
    for fid, target in q.all():
        k = row_to_key.get(fid or "") or row_to_key.get(target or "")
        if k:
            hits.add(k)
    return hits


@router.get("/findings")
def list_issues(
    q: Optional[str] = None,
    repository_id: Optional[str] = None,
    status: str = Query(default="all", pattern="^(all|open|fixed|decided)$"),
    severity: Optional[str] = None,
    engine: Optional[str] = None,
    person: Optional[str] = None,
    date_from: Optional[str] = Query(default=None, alias="from"),
    date_to: Optional[str] = Query(default=None, alias="to"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    ws: WorkspaceCtx = Depends(require_ws),
):
    _require_db()
    if repository_id:
        ws.require_repo(repository_id)
    db = SessionLocal()
    try:
        now = _now()
        repos = {
            r.id: r.name
            for r in db.query(Repository.id, Repository.name).filter(Repository.workspace_id == ws.id).all()
        }
        issues, scans_by_repo, _ = _load(db, [repository_id] if repository_id else ws.scope_ids)
        items = list(issues.values())

        start, end = _parse_day(date_from), _parse_day(date_to, end=True)
        if start or end:
            def active(it: Issue) -> bool:
                opened = it.first_seen or now
                closed = it.closed_at or now
                return (end is None or opened <= end) and (start is None or closed >= start)
            items = [it for it in items if active(it)]
        if severity:
            items = [it for it in items if it.severity == severity.upper()]
        if engine:
            items = [it for it in items if it.engine == engine.lower()]
        if q and q.strip():
            needle = q.strip().lower()
            items = [
                it for it in items
                if needle in it.title.lower()
                or needle in (it.path or "").lower()
                or needle in (it.cwe or "").lower()
                or needle in repos.get(it.repo_id, "").lower()
                or needle in it.key
                or any(needle == r.id for r in it.rows)
            ]
        if person and person.strip():
            scans_by_id = {s.id: s for lst in scans_by_repo.values() for s in lst}
            hits = _person_matches(db, items, scans_by_id, person)
            items = [it for it in items if it.key in hits]

        counts = Counter()
        overdue = 0
        for it in items:
            bucket = "open" if it.status in ("OPEN", "IN_REVIEW") else "fixed" if it.status == "FIXED" else "decided"
            counts[bucket] += 1
            if _sla(it, now)["overdue"]:
                overdue += 1
        if status != "all":
            items = [
                it for it in items
                if (status == "open" and it.status in ("OPEN", "IN_REVIEW"))
                or (status == "fixed" and it.status == "FIXED")
                or (status == "decided" and it.status in DECIDED)
            ]

        out = [_issue_out(it, repos, now) for it in items]
        out.sort(key=lambda x: x["last_activity"] or "", reverse=True)
        return {
            "total": len(out),
            "counts": {
                "open": counts["open"],
                "fixed": counts["fixed"],
                "decided": counts["decided"],
                "all": sum(counts.values()),
                "overdue": overdue,
            },
            "items": out[offset: offset + limit],
            "repositories": [{"id": rid, "name": name} for rid, name in sorted(repos.items(), key=lambda x: x[1].lower())],
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Historia de un hallazgo
# ---------------------------------------------------------------------------


def _resolve(db, ref: str, ws: WorkspaceCtx) -> Issue:
    issues, _, _ = _load(db, ws.scope_ids, key=ref)
    if ref in issues:
        return issues[ref]
    f = db.get(Finding, ref)
    if f and ws.has_repo(f.repository_id):
        k = issue_key(f.repository_id, fingerprint(f.engine, f.title, f.file_path))
        issues, _, _ = _load(db, [f.repository_id], key=k)
        if k in issues:
            return issues[k]
    raise HTTPException(status_code=404, detail="No encontramos ese hallazgo.")


def _event(at: datetime | None, kind: str, title: str, *, detail: str | None = None, actor: str | None = None,
           tone: str = "neutral", **extra) -> dict:
    return {
        "at": _iso(at),
        "type": kind,
        "title": title,
        "detail": detail,
        "actor": actor,
        "actor_label": actor_label(actor) if actor else None,
        "person": is_person(actor),
        "tone": tone,
        **extra,
    }


def _timeline(db, it: Issue, now: datetime) -> tuple[list[dict], dict]:
    repo = db.get(Repository, it.repo_id)
    repo_name = repo.name if repo else it.repo_id
    ws_id = (repo.workspace_id if repo else None) or "__none__"
    scan_ids = {r.scan_id for r in it.rows} | {p["closed_scan"] for p in it.periods if p["closed_scan"]}
    scans = {s.id: s for s in db.query(Scan).filter(Scan.id.in_(list(scan_ids))).all()} if scan_ids else {}
    rows_by_scan = {r.scan_id: r for r in it.rows}
    engine_label = ENGINE_LABEL.get(it.engine, it.engine)
    events: list[dict] = []
    people: Counter = Counter()

    def scan_ref(s: Scan | None) -> dict | None:
        if not s:
            return None
        return {
            "id": s.id,
            "branch": s.branch,
            "triggered_by": actor_label(s.triggered_by),
            "gate": s.gate_status,
            "commit": _commit_out(s, repo),
        }

    # Detecciones, regresiones, cambios de severidad y cierre
    last_sev: str | None = None
    blocked = False
    open_windows: list[tuple[datetime, datetime]] = []
    for p in it.periods:
        open_windows.append((p["opened"], p["closed"] or now))
    detection_scans = it.detections or [r.scan_id for r in it.rows]
    period_starts = {p["opened_scan"]: p for p in it.periods}
    for sid in detection_scans:
        s = scans.get(sid)
        row = rows_by_scan.get(sid)
        at = _scan_time(s) if s else (row.created_at if row else None)
        gate_relevant = it.engine == "gitleaks" or (row.severity if row else it.severity) in ("CRITICAL", "HIGH")
        if s and s.gate_status == "BLOCKED" and gate_relevant:
            blocked = True
        trig = s.triggered_by if s else None
        if trig and is_person(trig):
            people[actor_label(trig)] += 1
        sev = row.severity if row else it.severity
        if sid in period_starts:
            p = period_starts[sid]
            commit = _commit_out(s, repo)
            author = (commit or {}).get("author")
            if author and author.lower() not in (trig or "").lower():
                people[f"{author} (autor del commit)"] += 1
            if p["regression"]:
                events.append(_event(at, "REAPPEARED", "Volvió a aparecer",
                                     detail=f"{engine_label} lo detectó de nuevo después de haberse corregido.",
                                     actor=trig, tone="bad", scan=scan_ref(s), severity=sev))
            else:
                events.append(_event(at, "DETECTED", "Detectado por primera vez",
                                     detail=f"{engine_label} lo encontró en {it.path or 'el repositorio'}"
                                            + (f" (línea {row.line})" if row and row.line else "") + ".",
                                     actor=trig, tone="bad", scan=scan_ref(s), severity=sev))
        else:
            events.append(_event(at, "SEEN", "Sigue presente", detail=f"Detectado otra vez por {engine_label}.",
                                 actor=trig, scan=scan_ref(s), severity=sev))
        if last_sev and sev != last_sev:
            events.append(_event(at, "SEVERITY_CHANGED", "Cambió la severidad", detail=f"{last_sev} → {sev}",
                                 tone="warn"))
        last_sev = sev
    for p in it.periods:
        if p["closed"]:
            s = scans.get(p["closed_scan"])
            commit = _commit_out(s, repo)
            events.append(_event(p["closed"], "FIXED", "Corregido",
                                 detail=f"Ya no aparece en el análisis de {engine_label}"
                                        + (f" del commit {commit['short']}" if commit else "") + ".",
                                 actor=s.triggered_by if s else None, tone="good", scan=scan_ref(s)))

    # Decisiones humanas y de Pillow registradas en la bitácora
    ids = list(it.row_ids)
    audit_q = db.query(AuditEvent).filter(
        or_(AuditEvent.finding_id.in_(ids), AuditEvent.target.in_(ids))
    )
    audit_rows = audit_q.all()
    legacy_pillow = (
        db.query(AuditEvent)
        .filter(AuditEvent.action.in_(["FIX_INTEL_ACCEPTED", "FIX_INTEL_DISMISSED"]))
        .filter(AuditEvent.finding_id.is_(None), AuditEvent.target == repo_name, AuditEvent.workspace_id == ws_id)
        .all()
    )
    audit_rows += [e for e in legacy_pillow if (e.detail or "").endswith(f"· {it.title}")]
    seen_ids: set[str] = set()
    for e in sorted(audit_rows, key=lambda e: _aware(e.created_at) or now):
        if e.id in seen_ids:
            continue
        seen_ids.add(e.id)
        if e.actor_email and is_person(e.actor_email):
            people[actor_label(e.actor_email)] += 1
        if e.action.startswith("FINDING_"):
            new = e.action[len("FINDING_"):]
            tone = "good" if new in ("FIXED",) else "warn" if new in DECIDED else "neutral"
            events.append(_event(e.created_at, "STATUS", f"Estado: {STATUS_LABEL.get(new, new)}",
                                 detail=e.detail, actor=e.actor_email, tone=tone))
        elif e.action in ("FIX_INTEL_ACCEPTED", "FIX_INTEL_DISMISSED"):
            accepted = e.action == "FIX_INTEL_ACCEPTED"
            events.append(_event(e.created_at, "PILLOW_DECISION",
                                 "Aceptó la sugerencia de Pillow" if accepted else "Descartó la sugerencia de Pillow",
                                 detail=e.detail, actor=e.actor_email, tone="neutral"))

    # Análisis de Pillow (se arrastra entre re-escaneos: contarlo una vez por fecha)
    triaged: set[str] = set()
    f_rows = db.query(Finding).filter(Finding.id.in_(ids), Finding.ai_triaged_at.isnot(None)).all()
    for f in sorted(f_rows, key=lambda f: _aware(f.ai_triaged_at)):
        stamp = _iso(f.ai_triaged_at)
        if stamp in triaged:
            continue
        triaged.add(stamp)
        verdict = VERDICT_LABEL.get(f.ai_verdict or "", f.ai_verdict or "sin veredicto")
        conf = f" ({round((f.ai_confidence or 0) * 100)}% de confianza)" if f.ai_confidence is not None else ""
        events.append(_event(f.ai_triaged_at, "PILLOW", "Pillow lo analizó",
                             detail=f"Veredicto: {verdict}{conf}." + (f" {f.ai_summary}" if f.ai_summary else ""),
                             actor="pillow", tone="neutral"))

    # Excepciones al gate pedidas mientras estaba abierto y bloqueando
    if blocked and open_windows:
        bq = db.query(GateBypassRequest).filter(
            or_(GateBypassRequest.repository_id == it.repo_id, GateBypassRequest.repository_id.is_(None)),
            GateBypassRequest.workspace_id == ws_id,
        )
        for b in bq.all():
            created = _aware(b.created_at)
            if not created or not any(a <= created <= z for a, z in open_windows):
                continue
            if is_person(b.requested_by):
                people[actor_label(b.requested_by)] += 1
            events.append(_event(created, "BYPASS_REQUESTED", "Se pidió una excepción al gate",
                                 detail=b.reason, actor=b.requested_by, tone="warn", bypass_id=b.id))
            if b.decided_at and b.status in ("APPROVED", "REJECTED"):
                if is_person(b.decided_by):
                    people[actor_label(b.decided_by)] += 1
                approved = b.status == "APPROVED"
                note = b.decision_note or ""
                if approved and b.expires_at:
                    note = (note + " " if note else "") + f"Vigente hasta {(_aware(b.expires_at)).strftime('%d-%m-%Y %H:%M')} UTC."
                events.append(_event(b.decided_at, "BYPASS_DECIDED",
                                     "Excepción aprobada" if approved else "Excepción rechazada",
                                     detail=note or None, actor=b.decided_by, tone="warn" if approved else "neutral",
                                     bypass_id=b.id))

    # Respuesta a secretos filtrados
    if it.engine == "gitleaks":
        from secret_management import fingerprint_for

        latest = db.get(Finding, it.latest.id) if it.latest else None
        inc = db.query(SecretIncident).filter(SecretIncident.fingerprint == fingerprint_for(latest)).first() if latest else None
        if inc:
            label = f"{inc.rule_id} en {inc.file_path or 'n/a'}"
            sec = (
                db.query(AuditEvent)
                .filter(
                    AuditEvent.action.like("SECRET_%"), AuditEvent.target == repo_name, AuditEvent.workspace_id == ws_id
                )
                .all()
            )
            for e in sorted(sec, key=lambda e: _aware(e.created_at) or now):
                if label not in (e.detail or "") or e.action in ("SECRET_SYNC_FAILED",):
                    continue
                if is_person(e.actor_email):
                    people[actor_label(e.actor_email)] += 1
                tone = "good" if e.action in ("SECRET_RESOLVED", "SECRET_VERIFIED") else "bad" if e.action == "SECRET_REAPPEARED" else "neutral"
                events.append(_event(e.created_at, "SECRET", ACTION_LABEL.get(e.action, e.action),
                                     detail=e.detail, actor=e.actor_email, tone=tone))

    # Automatizaciones que se dispararon por este hallazgo
    for ex in db.query(RunbookExecution).filter(RunbookExecution.repository_id == it.repo_id).all():
        try:
            fps = json.loads(ex.fingerprints or "[]")
        except (TypeError, ValueError):
            fps = []
        if it.fp not in fps:
            continue
        ok = ex.status in ("SUCCESS", "SIMULATED")
        events.append(_event(ex.created_at, "RUNBOOK", f"Automatización «{ex.runbook_name}»",
                             detail=ex.summary, actor=f"{RUNBOOK_PREFIX}{ex.runbook_name}",
                             tone="neutral" if ok else "warn"))

    # Plazo de corrección
    sla = _sla(it, now)
    if sla["due_at"] and it.status not in DECIDED:
        due = datetime.fromisoformat(sla["due_at"])
        if sla["overdue"] or sla["met"] is False or (it.closed_at and it.closed_at > due):
            events.append(_event(due, "SLA", "Venció el plazo de corrección",
                                 detail=f"Tenía {sla['days']} días para corregirse por ser {it.severity}.", tone="bad"))

    events.sort(key=lambda e: e["at"] or "")

    first_scan = scans.get(it.periods[0]["opened_scan"]) if it.periods else None
    last_period = it.periods[-1] if it.periods else None
    fixed_scan = scans.get(last_period["closed_scan"]) if last_period and last_period["closed_scan"] else None
    introduced = _commit_out(first_scan, repo)
    ttf = None
    if it.status == "FIXED" and it.closed_at and last_period:
        ttf = round(max(0.0, (it.closed_at - last_period["opened"]).total_seconds() / 86400), 1)
    open_days = None
    if it.status in ("OPEN", "IN_REVIEW") and last_period:
        open_days = round(max(0.0, (now - last_period["opened"]).total_seconds() / 86400), 1)

    summary = {
        **_issue_out(it, {it.repo_id: repo_name}, now),
        "description": None,
        "introduced_in": introduced,
        "fixed_in": _commit_out(fixed_scan, repo),
        "file_url": _file_url(repo, introduced["sha"] if introduced else None, it.path,
                              it.latest.line if it.latest else None),
        "time_to_fix_days": ttf,
        "open_days": open_days,
        "people": [name for name, _ in people.most_common()],
        "repository_url": repo.url if repo else None,
    }
    latest_f = db.get(Finding, it.latest.id) if it.latest else None
    if latest_f:
        summary["description"] = (latest_f.description or "")[:1500] or None
        summary["owasp_category"] = latest_f.owasp_category
    return events, summary


@router.get("/findings/{ref}")
def issue_detail(ref: str, ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    db = SessionLocal()
    try:
        it = _resolve(db, ref, ws)
        events, summary = _timeline(db, it, _now())
        return {"summary": summary, "timeline": events}
    finally:
        db.close()


@router.get("/findings/{ref}/evidence")
def issue_evidence(ref: str, ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    db = SessionLocal()
    try:
        it = _resolve(db, ref, ws)
        now = _now()
        events, summary = _timeline(db, it, now)
        actor = ws.actor
        db.add(AuditEvent(
            id=str(uuid.uuid4()),
            workspace_id=ws.id,
            action="TRACE_EVIDENCE_EXPORTED",
            target=summary["repository_name"][:200],
            detail=f"{it.title} ({it.path or 'sin archivo'})"[:1000],
            actor_email=actor,
            finding_id=it.latest.id if it.latest else None,
            created_at=now,
        ))
        db.commit()
        return {
            "platform": "SSPILLOWY",
            "document": "Historia de hallazgo",
            "generated_at": _iso(now),
            "generated_by": actor,
            "finding": summary,
            "timeline": [
                {k: v for k, v in e.items() if k not in ("person", "tone")} for e in events
            ],
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Bitácora de auditoría
# ---------------------------------------------------------------------------


def _category_filter(cid: str):
    if cid == "other":
        return and_(*[~AuditEvent.action.like(f"{p}%") for _c, _l, prefixes in CATEGORIES for p in prefixes])
    for c, _label, prefixes in CATEGORIES:
        if c == cid:
            return or_(*[AuditEvent.action.like(f"{p}%") for p in prefixes])
    raise HTTPException(status_code=422, detail="Categoría desconocida.")


@router.get("/events")
def list_events(
    q: Optional[str] = None,
    actor: Optional[str] = None,
    category: Optional[str] = None,
    repository: Optional[str] = None,
    people_only: bool = False,
    date_from: Optional[str] = Query(default=None, alias="from"),
    date_to: Optional[str] = Query(default=None, alias="to"),
    limit: int = Query(default=100, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    ws: WorkspaceCtx = Depends(require_ws),
):
    _require_db()
    db = SessionLocal()
    try:
        base = db.query(AuditEvent).filter(AuditEvent.workspace_id == ws.id)
        start, end = _parse_day(date_from), _parse_day(date_to, end=True)
        if start:
            base = base.filter(AuditEvent.created_at >= start)
        if end:
            base = base.filter(AuditEvent.created_at <= end)
        if repository:
            base = base.filter(AuditEvent.target == repository)
        if q and q.strip():
            like = f"%{q.strip()}%"
            base = base.filter(or_(AuditEvent.detail.ilike(like), AuditEvent.target.ilike(like),
                                   AuditEvent.action.ilike(like), AuditEvent.actor_email.ilike(like)))

        # Facetas sobre el periodo/búsqueda, antes de filtrar por persona o categoría
        actor_counts: Counter = Counter()
        cat_counts: Counter = Counter()
        for a, action in base.with_entities(AuditEvent.actor_email, AuditEvent.action).all():
            actor_counts[a or ""] += 1
            cat_counts[category_of(action or "")] += 1

        filtered = base
        if actor:
            filtered = filtered.filter(AuditEvent.actor_email == actor)
        if category:
            filtered = filtered.filter(_category_filter(category))
        if people_only:
            filtered = filtered.filter(or_(AuditEvent.actor_email.like("%@%"),
                                           AuditEvent.actor_email.like("github_push:%"),
                                           AuditEvent.actor_email.like("github_pr:%")))
        total = filtered.count()
        rows = filtered.order_by(AuditEvent.created_at.desc()).offset(offset).limit(limit).all()

        fids = {e.finding_id for e in rows if e.finding_id} | {e.target for e in rows if e.action.startswith("FINDING_") and e.target}
        keys: dict[str, str] = {}
        if fids:
            for fid, repo_id, engine, title, path in db.query(
                Finding.id, Finding.repository_id, Finding.engine, Finding.title, Finding.file_path
            ).filter(Finding.id.in_(list(fids))).all():
                keys[fid] = issue_key(repo_id, fingerprint(engine, title, path))

        items = []
        for e in rows:
            cat = category_of(e.action or "")
            items.append({
                "id": e.id,
                "at": _iso(e.created_at),
                "action": e.action,
                "label": ACTION_LABEL.get(e.action, (e.action or "").replace("_", " ").capitalize()),
                "category": cat,
                "category_label": CATEGORY_LABEL.get(cat, "Otros"),
                "actor": e.actor_email,
                "actor_label": actor_label(e.actor_email),
                "person": is_person(e.actor_email),
                "target": e.target,
                "detail": e.detail,
                "finding_key": keys.get(e.finding_id or "") or keys.get(e.target or ""),
            })
        return {
            "total": total,
            "items": items,
            "actors": [
                {"actor": a, "label": actor_label(a), "count": n, "person": is_person(a)}
                for a, n in actor_counts.most_common() if a
            ],
            "categories": [
                {"id": cid, "label": label, "count": cat_counts.get(cid, 0)}
                for cid, label, _ in CATEGORIES
            ] + ([{"id": "other", "label": "Otros", "count": cat_counts["other"]}] if cat_counts.get("other") else []),
            "repositories": sorted(
                {r.name for r in db.query(Repository.name).filter(Repository.workspace_id == ws.id).all()}
            ),
        }
    finally:
        db.close()
