"""Automatizaciones (runbooks): reglas "cuando pasa X → haz Y" que se evalúan al terminar cada análisis.

Los eventos se calculan comparando el análisis recién terminado con el historial del repositorio
(hallazgos nuevos por fingerprint, secretos nuevos, gate bloqueado, plazos vencidos, análisis fallido).
Cada ejecución queda registrada con el resultado de cada acción; "Probar" simula sin efectos.
"""

from __future__ import annotations

import html
import ipaddress
import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, List, Literal, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth_deps import require_hub_read, require_hub_write
from database import SessionLocal, db_ping
from models import AuditEvent, Finding, Repository, Runbook, RunbookExecution, Scan, SecretIncident
from velocity import SLA_DAYS, fingerprint, first_seen_map

router = APIRouter(prefix="/api/v1/runbooks", tags=["Automatizaciones"])

TRIGGERS = ("SECRET_DETECTED", "NEW_FINDING", "GATE_BLOCKED", "SLA_BREACHED", "SCAN_FAILED")
ACTION_TYPES = ("email", "webhook", "assign_owner", "set_in_review", "rescan")
FINDING_TRIGGERS = ("SECRET_DETECTED", "NEW_FINDING", "SLA_BREACHED")
SEV_RANK = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
ACTIVE = ("OPEN", "IN_REVIEW")
RUNBOOK_ACTOR_PREFIX = "runbook:"
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

TRIGGER_LABEL = {
    "SECRET_DETECTED": "Secreto detectado",
    "NEW_FINDING": "Nuevo hallazgo",
    "GATE_BLOCKED": "Gate bloqueado",
    "SLA_BREACHED": "Plazo vencido",
    "SCAN_FAILED": "Análisis fallido",
}
SEV_ES = {"CRITICAL": "crítico", "HIGH": "alto", "MEDIUM": "medio", "LOW": "bajo", "INFO": "informativo"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    dt = _aware(dt)
    return dt.isoformat() if dt else None


def _loads(raw: str | None, default: Any) -> Any:
    try:
        val = json.loads(raw) if raw else default
        return val if isinstance(val, type(default)) else default
    except (TypeError, ValueError):
        return default


def _audit(db, actor: str, action: str, target: str, detail: str) -> None:
    db.add(
        AuditEvent(
            id=str(uuid.uuid4()),
            action=action,
            target=(target or "")[:200],
            detail=(detail or "")[:1000],
            actor_email=(actor or "runbooks")[:255],
            created_at=_now(),
        )
    )


# --------------------------------------------------------------------------- validación


class ActionIn(BaseModel):
    type: Literal["email", "webhook", "assign_owner", "set_in_review", "rescan"]
    to: List[str] = Field(default_factory=list)
    security_team: bool = False
    url: Optional[str] = None
    kind: Literal["slack", "teams", "generic"] = "slack"
    email: Optional[str] = None


class ConditionsIn(BaseModel):
    repository_ids: List[str] = Field(default_factory=list)
    min_severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] = "CRITICAL"


class RunbookBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=600)
    enabled: bool = True
    trigger: Literal["SECRET_DETECTED", "NEW_FINDING", "GATE_BLOCKED", "SLA_BREACHED", "SCAN_FAILED"]
    conditions: ConditionsIn = Field(default_factory=ConditionsIn)
    actions: List[ActionIn] = Field(min_length=1, max_length=6)
    template: Optional[str] = Field(default=None, max_length=60)


class RunbookPatch(BaseModel):
    enabled: Optional[bool] = None


class TestBody(BaseModel):
    repository_id: Optional[str] = None


def _check_webhook_url(url: str | None) -> str:
    u = (url or "").strip()
    parsed = urlparse(u)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host:
        raise HTTPException(status_code=400, detail="La URL del webhook debe empezar con https://")
    if host in ("localhost",) or host.endswith((".local", ".internal")):
        raise HTTPException(status_code=400, detail="La URL del webhook debe ser un servicio público (Slack, Teams…).")
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise HTTPException(status_code=400, detail="La URL del webhook debe ser un servicio público (Slack, Teams…).")
    except ValueError:
        pass
    return u


