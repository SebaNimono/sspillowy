"""Secret Management: respuesta guiada a secretos filtrados (rotar, revocar, limpiar historial, verificar).

Cada re-escaneo crea hallazgos nuevos y marca los anteriores como SUPERSEDED, así que el estado de la
respuesta vive en `SecretIncident`, identificado por un fingerprint estable (repo + regla + archivo + preview).
"""

from __future__ import annotations

import hashlib
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth_deps import require_hub_read, require_hub_write
from database import SessionLocal, db_ping
from models import AuditEvent, Finding, Repository, SecretIncident
from semgrep_scan import ACTIVE_STATUSES, _refresh_repo_counters

router = APIRouter(prefix="/api/v1/secrets", tags=["Secret Management"])

STEPS = ("rotated", "revoked", "history_cleaned", "verified")

_PROVIDERS: list[tuple[str, tuple[str, ...]]] = [
    ("aws", ("aws",)),
    ("github", ("github",)),
    ("gitlab", ("gitlab",)),
    ("stripe", ("stripe",)),
    ("slack", ("slack",)),
    ("gcp", ("gcp", "google")),
    ("azure", ("azure",)),
    ("openai", ("openai",)),
    ("twilio", ("twilio",)),
    ("sendgrid", ("sendgrid",)),
    ("private_key", ("private-key", "private_key", "privatekey", "pkcs8", "rsa", "ssh")),
    ("jwt", ("jwt",)),
    ("database", ("postgres", "mysql", "mongodb", "database", "connection-string", "jdbc")),
]

_PREVIEW_RE = re.compile(r"Match \(redactado\):\s*(.+)")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _require_db() -> None:
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible")


def provider_for(rule_id: str) -> str:
    rid = rule_id.lower()
    for provider, needles in _PROVIDERS:
        if any(n in rid for n in needles):
            return provider
    return "generic"


def _rule_of(f: Finding) -> str:
    return (f.title or "").split(":", 1)[0].strip() or "gitleaks.secret"


def _preview_of(f: Finding) -> str:
    m = _PREVIEW_RE.search(f.description or "")
    return m.group(1).strip() if m else "(redacted)"


def fingerprint_for(f: Finding) -> str:
    raw = "|".join([f.repository_id, _rule_of(f), f.file_path or "", _preview_of(f)])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _append_audit(db, actor: str, action: str, target: str, detail: str) -> None:
    db.add(
        AuditEvent(
            id=str(uuid.uuid4()),
            action=action,
            target=target,
            detail=detail[:2000],
            actor_email=(actor or "web_hub")[:255],
            created_at=_now(),
        )
    )


def _derive_status(inc: SecretIncident) -> str:
    if inc.status == "FALSE_POSITIVE":
        return "FALSE_POSITIVE"
    if all(getattr(inc, f"{s}_at") for s in STEPS):
        return "RESOLVED"
    if any(getattr(inc, f"{s}_at") for s in STEPS) or inc.owner_email:
        return "IN_PROGRESS"
    return "OPEN"


def _linked_findings(db, inc: SecretIncident) -> list[Finding]:
    rows = (
        db.query(Finding)
        .filter(Finding.repository_id == inc.repository_id, Finding.engine == "gitleaks")
        .filter(Finding.status != "SUPERSEDED")
        .all()
    )
    return [f for f in rows if fingerprint_for(f) == inc.fingerprint]


def _set_findings_status(db, findings: list[Finding], status: str) -> int:
    changed = 0
    for f in findings:
        if f.status in ACTIVE_STATUSES:
            f.status = status
            changed += 1
    return changed


