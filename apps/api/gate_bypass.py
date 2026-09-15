"""Solicitudes de bypass CISO del Security Gate (hub, sin Pulse)."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from auth_deps import require_hub_read, require_hub_write
from database import SessionLocal, db_ping
from models import AuditEvent, GateBypassRequest, Repository

router = APIRouter(prefix="/api/v1/security-gates/bypasses", tags=["Security Gates"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _admin_emails() -> set[str]:
    raw = os.getenv("PILLOW_ADMIN_EMAILS", "") + "," + os.getenv("SECURITY_ALERT_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _can_approve(email: str | None) -> bool:
    if not email:
        return False
    admins = _admin_emails()
    # Sin lista de admins: cualquier sesión autenticada puede aprobar (demo hub)
    if not admins:
        return True
    return email.strip().lower() in admins


class BypassCreate(BaseModel):
    reason: str = Field(min_length=8, max_length=2000)
    repository_id: Optional[str] = None
    expires_hours: int = Field(default=24, ge=1, le=168)


class BypassDecision(BaseModel):
    note: Optional[str] = Field(default=None, max_length=1000)


class BypassResponse(BaseModel):
    id: str
    repository_id: Optional[str] = None
    repository_name: Optional[str] = None
    reason: str
    status: str
    requested_by: str
    decided_by: Optional[str] = None
    decision_note: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    decided_at: Optional[datetime] = None


def _out(row: GateBypassRequest, repo_name: str | None = None) -> BypassResponse:
    return BypassResponse(
        id=row.id,
        repository_id=row.repository_id,
        repository_name=repo_name,
        reason=row.reason,
        status=row.status,
        requested_by=row.requested_by,
        decided_by=row.decided_by,
        decision_note=row.decision_note,
        expires_at=row.expires_at,
        created_at=row.created_at,
        decided_at=row.decided_at,
    )


def _require_db() -> None:
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible")


def _append_audit(db, actor: str, action: str, target: str, detail: str) -> None:
    db.add(
        AuditEvent(
            id=str(uuid.uuid4()),
            action=action,
            target=target,
            detail=detail[:2000],
            actor_email=actor[:255] if actor else None,
            created_at=_now(),
        )
    )


def expire_stale_bypasses(db) -> int:
    now = _now()
    rows = (
        db.query(GateBypassRequest)
        .filter(GateBypassRequest.status == "APPROVED", GateBypassRequest.expires_at.isnot(None))
        .filter(GateBypassRequest.expires_at < now)
        .all()
    )
    for r in rows:
        r.status = "EXPIRED"
    return len(rows)


def find_active_bypass(db, repository_id: str | None) -> GateBypassRequest | None:
    """Bypass APPROVED vigente: del repo o a nivel org (repository_id NULL)."""
    expire_stale_bypasses(db)
    now = _now()
    q = (
        db.query(GateBypassRequest)
        .filter(GateBypassRequest.status == "APPROVED")
        .filter((GateBypassRequest.expires_at.is_(None)) | (GateBypassRequest.expires_at >= now))
        .order_by(GateBypassRequest.created_at.desc())
    )
    rows = q.all()
    for r in rows:
        if repository_id and r.repository_id == repository_id:
            return r
    for r in rows:
        if r.repository_id is None:
            return r
    return None


@router.get("", response_model=List[BypassResponse])
async def list_bypasses(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    _auth=Depends(require_hub_read),
):
    _require_db()
    db = SessionLocal()
    try:
        expire_stale_bypasses(db)
        db.commit()
        q = db.query(GateBypassRequest).order_by(GateBypassRequest.created_at.desc())
        if status_filter:
            q = q.filter(GateBypassRequest.status == status_filter.upper())
        rows = q.limit(50).all()
        names = {}
        for r in rows:
            if r.repository_id and r.repository_id not in names:
                repo = db.get(Repository, r.repository_id)
                names[r.repository_id] = repo.name if repo else None
        return [_out(r, names.get(r.repository_id)) for r in rows]
    finally:
        db.close()


@router.post("", response_model=BypassResponse, status_code=status.HTTP_201_CREATED)
async def create_bypass(body: BypassCreate, session=Depends(require_hub_write)):
    _require_db()
    email = (session.get("email") or "unknown").strip().lower()
    db = SessionLocal()
    try:
        repo_name = None
        if body.repository_id:
            repo = db.get(Repository, body.repository_id)
            if not repo:
                raise HTTPException(status_code=404, detail="Repositorio no encontrado")
            repo_name = repo.name

        row = GateBypassRequest(
            id=str(uuid.uuid4()),
            repository_id=body.repository_id,
            reason=body.reason.strip(),
            status="PENDING",
            requested_by=email,
            expires_at=_now() + timedelta(hours=body.expires_hours),
            created_at=_now(),
        )
        db.add(row)
        target = repo_name or "organización"
        _append_audit(
            db,
            email,
            "GATE_BYPASS_REQUESTED",
            target,
            f"Motivo: {body.reason.strip()[:400]} · expira en {body.expires_hours}h",
        )
        db.commit()
        db.refresh(row)
        return _out(row, repo_name)
    finally:
        db.close()


@router.post("/{bypass_id}/approve", response_model=BypassResponse)
async def approve_bypass(bypass_id: str, body: BypassDecision | None = None, session=Depends(require_hub_write)):
    _require_db()
    email = (session.get("email") or "").strip().lower()
    if not _can_approve(email):
        raise HTTPException(status_code=403, detail="Solo administradores CISO pueden aprobar bypass.")
    db = SessionLocal()
    try:
        row = db.get(GateBypassRequest, bypass_id)
        if not row:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        if row.status != "PENDING":
            raise HTTPException(status_code=409, detail=f"Estado actual: {row.status}")
        row.status = "APPROVED"
        row.decided_by = email
        row.decided_at = _now()
        row.decision_note = (body.note if body else None) or None
        if not row.expires_at or row.expires_at < _now():
            row.expires_at = _now() + timedelta(hours=24)
        repo = db.get(Repository, row.repository_id) if row.repository_id else None
        target = repo.name if repo else "organización"
        _append_audit(
            db,
            email,
            "GATE_BYPASS_APPROVED",
            target,
            f"Bypass {row.id[:8]}… hasta {row.expires_at.isoformat() if row.expires_at else 'sin fecha'}",
        )
        db.commit()
        db.refresh(row)
        return _out(row, repo.name if repo else None)
    finally:
        db.close()


@router.post("/{bypass_id}/reject", response_model=BypassResponse)
async def reject_bypass(bypass_id: str, body: BypassDecision | None = None, session=Depends(require_hub_write)):
    _require_db()
    email = (session.get("email") or "").strip().lower()
    if not _can_approve(email):
        raise HTTPException(status_code=403, detail="Solo administradores CISO pueden rechazar bypass.")
    db = SessionLocal()
    try:
        row = db.get(GateBypassRequest, bypass_id)
        if not row:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        if row.status != "PENDING":
            raise HTTPException(status_code=409, detail=f"Estado actual: {row.status}")
        row.status = "REJECTED"
        row.decided_by = email
        row.decided_at = _now()
        row.decision_note = (body.note if body else None) or None
        repo = db.get(Repository, row.repository_id) if row.repository_id else None
        target = repo.name if repo else "organización"
        _append_audit(db, email, "GATE_BYPASS_REJECTED", target, f"Bypass {row.id[:8]}… rechazado")
        db.commit()
        db.refresh(row)
        return _out(row, repo.name if repo else None)
    finally:
        db.close()