def _validate(body: RunbookBody) -> list[dict]:
    actions: list[dict] = []
    for a in body.actions:
        if a.type == "email":
            to = sorted({e.strip().lower() for e in a.to if e.strip()})
            bad = [e for e in to if not _EMAIL_RE.match(e)]
            if bad:
                raise HTTPException(status_code=400, detail=f"Correo no válido: {bad[0]}")
            if not to and not a.security_team:
                raise HTTPException(status_code=400, detail="Indica al menos un correo o el equipo de seguridad.")
            actions.append({"type": "email", "to": to, "security_team": a.security_team})
        elif a.type == "webhook":
            actions.append({"type": "webhook", "url": _check_webhook_url(a.url), "kind": a.kind})
        elif a.type == "assign_owner":
            if body.trigger != "SECRET_DETECTED":
                raise HTTPException(status_code=400, detail="Asignar responsable solo aplica al disparador «Secreto detectado».")
            email = (a.email or "").strip().lower()
            if not _EMAIL_RE.match(email):
                raise HTTPException(status_code=400, detail="Indica un correo válido para el responsable.")
            actions.append({"type": "assign_owner", "email": email})
        elif a.type == "set_in_review":
            if body.trigger not in FINDING_TRIGGERS:
                raise HTTPException(
                    status_code=400, detail="«Pasar a En revisión» solo aplica a disparadores sobre hallazgos."
                )
            actions.append({"type": "set_in_review"})
        elif a.type == "rescan":
            actions.append({"type": "rescan"})
    return actions


# --------------------------------------------------------------------------- eventos


class Event:
    def __init__(self, trigger: str, repo: Repository, scan: Scan, findings: list[Finding], summary: str):
        self.trigger = trigger
        self.repo = repo
        self.scan = scan
        self.findings = findings
        self.summary = summary

    @property
    def fingerprints(self) -> list[str]:
        return sorted({fingerprint(f.engine, f.title, f.file_path) for f in self.findings})


def _min_sev_ok(f: Finding, min_sev: str) -> bool:
    return SEV_RANK.get((f.severity or "INFO").upper(), 4) <= SEV_RANK.get(min_sev, 0)


def _describe(findings: list[Finding], singular: str, plural: str) -> str:
    n = len(findings)
    top = ", ".join(sorted({(f.title or "")[:60] for f in findings})[:3])
    return f"{n} {singular if n == 1 else plural}: {top}" + ("…" if n > 3 else "")


def build_event(db, rb: Runbook, scan: Scan, repo: Repository) -> tuple[Event | None, str]:
    """Devuelve el evento si el análisis cumple el disparador del runbook, o el motivo por el que no."""
    cond = _loads(rb.conditions, {})
    repo_ids = cond.get("repository_ids") or []
    if repo_ids and repo.id not in repo_ids:
        return None, "El repositorio no está en el alcance del runbook."
    min_sev = cond.get("min_severity") or "CRITICAL"
    trig = rb.trigger

    if trig == "SCAN_FAILED":
        if scan.status != "FAILED":
            return None, "El análisis terminó bien."
        detail = (scan.progress_detail or "sin detalle")[:200]
        return Event(trig, repo, scan, [], f"El análisis de {repo.name} falló: {detail}"), ""

    if scan.status != "COMPLETED":
        return None, "El análisis no terminó correctamente."

    if trig == "GATE_BLOCKED":
        if scan.gate_status != "BLOCKED":
            return None, "El Security Gate no bloqueó este análisis."
        return Event(trig, repo, scan, [], f"El Security Gate bloqueó {repo.name}. {(scan.gate_detail or '')[:200]}"), ""

    current = (
        db.query(Finding)
        .filter(Finding.scan_id == scan.id, Finding.status.in_(list(ACTIVE)))
        .all()
    )

    if trig in ("SECRET_DETECTED", "NEW_FINDING"):
        earlier = {
            fingerprint(e, t, p)
            for e, t, p in db.query(Finding.engine, Finding.title, Finding.file_path)
            .filter(Finding.repository_id == repo.id, Finding.scan_id != scan.id)
            .all()
        }
        new = [f for f in current if fingerprint(f.engine, f.title, f.file_path) not in earlier]
        if trig == "SECRET_DETECTED":
            hits = [f for f in new if (f.engine or "") == "gitleaks"]
            if not hits:
                return None, "No apareció ningún secreto nuevo en este análisis."
            return Event(trig, repo, scan, hits, f"{_describe(hits, 'secreto nuevo', 'secretos nuevos')} en {repo.name}."), ""
        hits = [f for f in new if _min_sev_ok(f, min_sev)]
        if not hits:
            return None, f"No apareció ningún hallazgo nuevo de severidad {SEV_ES[min_sev]} o superior."
        return Event(trig, repo, scan, hits, f"{_describe(hits, 'hallazgo nuevo', 'hallazgos nuevos')} en {repo.name}."), ""

    if trig == "SLA_BREACHED":
        first_seen = first_seen_map(db, [repo.id])
        now = _now()
        reported: set[str] = set()
        for (raw,) in db.query(RunbookExecution.fingerprints).filter(
            RunbookExecution.runbook_id == rb.id,
            RunbookExecution.repository_id == repo.id,
            RunbookExecution.status != "SIMULATED",
        ):
            reported.update(_loads(raw, []))
        hits = []
        for f in current:
            if not _min_sev_ok(f, min_sev):
                continue
            fp = fingerprint(f.engine, f.title, f.file_path)
            seen = first_seen.get((repo.id, fp)) or _aware(f.created_at)
            if seen and (now - seen).days > SLA_DAYS.get((f.severity or "").upper(), 90) and fp not in reported:
                hits.append(f)
        if not hits:
            return None, "No hay hallazgos que hayan superado su plazo desde el último aviso."
        return Event(trig, repo, scan, hits, f"{_describe(hits, 'hallazgo vencido', 'hallazgos vencidos')} en {repo.name}."), ""

    return None, "Disparador desconocido."


