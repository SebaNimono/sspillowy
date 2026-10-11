"""Espacios de trabajo: aislamiento de datos entre cuentas e invitaciones.

Cada repositorio pertenece a un espacio. Todo lo que cuelga de un repositorio (análisis, hallazgos,
SBOM, secretos) hereda su espacio; lo que no (bitácora, automatizaciones, dashboards, excepciones,
gate y cumplimiento) guarda su propio workspace_id. Una cuenta nueva recibe un espacio vacío y solo
ve otro si alguien la invita.
"""

from __future__ import annotations

import html
import os
import re
import threading
import time
import uuid
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import event, func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from auth_deps import resolve_session
from database import SessionLocal
from models import AuditEvent, Repository, Workspace, WorkspaceMember

ROLES = ("owner", "admin", "member", "viewer")
ROLE_LABEL = {"owner": "Propietario", "admin": "Administrador", "member": "Miembro", "viewer": "Solo lectura"}
NO_REPO = "__none__"
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def legacy_owner() -> str:
    return (os.getenv("LEGACY_WORKSPACE_OWNER") or "seba.tralma.dev@gmail.com").strip().lower()


def platform_admins() -> set[str]:
    raw = os.getenv("PLATFORM_ADMIN_EMAILS", "").strip()
    emails = {e.strip().lower() for e in raw.split(",") if e.strip()}
    return emails or {legacy_owner()}


@dataclass
class WorkspaceCtx:
    id: str
    name: str
    role: str
    email: str
    user_id: Optional[str]
    user_name: str
    repo_ids: list[str] = field(default_factory=list)

    @property
    def scope_ids(self) -> list[str]:
        """Ids de repositorio para filtros IN (nunca vacío: una lista vacía significaría "todos")."""
        return self.repo_ids or [NO_REPO]

    @property
    def can_write(self) -> bool:
        return self.role != "viewer"

    @property
    def can_manage(self) -> bool:
        return self.role in ("owner", "admin")

    @property
    def actor(self) -> str:
        return self.email

    def session(self) -> Session:
        db = SessionLocal()
        db.info["workspace_id"] = self.id
        return db

    def has_repo(self, repo_id: Optional[str]) -> bool:
        return bool(repo_id) and repo_id in self.repo_ids

    def require_repo(self, repo_id: Optional[str]) -> None:
        if not self.has_repo(repo_id):
            raise HTTPException(status_code=404, detail="Repositorio no encontrado")


@event.listens_for(Session, "before_flush")
def _fill_workspace(session: Session, _ctx, _instances) -> None:
    ws = session.info.get("workspace_id")
    if not ws:
        return
    for obj in session.new:
        if hasattr(obj, "workspace_id") and getattr(obj, "workspace_id", None) is None:
            obj.workspace_id = ws


def session_for_repo(repo: Repository | None) -> Session:
    """Sesión para jobs en background: lo que creen queda en el espacio del repositorio."""
    db = SessionLocal()
    if repo is not None and repo.workspace_id:
        db.info["workspace_id"] = repo.workspace_id
    return db


def bind_session(db: Session, workspace_id: Optional[str]) -> None:
    if workspace_id:
        db.info["workspace_id"] = workspace_id


# ---------------------------------------------------------------------------
# Resolución del espacio activo
# ---------------------------------------------------------------------------

_create_lock = threading.Lock()


def _personal_name(name: str, email: str) -> str:
    first = (name or "").strip().split(" ")[0] or email.split("@")[0]
    return f"Espacio de {first}"


def _ensure_membership(db: Session, email: str, name: str) -> list[WorkspaceMember]:
    """Toda persona tiene su espacio propio; si llegó por invitación, el primer ingreso abre ese espacio."""
    rows = db.query(WorkspaceMember).filter(WorkspaceMember.email == email).all()
    if any(m.role == "owner" for m in rows):
        return rows
    with _create_lock:
        rows = db.query(WorkspaceMember).filter(WorkspaceMember.email == email).all()
        if any(m.role == "owner" for m in rows):
            return rows
        ws = Workspace(id=str(uuid.uuid4()), name=_personal_name(name, email), created_by=email, created_at=_now())
        db.add(ws)
        db.flush()
        invited = sorted(rows, key=lambda m: m.created_at or datetime.min, reverse=True)
        if invited and not any(m.last_used_at for m in rows):
            invited[0].last_used_at = _now()
        m = WorkspaceMember(id=str(uuid.uuid4()), workspace_id=ws.id, email=email, role="owner",
                            invited_by=None, created_at=_now(), last_used_at=None if invited else _now())
        db.add(m)
        db.commit()
        return rows + [m]