def sync_secret_incidents(db, repository_id: str | None = None) -> None:
    """Crea/actualiza incidentes a partir de los hallazgos de GitLeaks vigentes."""
    q = db.query(Finding).filter(Finding.engine == "gitleaks", Finding.status != "SUPERSEDED")
    if repository_id:
        q = q.filter(Finding.repository_id == repository_id)
    findings = q.all()
    if not findings:
        return

    by_fp: dict[str, list[Finding]] = {}
    for f in findings:
        by_fp.setdefault(fingerprint_for(f), []).append(f)

    existing = {
        inc.fingerprint: inc
        for inc in db.query(SecretIncident).filter(SecretIncident.fingerprint.in_(list(by_fp))).all()
    }
    touched_repos: set[str] = set()

    for fp, group in by_fp.items():
        newest = max(group, key=lambda f: _aware(f.created_at) or _now())
        inc = existing.get(fp)
        if inc is None:
            rule = _rule_of(newest)
            inc = SecretIncident(
                id=str(uuid.uuid4()),
                fingerprint=fp,
                repository_id=newest.repository_id,
                rule_id=rule[:200],
                provider=provider_for(rule),
                severity=newest.severity or "HIGH",
                file_path=newest.file_path,
                line_number=newest.line_number,
                preview=_preview_of(newest)[:120],
                status="OPEN",
                first_seen_at=min((_aware(f.created_at) or _now()) for f in group),
                last_seen_at=_aware(newest.created_at) or _now(),
                reopened_count=0,
                updated_at=_now(),
            )
            db.add(inc)
            continue

        inc.last_seen_at = max(_aware(inc.last_seen_at) or _now(), _aware(newest.created_at) or _now())
        inc.line_number = newest.line_number
        inc.severity = newest.severity or inc.severity
        active = [f for f in group if f.status in ACTIVE_STATUSES]

        if inc.status == "FALSE_POSITIVE" and active:
            _set_findings_status(db, active, "FALSE_POSITIVE")
            touched_repos.add(inc.repository_id)
        elif inc.status == "RESOLVED" and inc.resolved_at:
            resolved_at = _aware(inc.resolved_at)
            reappeared = [f for f in active if (_aware(f.created_at) or _now()) > resolved_at]
            if reappeared:
                inc.verified_at = None
                inc.verified_by = None
                inc.resolved_at = None
                inc.reopened_count = (inc.reopened_count or 0) + 1
                inc.status = _derive_status(inc)
                inc.updated_at = _now()
                repo = db.get(Repository, inc.repository_id)
                _append_audit(
                    db,
                    "secret-management",
                    "SECRET_REAPPEARED",
                    repo.name if repo else inc.repository_id,
                    f"{inc.rule_id} en {inc.file_path or 'n/a'}: detectado de nuevo tras resolverse. Se reabre la verificación.",
                )

    for repo_id in touched_repos:
        repo = db.get(Repository, repo_id)
        if repo:
            _refresh_repo_counters(db, repo)


class SecretIncidentOut(BaseModel):
    id: str
    repository_id: str
    repository_name: Optional[str] = None
    rule_id: str
    provider: str
    severity: str
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    preview: Optional[str] = None
    status: str
    owner_email: Optional[str] = None
    notes: Optional[str] = None
    steps: dict
    detected_now: bool
    active_findings: int
    finding_ids: List[str]
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    reopened_count: int = 0
    updated_at: Optional[datetime] = None


class SecretIncidentUpdate(BaseModel):
    steps: Optional[dict[str, bool]] = None
    owner_email: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = Field(default=None, max_length=4000)
    status: Optional[str] = Field(default=None, description="FALSE_POSITIVE para descartar, OPEN para reabrir")


def _out(db, inc: SecretIncident, repo_names: dict[str, str]) -> SecretIncidentOut:
    linked = _linked_findings(db, inc)
    active = [f for f in linked if f.status in ACTIVE_STATUSES]
    return SecretIncidentOut(
        id=inc.id,
        repository_id=inc.repository_id,
        repository_name=repo_names.get(inc.repository_id),
        rule_id=inc.rule_id,
        provider=inc.provider,
        severity=inc.severity,
        file_path=inc.file_path,
        line_number=inc.line_number,
        preview=inc.preview,
        status=inc.status,
        owner_email=inc.owner_email,
        notes=inc.notes,
        steps={
            s: {"done": bool(getattr(inc, f"{s}_at")), "at": getattr(inc, f"{s}_at"), "by": getattr(inc, f"{s}_by")}
            for s in STEPS
        },
        detected_now=bool(active),
        active_findings=len(active),
        finding_ids=[f.id for f in linked],
        first_seen_at=inc.first_seen_at,
        last_seen_at=inc.last_seen_at,
        resolved_at=inc.resolved_at,
        reopened_count=inc.reopened_count or 0,
        updated_at=inc.updated_at,
    )


def _repo_names(db) -> dict[str, str]:
    return {r.id: r.name for r in db.query(Repository.id, Repository.name).all()}


@router.get("", response_model=List[SecretIncidentOut])
async def list_secret_incidents(
    repository_id: Optional[str] = Query(default=None),
    _auth=Depends(require_hub_read),
):
    _require_db()
    db = SessionLocal()
    try:
        sync_secret_incidents(db, repository_id)
        db.commit()
        q = db.query(SecretIncident).order_by(SecretIncident.first_seen_at.desc())
        if repository_id:
            q = q.filter(SecretIncident.repository_id == repository_id)
        names = _repo_names(db)
        return [_out(db, inc, names) for inc in q.all()]
    finally:
        db.close()