# --------------------------------------------------------------------------- acciones


def _hub_url() -> str:
    return os.getenv("FRONTEND_URL", "https://sspillowy.com").rstrip("/")


def _message(rb: Runbook, ev: Event) -> tuple[str, str]:
    title = f"[SSPILLOWY] {TRIGGER_LABEL.get(ev.trigger, ev.trigger)} · {ev.repo.name}"
    lines = [ev.summary]
    for f in ev.findings[:8]:
        where = f" ({f.file_path})" if f.file_path else ""
        lines.append(f"• {SEV_ES.get((f.severity or '').upper(), '')} · {f.title[:90]}{where}")
    lines.append(f"Runbook: {rb.name}")
    lines.append(f"Consola: {_hub_url()}")
    return title, "\n".join(lines)


def _act_email(action: dict, rb: Runbook, ev: Event, simulate: bool) -> tuple[bool, str]:
    from email_service import alert_recipients, mailer_configured, send_email_sync

    to = list(action.get("to") or [])
    if action.get("security_team"):
        to += [e for e in alert_recipients() if e not in to]
    if not to:
        return False, "No hay destinatarios: configura el equipo de seguridad o añade correos."
    if simulate:
        return True, f"Enviaría un correo a {', '.join(to)}."
    if not mailer_configured():
        return False, "El envío de correos no está configurado en el servidor."
    subject, text = _message(rb, ev)
    body = "<br>".join(html.escape(line) for line in text.split("\n"))
    html_body = f'<div style="font-family:system-ui,sans-serif;color:#1f2328;font-size:14px;line-height:1.5">{body}</div>'
    sent = sum(1 for addr in to if send_email_sync(to=addr, subject=subject, text=text, html_body=html_body))
    if not sent:
        return False, "No se pudo enviar el correo."
    return sent == len(to), f"Correo enviado a {sent} de {len(to)} destinatario(s)."


def _act_webhook(action: dict, rb: Runbook, ev: Event, simulate: bool) -> tuple[bool, str]:
    kind = action.get("kind") or "slack"
    target = {"slack": "Slack", "teams": "Microsoft Teams", "generic": "el webhook"}[kind]
    if simulate:
        return True, f"Publicaría un mensaje en {target}."
    subject, text = _message(rb, ev)
    if kind == "generic":
        payload: dict = {
            "event": ev.trigger,
            "repository": ev.repo.name,
            "runbook": rb.name,
            "summary": ev.summary,
            "findings": [
                {"title": f.title, "severity": f.severity, "engine": f.engine, "file": f.file_path} for f in ev.findings[:20]
            ],
        }
    else:
        payload = {"text": f"*{subject}*\n{text}" if kind == "slack" else f"**{subject}**\n\n{text}"}
    try:
        res = httpx.post(action["url"], json=payload, timeout=10.0)
    except httpx.HTTPError:
        return False, f"No se pudo contactar con {target}."
    if res.status_code >= 300:
        return False, f"{target} rechazó el mensaje (código {res.status_code})."
    return True, f"Mensaje publicado en {target}."