_CTX_TTL = 15.0
_ctx_cache: dict[tuple[str, Optional[str]], tuple[float, WorkspaceCtx]] = {}
_ctx_lock = threading.Lock()


def invalidate_workspace_cache() -> None:
    """Llamar tras cambiar miembros o repositorios de un espacio."""
    with _ctx_lock:
        _ctx_cache.clear()


def resolve_workspace(session: dict, requested: Optional[str]) -> WorkspaceCtx:
    email = (session.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Sesión sin correo. Vuelve a iniciar sesión.")
    key = (email, requested)
    now = time.monotonic()
    with _ctx_lock:
        hit = _ctx_cache.get(key)
    if hit and hit[0] > now:
        return replace(hit[1], repo_ids=list(hit[1].repo_ids))
    ctx = _resolve_workspace(session, email, requested)
    with _ctx_lock:
        if len(_ctx_cache) > 5000:
            _ctx_cache.clear()
        _ctx_cache[key] = (now + _CTX_TTL, ctx)
    return replace(ctx, repo_ids=list(ctx.repo_ids))


def _resolve_workspace(session: dict, email: str, requested: Optional[str]) -> WorkspaceCtx:
    name = session.get("name") or email
    db = SessionLocal()
    try:
        members = _ensure_membership(db, email, name)
        chosen = None
        if requested:
            chosen = next((m for m in members if m.workspace_id == requested), None)
        if chosen is None:
            def rank(m: WorkspaceMember):
                used = m.last_used_at or m.created_at or datetime.min
                if used.tzinfo is None:
                    used = used.replace(tzinfo=timezone.utc)
                return (m.last_used_at is not None, used)
            chosen = max(members, key=rank)
        last = chosen.last_used_at
        if last is not None and last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if last is None or _now() - last > timedelta(minutes=30):
            chosen.last_used_at = _now()
            db.commit()
        ws = db.get(Workspace, chosen.workspace_id)
        repo_ids = [rid for (rid,) in db.query(Repository.id).filter(Repository.workspace_id == chosen.workspace_id).all()]
        return WorkspaceCtx(
            id=chosen.workspace_id,
            name=ws.name if ws else "Espacio",
            role=chosen.role,
            email=email,
            user_id=session.get("user_id"),
            user_name=name,
            repo_ids=repo_ids,
        )
    finally:
        db.close()


def require_ws(
    x_session_id: Annotated[Optional[str], Header(alias="X-Session-Id")] = None,
    authorization: Annotated[Optional[str], Header()] = None,
    x_workspace_id: Annotated[Optional[str], Header(alias="X-Workspace-Id")] = None,
) -> WorkspaceCtx:
    try:
        session = resolve_session(x_session_id, authorization)
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Base de datos no disponible.")
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión requerida. Inicia sesión en el hub.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return resolve_workspace(session, (x_workspace_id or "").strip() or None)
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Base de datos no disponible.")


def require_ws_write(ctx: WorkspaceCtx = Depends(require_ws)) -> WorkspaceCtx:
    if not ctx.can_write:
        raise HTTPException(status_code=403, detail="Tu acceso a este espacio es de solo lectura.")
    return ctx


def require_ws_admin(ctx: WorkspaceCtx = Depends(require_ws)) -> WorkspaceCtx:
    if not ctx.can_manage:
        raise HTTPException(status_code=403, detail="Solo el propietario o un administrador del espacio puede hacer esto.")
    return ctx


# ---------------------------------------------------------------------------
# Migración de datos existentes
# ---------------------------------------------------------------------------

SCOPED_TABLES = (
    "repositories",
    "audit_events",
    "runbooks",
    "runbook_executions",
    "dashboard_views",
    "gate_bypass_requests",
    "compliance_snapshots",
)


def add_workspace_columns(conn) -> None:
    for table in SCOPED_TABLES:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS workspace_id TEXT"))
        conn.execute(text(f"CREATE INDEX IF NOT EXISTS ix_{table}_workspace_id ON {table} (workspace_id)"))


def legacy_workspace_id(db: Session) -> str:
    owner = legacy_owner()
    m = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.email == owner, WorkspaceMember.role == "owner")
        .order_by(WorkspaceMember.created_at.asc())
        .first()
    )
    if m:
        return m.workspace_id
    ws = Workspace(id=str(uuid.uuid4()), name="SSPILLOWY", created_by=owner, created_at=_now())
    db.add(ws)
    db.flush()
    db.add(WorkspaceMember(id=str(uuid.uuid4()), workspace_id=ws.id, email=owner, role="owner",
                           created_at=_now(), last_used_at=_now()))
    db.commit()
    return ws.id