_STEP_LABEL = {
    "rotated": "Credencial rotada",
    "revoked": "Credencial anterior revocada",
    "history_cleaned": "Historial de Git limpiado",
    "verified": "Verificado",
}


@router.patch("/{incident_id}", response_model=SecretIncidentOut)
async def update_secret_incident(
    incident_id: str,
    body: SecretIncidentUpdate,
    session=Depends(require_hub_write),
):
    _require_db()
    actor = ((session or {}).get("email") or "web_hub").strip().lower()
    db = SessionLocal()
    try:
        inc = db.get(SecretIncident, incident_id)
        if not inc:
            raise HTTPException(status_code=404, detail="Incidente no encontrado")
        repo = db.get(Repository, inc.repository_id)
        target = repo.name if repo else inc.repository_id
        label = f"{inc.rule_id} en {inc.file_path or 'n/a'}"
        now = _now()

        if body.status:
            new_status = body.status.upper()
            if new_status not in ("FALSE_POSITIVE", "OPEN"):
                raise HTTPException(status_code=422, detail="Estado permitido: FALSE_POSITIVE u OPEN")
            if new_status == "FALSE_POSITIVE":
                inc.status = "FALSE_POSITIVE"
                inc.resolved_at = now
                _set_findings_status(db, _linked_findings(db, inc), "FALSE_POSITIVE")
                _append_audit(db, actor, "SECRET_FALSE_POSITIVE", target, f"{label} descartado. {body.notes or ''}".strip())
            else:
                inc.status = "OPEN"
                inc.resolved_at = None
                inc.verified_at = None
                inc.verified_by = None
                inc.status = _derive_status(inc)
                _append_audit(db, actor, "SECRET_REOPENED", target, f"{label} reabierto.")

        if body.steps:
            unknown = set(body.steps) - set(STEPS)
            if unknown:
                raise HTTPException(status_code=422, detail=f"Pasos desconocidos: {', '.join(sorted(unknown))}")
            if inc.status == "FALSE_POSITIVE":
                raise HTTPException(status_code=409, detail="El incidente está descartado como falso positivo. Reábrelo primero.")
            for step in STEPS:
                if step not in body.steps:
                    continue
                done = bool(body.steps[step])
                if done and step == "verified" and not (inc.rotated_at and inc.revoked_at):
                    raise HTTPException(
                        status_code=422,
                        detail="Para verificar, primero rota la credencial y revoca la anterior.",
                    )
                if done and not getattr(inc, f"{step}_at"):
                    setattr(inc, f"{step}_at", now)
                    setattr(inc, f"{step}_by", actor)
                    _append_audit(db, actor, f"SECRET_{step.upper()}", target, f"{_STEP_LABEL[step]}: {label}")
                elif not done and getattr(inc, f"{step}_at"):
                    setattr(inc, f"{step}_at", None)
                    setattr(inc, f"{step}_by", None)
                    _append_audit(db, actor, "SECRET_STEP_UNDONE", target, f"{_STEP_LABEL[step]} desmarcado: {label}")
            if inc.verified_at and not (inc.rotated_at and inc.revoked_at):
                inc.verified_at = None
                inc.verified_by = None

        if body.owner_email is not None:
            owner = body.owner_email.strip().lower() or None
            if owner != inc.owner_email:
                inc.owner_email = owner
                _append_audit(db, actor, "SECRET_ASSIGNED", target, f"{label} asignado a {owner or 'nadie'}")

        if body.notes is not None:
            inc.notes = body.notes.strip() or None

        if inc.status != "FALSE_POSITIVE":
            previous = inc.status
            inc.status = _derive_status(inc)
            if inc.status == "RESOLVED" and previous != "RESOLVED":
                inc.resolved_at = now
                fixed = _set_findings_status(db, _linked_findings(db, inc), "FIXED")
                _append_audit(
                    db,
                    actor,
                    "SECRET_RESOLVED",
                    target,
                    f"{label} resuelto: rotado, revocado, historial limpio y verificado. {fixed} hallazgo(s) marcados como corregidos.",
                )
            elif inc.status != "RESOLVED":
                inc.resolved_at = None

        if repo:
            _refresh_repo_counters(db, repo)
        inc.updated_at = now
        db.commit()
        db.refresh(inc)
        return _out(db, inc, _repo_names(db))
    finally:
        db.close()