def _act_assign(db, action: dict, ev: Event, simulate: bool) -> tuple[bool, str]:
    from secret_management import _derive_status, fingerprint_for

    fps = {fingerprint_for(f) for f in ev.findings if (f.engine or "") == "gitleaks"}
    incidents = db.query(SecretIncident).filter(SecretIncident.fingerprint.in_(list(fps))).all() if fps else []
    pending = [i for i in incidents if not i.owner_email]
    if not pending:
        return True, "Los secretos ya tenían responsable."
    if simulate:
        return True, f"Asignaría {len(pending)} secreto(s) a {action['email']}."
    for inc in pending:
        inc.owner_email = action["email"]
        inc.status = _derive_status(inc)
        inc.updated_at = _now()
    return True, f"{len(pending)} secreto(s) asignados a {action['email']}."


def _act_review(db, ev: Event, simulate: bool) -> tuple[bool, str]:
    from semgrep_scan import _refresh_repo_counters

    pending = [f for f in ev.findings if f.status == "OPEN"]
    if not pending:
        return True, "Los hallazgos ya estaban en revisión."
    if simulate:
        return True, f"Pasaría {len(pending)} hallazgo(s) a «En revisión»."
    for f in pending:
        f.status = "IN_REVIEW"
    _refresh_repo_counters(db, ev.repo)
    return True, f"{len(pending)} hallazgo(s) pasados a «En revisión»."


def _act_rescan(db, rb: Runbook, ev: Event, simulate: bool) -> tuple[bool, str]:
    if (ev.scan.triggered_by or "").startswith(RUNBOOK_ACTOR_PREFIX):
        return True, "Omitido: el análisis ya lo había lanzado un runbook (evita repeticiones en bucle)."
    running = (
        db.query(Scan)
        .filter(Scan.repository_id == ev.repo.id, Scan.status == "RUNNING", Scan.id != ev.scan.id)
        .count()
    )
    if running:
        return True, "Omitido: ya hay un análisis en curso para este repositorio."
    engines = [e for e in (ev.scan.engines_ok or "").split(",") if e] or ["semgrep", "gitleaks", "trivy"]
    if simulate:
        return True, f"Lanzaría un nuevo análisis de {ev.repo.name}."
    from semgrep_scan import run_repo_scan_job

    new_scan = Scan(
        id=str(uuid.uuid4()),
        repository_id=ev.repo.id,
        status="RUNNING",
        triggered_by=f"{RUNBOOK_ACTOR_PREFIX}{rb.name}"[:120],
        branch=ev.repo.branch or "main",
        progress_stage="queued",
        progress_detail="En cola (runbook)…",
        created_at=_now(),
    )
    db.add(new_scan)
    db.commit()
    target = (ev.repo.dast_url or "").strip() or None
    threading.Thread(target=run_repo_scan_job, args=(new_scan.id, engines, target), daemon=True).start()
    return True, f"Nuevo análisis de {ev.repo.name} en cola."


ACTION_LABEL = {
    "email": "Enviar correo",
    "webhook": "Publicar en canal",
    "assign_owner": "Asignar responsable",
    "set_in_review": "Pasar a En revisión",
    "rescan": "Relanzar análisis",
}


def execute(db, rb: Runbook, ev: Event, *, simulate: bool, actor: str) -> RunbookExecution:
    results = []
    for action in _loads(rb.actions, []):
        kind = action.get("type")
        try:
            if kind == "email":
                ok, msg = _act_email(action, rb, ev, simulate)
            elif kind == "webhook":
                ok, msg = _act_webhook(action, rb, ev, simulate)
            elif kind == "assign_owner":
                ok, msg = _act_assign(db, action, ev, simulate)
            elif kind == "set_in_review":
                ok, msg = _act_review(db, ev, simulate)
            elif kind == "rescan":
                ok, msg = _act_rescan(db, rb, ev, simulate)
            else:
                ok, msg = False, "Acción desconocida."
        except Exception as exc:  # una acción que falla no debe frenar las demás
            ok, msg = False, f"Error inesperado: {str(exc)[:160]}"
        results.append({"type": kind, "label": ACTION_LABEL.get(kind, kind), "ok": ok, "message": msg})

    if simulate:
        status = "SIMULATED"
    elif all(r["ok"] for r in results):
        status = "SUCCESS"
    elif any(r["ok"] for r in results):
        status = "PARTIAL"
    else:
        status = "FAILED"

    row = RunbookExecution(
        id=str(uuid.uuid4()),
        runbook_id=rb.id,
        runbook_name=rb.name,
        trigger=ev.trigger,
        repository_id=ev.repo.id,
        repository_name=ev.repo.name,
        scan_id=ev.scan.id,
        status=status,
        summary=ev.summary[:1000],
        results=json.dumps(results, ensure_ascii=False),
        fingerprints=json.dumps(ev.fingerprints),
        actor=actor,
        created_at=_now(),
    )
    db.add(row)
    if not simulate:
        rb.run_count = (rb.run_count or 0) + 1
        rb.last_run_at = _now()
        ok_count = sum(1 for r in results if r["ok"])
        _audit(
            db,
            f"{RUNBOOK_ACTOR_PREFIX}{rb.name}",
            "RUNBOOK_EXECUTED",
            ev.repo.name,
            f"{TRIGGER_LABEL.get(ev.trigger)} · {ok_count}/{len(results)} acciones correctas · {ev.summary[:300]}",
        )
    return row