def adopt_orphans(db: Session, workspace_id: Optional[str] = None) -> dict:
    """Asigna al espacio indicado (o al de LEGACY_WORKSPACE_OWNER) los datos que aún no tienen espacio."""
    if workspace_id is None:
        # Solo en la primera migración: después, un dato sin espacio no debe acabar en el de nadie.
        if db.query(Workspace.id).first() is not None:
            return {}
        orphans = db.execute(text("SELECT COUNT(*) FROM repositories WHERE workspace_id IS NULL")).scalar() or 0
        orphans += db.execute(text("SELECT COUNT(*) FROM audit_events WHERE workspace_id IS NULL")).scalar() or 0
        if not orphans and not db.execute(text("SELECT COUNT(*) FROM security_gates WHERE id = 'default-policy'")).scalar():
            return {}
        workspace_id = legacy_workspace_id(db)
    moved: dict[str, int] = {}
    for table in SCOPED_TABLES:
        res = db.execute(text(f"UPDATE {table} SET workspace_id = :ws WHERE workspace_id IS NULL"), {"ws": workspace_id})
        if res.rowcount:
            moved[table] = res.rowcount
    has_gate = db.execute(text("SELECT COUNT(*) FROM security_gates WHERE id = :ws"), {"ws": workspace_id}).scalar()
    if not has_gate:
        res = db.execute(text("UPDATE security_gates SET id = :ws WHERE id = 'default-policy'"), {"ws": workspace_id})
        if res.rowcount:
            moved["security_gates"] = res.rowcount
    db.commit()
    _copy_legacy_compliance(db, workspace_id, moved)
    return moved


def _copy_legacy_compliance(db: Session, workspace_id: str, moved: dict) -> None:
    for old, new in (
        ("compliance_frameworks", "ws_compliance_frameworks"),
        ("compliance_control_states", "ws_compliance_controls"),
    ):
        try:
            with db.begin_nested():
                exists = db.execute(text(f"SELECT COUNT(*) FROM {old}")).scalar()
                if not exists:
                    continue
                already = db.execute(
                    text(f"SELECT COUNT(*) FROM {new} WHERE workspace_id = :ws"), {"ws": workspace_id}
                ).scalar()
                if already:
                    continue
                cols = list(db.execute(text(f"SELECT * FROM {old} LIMIT 0")).keys())
                col_list = ", ".join(cols)
                db.execute(
                    text(f"INSERT INTO {new} (workspace_id, {col_list}) SELECT :ws, {col_list} FROM {old}"),
                    {"ws": workspace_id},
                )
                moved[new] = int(exists)
        except Exception as exc:
            print(f"[sspillowy] {old}: no se copió ({str(exc)[:120]})", flush=True)
    db.commit()


def bootstrap() -> None:
    db = SessionLocal()
    try:
        moved = adopt_orphans(db)
        if moved:
            print(f"[sspillowy] datos sin espacio asignados a {legacy_owner()}: {moved}", flush=True)
    except Exception as exc:
        db.rollback()
        print(f"[sspillowy] asignación de espacios omitida: {exc}", flush=True)
    finally:
        db.close()


def admin_recipients(db: Session, workspace_id: Optional[str]) -> list[str]:
    """Correos de propietarios y administradores del espacio (destinatarios de alertas)."""
    if not workspace_id:
        return []
    rows = (
        db.query(WorkspaceMember.email)
        .filter(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.role.in_(["owner", "admin"]))
        .all()
    )
    return sorted({e for (e,) in rows if e})


