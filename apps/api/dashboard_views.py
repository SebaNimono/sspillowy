"""Dashboards guardados: cada uno con su alcance de repositorios, periodo, bloques y umbrales.

El dashboard "General" no se guarda aquí: siempre existe y abarca toda la organización.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import SessionLocal, db_ping
from models import AuditEvent, DashboardView, Repository
from workspaces import WorkspaceCtx, require_ws, require_ws_write

router = APIRouter(prefix="/api/v1/dashboards", tags=["Dashboards"])

RANGES = (7, 30, 90)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def _require_db() -> None:
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible")


def _load(raw: str | None, fallback: Any) -> Any:
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return fallback


def _can_edit(view: DashboardView, email: str) -> bool:
    return not view.owner_email or not email or view.owner_email == email


def _out(view: DashboardView, email: str, repo_names: dict[str, str]) -> dict:
    repo_ids = [r for r in _load(view.repository_ids, []) if r in repo_names]
    starred = _load(view.starred_by, [])
    return {
        "id": view.id,
        "name": view.name,
        "description": view.description or "",
        "repository_ids": repo_ids,
        "repository_names": [repo_names[r] for r in repo_ids],
        "range_days": view.range_days or 30,
        "config": _load(view.config, None),
        "pillow_widgets": _load(view.pillow_widgets, []),
        "owner_email": view.owner_email,
        "shared": bool(view.shared),
        "starred": bool(email and email in starred),
        "star_count": len(starred),
        "can_edit": _can_edit(view, email),
        "created_at": _iso(view.created_at),
        "updated_at": _iso(view.updated_at),
    }


def _audit(db, action: str, target: str, actor: str) -> None:
    db.add(
        AuditEvent(
            id=str(uuid.uuid4()),
            action=action,
            target=target[:200],
            detail="",
            actor_email=actor or "web_hub",
            created_at=_now(),
        )
    )


def _repo_names(db, ws: WorkspaceCtx) -> dict[str, str]:
    rows = db.query(Repository.id, Repository.name).filter(Repository.workspace_id == ws.id).all()
    return {rid: name for rid, name in rows}


def _visible(view: DashboardView, email: str) -> bool:
    return bool(view.shared) or not view.owner_email or view.owner_email == email


def _get_view(db, view_id: str, ws: WorkspaceCtx) -> DashboardView:
    view = db.get(DashboardView, view_id)
    if not view or view.workspace_id != ws.id or not _visible(view, ws.email):
        raise HTTPException(status_code=404, detail="Dashboard no encontrado.")
    return view


@router.get("")
def list_dashboards(ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    email = ws.email
    db = SessionLocal()
    try:
        names = _repo_names(db, ws)
        rows = (
            db.query(DashboardView)
            .filter(DashboardView.workspace_id == ws.id)
            .order_by(DashboardView.updated_at.desc())
            .all()
        )
        return [_out(v, email, names) for v in rows if _visible(v, email)]
    finally:
        db.close()


@router.get("/{view_id}")
def get_dashboard(view_id: str, ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    db = SessionLocal()
    try:
        return _out(_get_view(db, view_id, ws), ws.email, _repo_names(db, ws))
    finally:
        db.close()


class DashboardBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=400)
    repository_ids: List[str] = Field(default_factory=list, max_length=200)
    range_days: int = 30
    config: Optional[dict[str, Any]] = None
    pillow_widgets: Optional[List[dict[str, Any]]] = None
    shared: bool = True


class DashboardPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=400)
    repository_ids: Optional[List[str]] = Field(default=None, max_length=200)
    range_days: Optional[int] = None
    config: Optional[dict[str, Any]] = None
    pillow_widgets: Optional[List[dict[str, Any]]] = None
    shared: Optional[bool] = None


def _check_range(value: int) -> int:
    if value not in RANGES:
        raise HTTPException(status_code=400, detail="El periodo debe ser 7, 30 o 90 días.")
    return value


def _clean_repo_ids(db, ws: WorkspaceCtx, ids: list[str]) -> list[str]:
    known = _repo_names(db, ws)
    return [r for r in dict.fromkeys(ids) if r in known]


@router.post("", status_code=201)
def create_dashboard(body: DashboardBody, ws: WorkspaceCtx = Depends(require_ws_write)):
    _require_db()
    email = ws.email
    db = ws.session()
    try:
        now = _now()
        view = DashboardView(
            id=str(uuid.uuid4()),
            name=body.name.strip(),
            description=body.description.strip(),
            repository_ids=json.dumps(_clean_repo_ids(db, ws, body.repository_ids)),
            range_days=_check_range(body.range_days),
            config=json.dumps(body.config) if body.config else None,
            pillow_widgets=json.dumps(body.pillow_widgets or []),
            owner_email=email or None,
            shared=body.shared,
            starred_by=json.dumps([]),
            created_at=now,
            updated_at=now,
        )
        db.add(view)
        _audit(db, "DASHBOARD_CREATED", view.name, email)
        db.commit()
        return _out(view, email, _repo_names(db, ws))
    finally:
        db.close()


@router.patch("/{view_id}")
def update_dashboard(view_id: str, body: DashboardPatch, ws: WorkspaceCtx = Depends(require_ws_write)):
    _require_db()
    email = ws.email
    db = ws.session()
    try:
        view = _get_view(db, view_id, ws)
        layout_only = body.model_dump(exclude_none=True).keys() <= {"pillow_widgets", "config", "range_days"}
        if not _can_edit(view, email) and not (view.shared and layout_only):
            raise HTTPException(status_code=403, detail="Solo quien creó este dashboard puede cambiar su nombre o alcance.")
        if body.name is not None:
            view.name = body.name.strip()
        if body.description is not None:
            view.description = body.description.strip()
        if body.repository_ids is not None:
            view.repository_ids = json.dumps(_clean_repo_ids(db, ws, body.repository_ids))
        if body.range_days is not None:
            view.range_days = _check_range(body.range_days)
        if body.config is not None:
            view.config = json.dumps(body.config)
        if body.pillow_widgets is not None:
            view.pillow_widgets = json.dumps(body.pillow_widgets)
        if body.shared is not None:
            view.shared = body.shared
        view.updated_at = _now()
        db.commit()
        return _out(view, email, _repo_names(db, ws))
    finally:
        db.close()


@router.post("/{view_id}/star")
def toggle_star(view_id: str, ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    email = ws.email
    db = ws.session()
    try:
        view = _get_view(db, view_id, ws)
        starred = _load(view.starred_by, [])
        if email in starred:
            starred.remove(email)
        else:
            starred.append(email)
        view.starred_by = json.dumps(starred)
        db.commit()
        return _out(view, email, _repo_names(db, ws))
    finally:
        db.close()


@router.post("/{view_id}/duplicate", status_code=201)
def duplicate_dashboard(view_id: str, ws: WorkspaceCtx = Depends(require_ws_write)):
    _require_db()
    email = ws.email
    db = ws.session()
    try:
        src = _get_view(db, view_id, ws)
        now = _now()
        view = DashboardView(
            id=str(uuid.uuid4()),
            name=f"{src.name} (copia)"[:80],
            description=src.description,
            repository_ids=src.repository_ids,
            range_days=src.range_days,
            config=src.config,
            pillow_widgets=src.pillow_widgets,
            owner_email=email or None,
            shared=src.shared,
            starred_by=json.dumps([]),
            created_at=now,
            updated_at=now,
        )
        db.add(view)
        _audit(db, "DASHBOARD_CREATED", view.name, email)
        db.commit()
        return _out(view, email, _repo_names(db, ws))
    finally:
        db.close()


@router.delete("/{view_id}")
def delete_dashboard(view_id: str, ws: WorkspaceCtx = Depends(require_ws_write)):
    _require_db()
    email = ws.email
    db = ws.session()
    try:
        view = _get_view(db, view_id, ws)
        if not _can_edit(view, email):
            raise HTTPException(status_code=403, detail="Solo quien creó este dashboard puede eliminarlo.")
        _audit(db, "DASHBOARD_DELETED", view.name, email)
        db.delete(view)
        db.commit()
        return {"ok": True}
    finally:
        db.close()