def run_runbooks_for_scan(scan_id: str) -> int:
    """Se llama al terminar un análisis (bien o mal). Ejecuta los runbooks activos que apliquen."""
    db = SessionLocal()
    try:
        scan = db.get(Scan, scan_id)
        if not scan or scan.status not in ("COMPLETED", "FAILED"):
            return 0
        repo = db.get(Repository, scan.repository_id)
        if not repo:
            return 0
        already = {
            rid
            for (rid,) in db.query(RunbookExecution.runbook_id).filter(
                RunbookExecution.scan_id == scan.id, RunbookExecution.status != "SIMULATED"
            )
        }
        executed = 0
        for rb in db.query(Runbook).filter(Runbook.enabled.is_(True)).all():
            if rb.id in already:
                continue
            ev, _reason = build_event(db, rb, scan, repo)
            if ev is None:
                continue
            execute(db, rb, ev, simulate=False, actor="automático")
            db.commit()
            executed += 1
        return executed
    except Exception as exc:
        print(f"[sspillowy] runbooks failed for scan {scan_id}: {exc}")
        db.rollback()
        return 0
    finally:
        db.close()


# --------------------------------------------------------------------------- API


def _require_db() -> None:
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible")


def _actor(session) -> str:
    return ((session or {}).get("email") or "web_hub").strip().lower()


def _out(rb: Runbook, repo_names: dict[str, str]) -> dict:
    cond = _loads(rb.conditions, {})
    ids = [i for i in cond.get("repository_ids") or [] if i in repo_names]
    return {
        "id": rb.id,
        "name": rb.name,
        "description": rb.description or "",
        "enabled": bool(rb.enabled),
        "trigger": rb.trigger,
        "conditions": {"repository_ids": ids, "min_severity": cond.get("min_severity") or "CRITICAL"},
        "repository_names": [repo_names[i] for i in ids],
        "actions": _loads(rb.actions, []),
        "template": rb.template,
        "owner_email": rb.owner_email,
        "run_count": rb.run_count or 0,
        "last_run_at": _iso(rb.last_run_at),
        "created_at": _iso(rb.created_at),
        "updated_at": _iso(rb.updated_at),
    }


def _exec_out(e: RunbookExecution) -> dict:
    return {
        "id": e.id,
        "runbook_id": e.runbook_id,
        "runbook_name": e.runbook_name,
        "trigger": e.trigger,
        "repository_id": e.repository_id,
        "repository_name": e.repository_name,
        "scan_id": e.scan_id,
        "status": e.status,
        "summary": e.summary or "",
        "results": _loads(e.results, []),
        "actor": e.actor,
        "created_at": _iso(e.created_at),
    }


def _repo_names(db) -> dict[str, str]:
    return {r.id: r.name for r in db.query(Repository).all()}


@router.get("")
def list_runbooks(_auth=Depends(require_hub_read)):
    _require_db()
    db = SessionLocal()
    try:
        names = _repo_names(db)
        rows = db.query(Runbook).order_by(Runbook.created_at.asc()).all()
        from email_service import alert_recipients, mailer_configured

        return {
            "runbooks": [_out(r, names) for r in rows],
            "email_ready": mailer_configured(),
            "security_team": alert_recipients(),
        }
    finally:
        db.close()


@router.post("", status_code=201)
def create_runbook(body: RunbookBody, session=Depends(require_hub_write)):
    _require_db()
    actions = _validate(body)
    db = SessionLocal()
    try:
        names = _repo_names(db)
        rb = Runbook(
            id=str(uuid.uuid4()),
            name=body.name.strip(),
            description=(body.description or "").strip() or None,
            enabled=body.enabled,
            trigger=body.trigger,
            conditions=json.dumps(
                {
                    "repository_ids": [i for i in body.conditions.repository_ids if i in names],
                    "min_severity": body.conditions.min_severity,
                }
            ),
            actions=json.dumps(actions),
            template=body.template,
            owner_email=_actor(session),
            created_at=_now(),
            updated_at=_now(),
        )
        db.add(rb)
        _audit(db, _actor(session), "RUNBOOK_CREATED", rb.name, f"{TRIGGER_LABEL[rb.trigger]} → {len(actions)} acción(es)")
        db.commit()
        return _out(rb, names)
    finally:
        db.close()