# ---------------------------------------------------------------------------
# API de espacios y miembros
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/v1/workspaces", tags=["Espacios de trabajo"])


def _audit(db: Session, ctx: WorkspaceCtx, action: str, target: str, detail: str = "") -> None:
    db.add(AuditEvent(id=str(uuid.uuid4()), workspace_id=ctx.id, action=action, target=target[:200],
                      detail=detail[:1000], actor_email=ctx.email, created_at=_now()))


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def _overview(db: Session, ctx: WorkspaceCtx) -> dict:
    mine = db.query(WorkspaceMember).filter(WorkspaceMember.email == ctx.email).all()
    ws_ids = [m.workspace_id for m in mine]
    names = {w.id: w.name for w in db.query(Workspace).filter(Workspace.id.in_(ws_ids)).all()} if ws_ids else {}
    member_counts = dict(
        db.query(WorkspaceMember.workspace_id, func.count(WorkspaceMember.id))
        .filter(WorkspaceMember.workspace_id.in_(ws_ids or [NO_REPO]))
        .group_by(WorkspaceMember.workspace_id)
        .all()
    )
    repo_counts = dict(
        db.query(Repository.workspace_id, func.count(Repository.id))
        .filter(Repository.workspace_id.in_(ws_ids or [NO_REPO]))
        .group_by(Repository.workspace_id)
        .all()
    )
    members = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == ctx.id)
        .order_by(WorkspaceMember.created_at.asc())
        .all()
    )
    from models import User

    emails = [m.email for m in members]
    users = {u.email.lower(): u for u in db.query(User).filter(func.lower(User.email).in_(emails)).all()} if emails else {}
    return {
        "current": {
            "id": ctx.id,
            "name": ctx.name,
            "role": ctx.role,
            "role_label": ROLE_LABEL.get(ctx.role, ctx.role),
            "can_manage": ctx.can_manage,
            "can_write": ctx.can_write,
            "repository_count": len(ctx.repo_ids),
        },
        "workspaces": sorted(
            [
                {
                    "id": m.workspace_id,
                    "name": names.get(m.workspace_id, "Espacio"),
                    "role": m.role,
                    "role_label": ROLE_LABEL.get(m.role, m.role),
                    "members": int(member_counts.get(m.workspace_id, 0)),
                    "repositories": int(repo_counts.get(m.workspace_id, 0)),
                }
                for m in mine
            ],
            key=lambda w: w["name"].lower(),
        ),
        "members": [
            {
                "id": m.id,
                "email": m.email,
                "name": users[m.email].name if m.email in users else None,
                "joined": m.email in users,
                "role": m.role,
                "role_label": ROLE_LABEL.get(m.role, m.role),
                "invited_by": m.invited_by,
                "created_at": _iso(m.created_at),
                "is_me": m.email == ctx.email,
            }
            for m in members
        ],
        "roles": [{"id": r, "label": ROLE_LABEL[r]} for r in ROLES if r != "owner"],
    }


@router.get("")
def get_workspaces(ctx: WorkspaceCtx = Depends(require_ws)):
    db = SessionLocal()
    try:
        return _overview(db, ctx)
    finally:
        db.close()


class RenameBody(BaseModel):
    name: str


@router.patch("/current")
def rename_workspace(body: RenameBody, ctx: WorkspaceCtx = Depends(require_ws_admin)):
    name = body.name.strip()
    if not 2 <= len(name) <= 60:
        raise HTTPException(status_code=422, detail="El nombre debe tener entre 2 y 60 caracteres.")
    db = SessionLocal()
    try:
        ws = db.get(Workspace, ctx.id)
        old = ws.name
        ws.name = name
        ctx.name = name
        _audit(db, ctx, "WORKSPACE_RENAMED", name, f"Antes: {old}")
        db.commit()
        invalidate_workspace_cache()
        return _overview(db, ctx)
    finally:
        db.close()


class InviteBody(BaseModel):
    email: str
    role: Literal["admin", "member", "viewer"] = "member"


