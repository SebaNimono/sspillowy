"""Solicitudes de bypass CISO del Security Gate (hub, sin Pulse)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from database import db_ping
from models import AuditEvent, GateBypassRequest, Repository
from workspaces import WorkspaceCtx, require_ws, require_ws_write

router = APIRouter(prefix="/api/v1/security-gates/bypasses", tags=["Security Gates"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


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
        expires_at=_as_utc(row.expires_at),
        created_at=_as_utc(row.created_at) or _now(),
        decided_at=_as_utc(row.decided_at),
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
        .all()
    )
    expired_count = 0
    for r in rows:
        exp = _as_utc(r.expires_at)
        if exp is not None and exp < now:
            r.status = "EXPIRED"
            expired_count += 1
    return expired_count


def list_active_bypasses(db, workspace_id: str | None = None) -> list[GateBypassRequest]:
    """Todos los bypasses APPROVED vigentes del espacio."""
    expire_stale_bypasses(db)
    now = _now()
    rows = (
        db.query(GateBypassRequest)
        .filter(GateBypassRequest.status == "APPROVED")
        .filter(GateBypassRequest.workspace_id == (workspace_id or "__none__"))
        .order_by(GateBypassRequest.created_at.desc())
        .all()
    )
    active: list[GateBypassRequest] = []
    for r in rows:
        exp = _as_utc(r.expires_at)
        if exp is None or exp >= now:
            active.append(r)
    return active


def find_active_bypass(db, repository_id: str | None, workspace_id: str | None = None) -> GateBypassRequest | None:
    """Bypass APPROVED vigente del espacio: del repo o para todo el espacio (repository_id NULL)."""
    rows = list_active_bypasses(db, workspace_id)
    for r in rows:
        if repository_id and r.repository_id == repository_id:
            return r
    for r in rows:
        if r.repository_id is None:
            return r
    return None


@router.get("", response_model=List[BypassResponse])
def list_bypasses(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    ws: WorkspaceCtx = Depends(require_ws),
):
    _require_db()
    db = ws.session()
    try:
        expire_stale_bypasses(db)
        db.commit()
        q = (
            db.query(GateBypassRequest)
            .filter(GateBypassRequest.workspace_id == ws.id)
            .order_by(GateBypassRequest.created_at.desc())
        )
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
def create_bypass(body: BypassCreate, ws: WorkspaceCtx = Depends(require_ws_write)):
    _require_db()
    email = ws.email
    db = ws.session()
    try:
        repo_name = None
        repo_id = (body.repository_id or "").strip() or None
        if repo_id:
            ws.require_repo(repo_id)
            repo = db.get(Repository, repo_id)
            if not repo:
                raise HTTPException(status_code=404, detail="Repositorio no encontrado")
            repo_name = repo.name

        from gate_eval import gate_for

        auto = not gate_for(db, ws.id).require_ciso_approval_for_bypass
        now = _now()
        row = GateBypassRequest(
            id=str(uuid.uuid4()),
            workspace_id=ws.id,
            repository_id=repo_id,
            reason=body.reason.strip(),
            status="APPROVED" if auto else "PENDING",
            requested_by=email,
            decided_by=email if auto else None,
            decided_at=now if auto else None,
            expires_at=now + timedelta(hours=body.expires_hours),
            created_at=now,
        )
        db.add(row)
        target = repo_name or "organización"
        _append_audit(
            db,
            email,
            "GATE_BYPASS_APPROVED" if auto else "GATE_BYPASS_REQUESTED",
            target,
            f"Motivo: {body.reason.strip()[:400]} · expira en {body.expires_hours}h"
            + (" · sin aprobación previa (política del espacio)" if auto else ""),
        )
        db.commit()
        db.refresh(row)
        return _out(row, repo_name)
    finally:
        db.close()


@router.post("/{bypass_id}/approve", response_model=BypassResponse)
def approve_bypass(bypass_id: str, body: BypassDecision | None = None, ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    email = ws.email
    if not ws.can_manage:
        raise HTTPException(status_code=403, detail="Solo el propietario o un administrador del espacio puede aprobar excepciones.")
    db = ws.session()
    try:
        row = db.get(GateBypassRequest, bypass_id)
        if not row or row.workspace_id != ws.id:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        if row.status != "PENDING":
            raise HTTPException(status_code=409, detail=f"Estado actual: {row.status}")
        now = _now()
        created = _as_utc(row.created_at)
        exp = _as_utc(row.expires_at)
        if created and exp and exp > created:
            duration = exp - created
            new_exp = now + duration
        elif not exp or exp < now:
            new_exp = now + timedelta(hours=24)
        else:
            new_exp = exp
        row.status = "APPROVED"
        row.decided_by = email
        row.decided_at = now
        row.decision_note = ((body.note if body else None) or "").strip() or None
        row.expires_at = new_exp
        repo = db.get(Repository, row.repository_id) if row.repository_id else None
        target = repo.name if repo else "organización"
        note_suffix = f" · Nota: {row.decision_note}" if row.decision_note else ""
        _append_audit(
            db,
            email,
            "GATE_BYPASS_APPROVED",
            target,
            f"Bypass {row.id[:8]}… hasta {new_exp.isoformat()}{note_suffix}",
        )
        db.commit()
        db.refresh(row)
        return _out(row, repo.name if repo else None)
    finally:
        db.close()


@router.post("/{bypass_id}/reject", response_model=BypassResponse)
def reject_bypass(bypass_id: str, body: BypassDecision | None = None, ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    email = ws.email
    if not ws.can_manage:
        raise HTTPException(status_code=403, detail="Solo el propietario o un administrador del espacio puede rechazar excepciones.")
    db = ws.session()
    try:
        row = db.get(GateBypassRequest, bypass_id)
        if not row or row.workspace_id != ws.id:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        if row.status != "PENDING":
            raise HTTPException(status_code=409, detail=f"Estado actual: {row.status}")
        row.status = "REJECTED"
        row.decided_by = email
        row.decided_at = _now()
        row.decision_note = ((body.note if body else None) or "").strip() or None
        repo = db.get(Repository, row.repository_id) if row.repository_id else None
        target = repo.name if repo else "organización"
        note_suffix = f" · Nota: {row.decision_note}" if row.decision_note else ""
        _append_audit(db, email, "GATE_BYPASS_REJECTED", target, f"Bypass {row.id[:8]}… rechazado{note_suffix}")
        db.commit()
        db.refresh(row)
        return _out(row, repo.name if repo else None)
    finally:
        db.close()


@router.post("/{bypass_id}/revoke", response_model=BypassResponse)
def revoke_bypass(bypass_id: str, body: BypassDecision | None = None, ws: WorkspaceCtx = Depends(require_ws)):
    """Revoca una excepción activa o cancela una solicitud pendiente."""
    _require_db()
    email = ws.email
    db = ws.session()
    try:
        row = db.get(GateBypassRequest, bypass_id)
        if not row or row.workspace_id != ws.id:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        is_requester_pending = row.status == "PENDING" and (row.requested_by or "").lower() == email.lower()
        if not ws.can_manage and not is_requester_pending:
            raise HTTPException(
                status_code=403,
                detail="Solo el propietario o un administrador del espacio puede revocar excepciones.",
            )
        if row.status not in ("APPROVED", "PENDING"):
            raise HTTPException(status_code=409, detail=f"Estado actual: {row.status}")
        now = _now()
        was_pending = row.status == "PENDING"
        row.status = "EXPIRED"
        row.decided_by = email
        row.decided_at = now
        row.expires_at = now
        if body and body.note and body.note.strip():
            row.decision_note = body.note.strip()
        repo = db.get(Repository, row.repository_id) if row.repository_id else None
        target = repo.name if repo else "organización"
        action_label = "cancelada antes de aprobar" if was_pending else "revocada manualmente"
        _append_audit(
            db,
            email,
            "GATE_BYPASS_REVOKED",
            target,
            f"Bypass {row.id[:8]}… ({action_label})",
        )
        db.commit()
        db.refresh(row)
        return _out(row, repo.name if repo else None)
    finally:
        db.close()