def _get(db, runbook_id: str) -> Runbook:
    rb = db.get(Runbook, runbook_id)
    if not rb:
        raise HTTPException(status_code=404, detail="Runbook no encontrado.")
    return rb


@router.put("/{runbook_id}")
def update_runbook(runbook_id: str, body: RunbookBody, session=Depends(require_hub_write)):
    _require_db()
    actions = _validate(body)
    db = SessionLocal()
    try:
        names = _repo_names(db)
        rb = _get(db, runbook_id)
        rb.name = body.name.strip()
        rb.description = (body.description or "").strip() or None
        rb.enabled = body.enabled
        rb.trigger = body.trigger
        rb.conditions = json.dumps(
            {
                "repository_ids": [i for i in body.conditions.repository_ids if i in names],
                "min_severity": body.conditions.min_severity,
            }
        )
        rb.actions = json.dumps(actions)
        rb.updated_at = _now()
        _audit(db, _actor(session), "RUNBOOK_UPDATED", rb.name, f"{TRIGGER_LABEL[rb.trigger]} → {len(actions)} acción(es)")
        db.commit()
        return _out(rb, names)
    finally:
        db.close()


@router.patch("/{runbook_id}")
def toggle_runbook(runbook_id: str, body: RunbookPatch, session=Depends(require_hub_write)):
    _require_db()
    db = SessionLocal()
    try:
        rb = _get(db, runbook_id)
        if body.enabled is not None:
            rb.enabled = body.enabled
            rb.updated_at = _now()
            _audit(db, _actor(session), "RUNBOOK_ENABLED" if body.enabled else "RUNBOOK_DISABLED", rb.name, "")
        db.commit()
        return _out(rb, _repo_names(db))
    finally:
        db.close()


@router.delete("/{runbook_id}")
def delete_runbook(runbook_id: str, session=Depends(require_hub_write)):
    _require_db()
    db = SessionLocal()
    try:
        rb = _get(db, runbook_id)
        _audit(db, _actor(session), "RUNBOOK_DELETED", rb.name, "")
        db.delete(rb)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


@router.post("/{runbook_id}/test")
def test_runbook(runbook_id: str, body: TestBody, session=Depends(require_hub_write)):
    """Simula el runbook contra el último análisis del repositorio elegido, sin ejecutar acciones."""
    _require_db()
    db = SessionLocal()
    try:
        rb = _get(db, runbook_id)
        statuses = ["FAILED"] if rb.trigger == "SCAN_FAILED" else ["COMPLETED"]
        q = db.query(Scan).filter(Scan.status.in_(statuses))
        if body.repository_id:
            q = q.filter(Scan.repository_id == body.repository_id)
        else:
            scope = _loads(rb.conditions, {}).get("repository_ids") or []
            if scope:
                q = q.filter(Scan.repository_id.in_(scope))
        scan = q.order_by(Scan.created_at.desc()).first()
        if not scan:
            return {
                "matched": False,
                "reason": "No hay un análisis "
                + ("fallido" if rb.trigger == "SCAN_FAILED" else "terminado")
                + " con el que probar en ese alcance.",
                "execution": None,
            }
        repo = db.get(Repository, scan.repository_id)
        ev, reason = build_event(db, rb, scan, repo)
        scan_label = f"último análisis de {repo.name if repo else '—'}"
        if ev is None:
            return {"matched": False, "reason": f"Con el {scan_label}: {reason}", "execution": None}
        row = execute(db, rb, ev, simulate=True, actor=_actor(session))
        db.commit()
        return {"matched": True, "reason": f"Con el {scan_label} se activaría.", "execution": _exec_out(row)}
    finally:
        db.close()


@router.get("/executions")
def list_executions(
    runbook_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _auth=Depends(require_hub_read),
):
    _require_db()
    db = SessionLocal()
    try:
        q = db.query(RunbookExecution)
        if runbook_id:
            q = q.filter(RunbookExecution.runbook_id == runbook_id)
        rows = q.order_by(RunbookExecution.created_at.desc()).limit(limit).all()
        return [_exec_out(r) for r in rows]
    finally:
        db.close()