def _send_invite(to: str, ctx: WorkspaceCtx) -> None:
    try:
        from email_service import mailer_configured, send_email_sync

        if not mailer_configured():
            return
        hub = os.getenv("FRONTEND_URL", "https://sspillowy.com").rstrip("/")
        who = html.escape(ctx.user_name or ctx.email)
        ws = html.escape(ctx.name)
        text_body = (
            f"Hola,\n\n{ctx.user_name or ctx.email} te invitó al espacio \"{ctx.name}\" en SSPILLOWY.\n\n"
            f"Entra con este correo ({to}) en {hub} y lo verás en el selector de espacios.\n"
        )
        html_body = (
            f"<p>Hola,</p><p><strong>{who}</strong> te invitó al espacio <strong>{ws}</strong> en SSPILLOWY.</p>"
            f"<p>Entra con este correo (<strong>{html.escape(to)}</strong>) en "
            f"<a href=\"{hub}\">{html.escape(hub)}</a> y lo verás en el selector de espacios.</p>"
        )
        send_email_sync(to=to, subject=f"Te invitaron a {ctx.name} — SSPILLOWY", text=text_body, html_body=html_body)
    except Exception as exc:
        print(f"[sspillowy] invitación no enviada a {to}: {exc}", flush=True)


@router.post("/current/members", status_code=201)
def invite_member(body: InviteBody, ctx: WorkspaceCtx = Depends(require_ws_admin)):
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Escribe un correo válido.")
    db = SessionLocal()
    try:
        exists = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == ctx.id, WorkspaceMember.email == email
        ).first()
        if exists:
            raise HTTPException(status_code=409, detail="Esa persona ya tiene acceso a este espacio.")
        db.add(WorkspaceMember(id=str(uuid.uuid4()), workspace_id=ctx.id, email=email, role=body.role,
                               invited_by=ctx.email, created_at=_now()))
        _audit(db, ctx, "WORKSPACE_MEMBER_INVITED", email, f"Rol: {ROLE_LABEL[body.role]}")
        db.commit()
        invalidate_workspace_cache()
        threading.Thread(target=_send_invite, args=(email, ctx), daemon=True).start()
        return _overview(db, ctx)
    finally:
        db.close()


class RoleBody(BaseModel):
    role: Literal["admin", "member", "viewer"]


@router.patch("/current/members/{member_id}")
def change_role(member_id: str, body: RoleBody, ctx: WorkspaceCtx = Depends(require_ws_admin)):
    db = SessionLocal()
    try:
        m = db.get(WorkspaceMember, member_id)
        if not m or m.workspace_id != ctx.id:
            raise HTTPException(status_code=404, detail="Miembro no encontrado.")
        if m.role == "owner":
            raise HTTPException(status_code=400, detail="No se puede cambiar el rol del propietario.")
        if m.email == ctx.email:
            raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol.")
        old = m.role
        m.role = body.role
        _audit(db, ctx, "WORKSPACE_MEMBER_ROLE", m.email, f"{ROLE_LABEL.get(old, old)} → {ROLE_LABEL[body.role]}")
        db.commit()
        invalidate_workspace_cache()
        return _overview(db, ctx)
    finally:
        db.close()


@router.delete("/current/members/{member_id}")
def remove_member(member_id: str, ctx: WorkspaceCtx = Depends(require_ws)):
    db = SessionLocal()
    try:
        m = db.get(WorkspaceMember, member_id)
        if not m or m.workspace_id != ctx.id:
            raise HTTPException(status_code=404, detail="Miembro no encontrado.")
        leaving = m.email == ctx.email
        if not leaving and not ctx.can_manage:
            raise HTTPException(status_code=403, detail="Solo el propietario o un administrador puede quitar miembros.")
        if m.role == "owner":
            raise HTTPException(status_code=400, detail="El propietario no puede salir ni ser quitado del espacio.")
        email = m.email
        db.delete(m)
        _audit(db, ctx, "WORKSPACE_MEMBER_LEFT" if leaving else "WORKSPACE_MEMBER_REMOVED", email)
        db.commit()
        invalidate_workspace_cache()
        if leaving:
            return {"ok": True, "left": True}
        return _overview(db, ctx)
    finally:
        db.close()
