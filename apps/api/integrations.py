"""Integraciones del espacio: estado de lo que ya está conectado y canales de chat (Slack, Teams) para alertas."""

from __future__ import annotations

import hashlib
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import SessionLocal
from models import AuditEvent, Repository, SecurityGate, WorkspaceIntegration
from repo_access import decrypt, encrypt
from workspaces import WorkspaceCtx, admin_recipients, legacy_workspace_id, platform_admins, require_ws, require_ws_admin

router = APIRouter(prefix="/api/v1/integrations", tags=["Integraciones"])

ChatKind = Literal["slack", "teams"]
CHAT_NAME = {"slack": "Slack", "teams": "Microsoft Teams"}
GITHUB_HOOK = "github_webhook"
CI_KEY = "ci_key"
CI_KEY_PREFIX = "sspk_"
_TEAMS_HOSTS = (".webhook.office.com", ".logic.azure.com", ".powerplatform.com")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def _api_base() -> str:
    return (os.getenv("API_PUBLIC_URL") or "https://api.sspillowy.com").rstrip("/")


def _check_url(kind: str, url: str) -> str:
    u = url.strip()
    parsed = urlparse(u)
    host = (parsed.hostname or "").lower()
    ok = parsed.scheme == "https" and (
        host == "hooks.slack.com" if kind == "slack" else any(host.endswith(h) for h in _TEAMS_HOSTS)
    )
    if not ok:
        example = "https://hooks.slack.com/services/…" if kind == "slack" else "https://….webhook.office.com/… o un flujo de Teams"
        raise HTTPException(status_code=422, detail=f"Ese enlace no es un webhook de {CHAT_NAME[kind]}. Debe parecerse a {example}")
    return u


def _mask(url: str) -> str:
    host = urlparse(url).hostname or ""
    return f"{host}/…{url[-4:]}"


def _payload(kind: str, title: str, lines: list[str], link: str) -> dict:
    if kind == "slack":
        body = "\n".join(f"• {line}" for line in lines)
        return {"text": f"*{title}*\n{body}\n<{link}|Abrir SSPILLOWY>"}
    return {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [
                        {"type": "TextBlock", "text": title, "weight": "Bolder", "size": "Medium", "wrap": True},
                        *({"type": "TextBlock", "text": f"• {line}", "wrap": True, "spacing": "Small"} for line in lines),
                    ],
                    "actions": [{"type": "Action.OpenUrl", "title": "Abrir SSPILLOWY", "url": link}],
                },
            }
        ],
    }


def _post(row: WorkspaceIntegration, title: str, lines: list[str]) -> Optional[str]:
    """Publica el mensaje. Devuelve None si salió bien o el motivo del fallo."""
    link = os.getenv("FRONTEND_URL", "https://sspillowy.com").rstrip("/")
    try:
        res = httpx.post(row.url, json=_payload(row.kind, title, lines, link), timeout=8.0)
    except httpx.HTTPError:
        return f"No se pudo contactar con {CHAT_NAME[row.kind]}."
    if res.status_code >= 300:
        return f"{CHAT_NAME[row.kind]} rechazó el mensaje (código {res.status_code})."
    return None


def notify_chat(workspace_id: Optional[str], title: str, lines: list[str]) -> int:
    """Envía una alerta a los canales conectados del espacio. Devuelve cuántos la recibieron."""
    if not workspace_id:
        return 0
    db = SessionLocal()
    try:
        rows = (
            db.query(WorkspaceIntegration)
            .filter(
                WorkspaceIntegration.workspace_id == workspace_id,
                WorkspaceIntegration.kind.in_(list(CHAT_NAME)),
                WorkspaceIntegration.enabled.is_(True),
            )
            .all()
        )
        sent = 0
        for row in rows:
            err = _post(row, title, lines)
            if err:
                row.last_error = err
            else:
                row.last_ok_at, row.last_error = _now(), None
                sent += 1
        db.commit()
        return sent
    except Exception as exc:
        db.rollback()
        print(f"[sspillowy] alerta a canales no enviada: {exc}", flush=True)
        return 0
    finally:
        db.close()


def _audit(db, ctx: WorkspaceCtx, action: str, target: str) -> None:
    db.add(AuditEvent(id=str(uuid.uuid4()), workspace_id=ctx.id, action=action, target=target,
                      detail="", actor_email=ctx.email, created_at=_now()))


def _overview(db, ctx: WorkspaceCtx) -> dict:
    from email_service import mailer_configured

    repos = db.query(Repository.url).filter(Repository.workspace_id == ctx.id).all()
    urls = [(u or "").lower() for (u,) in repos]
    gate = db.get(SecurityGate, ctx.id)
    rows = {r.kind: r for r in db.query(WorkspaceIntegration).filter(WorkspaceIntegration.workspace_id == ctx.id).all()}
    chats = {k: v for k, v in rows.items() if k in CHAT_NAME}
    hook, key = rows.get(GITHUB_HOOK), rows.get(CI_KEY)
    legacy_hook = (
        hook is None
        and bool(os.getenv("GITHUB_WEBHOOK_SECRET", "").strip())
        and ctx.id == legacy_workspace_id(db)
    )
    platform = None
    if ctx.email in platform_admins():
        platform = {
            "prometheus": bool(os.getenv("METRICS_TOKEN", "").strip()),
            "metrics_url": f"{_api_base()}/metrics",
            "grafana_url": os.getenv("GRAFANA_URL", "").strip() or None,
        }
    return {
        "can_manage": ctx.can_manage,
        "github": {
            "repos": sum(1 for u in urls if "github.com" in u),
            "webhook_connected": bool(hook) or legacy_hook,
            "webhook_url": webhook_url(ctx.id) if not legacy_hook else f"{_api_base()}/api/v1/webhooks/github",
            "webhook_since": _iso(hook.updated_at) if hook else None,
            "webhook_last_event": _iso(hook.last_ok_at) if hook else None,
        },
        "gitlab": {"repos": sum(1 for u in urls if "gitlab" in u)},
        "bitbucket": {"repos": sum(1 for u in urls if "bitbucket.org" in u)},
        "azure": {"repos": sum(1 for u in urls if "dev.azure.com" in u or "visualstudio.com" in u)},
        "cicd": {
            "check_url": f"{_api_base()}/api/v1/security-gates/check",
            "gate_enabled": bool(gate and gate.enabled),
            "repos": len(urls),
            "key_ready": bool(key),
            "key_by": key.updated_by if key else None,
            "key_since": _iso(key.updated_at) if key else None,
            "key_last_used": _iso(key.last_ok_at) if key else None,
        },
        "email": {"ready": mailer_configured(), "recipients": admin_recipients(db, ctx.id)},
        "chat": {
            kind: (
                {
                    "connected": True,
                    "enabled": bool(chats[kind].enabled),
                    "target": _mask(chats[kind].url),
                    "last_ok_at": _iso(chats[kind].last_ok_at),
                    "last_error": chats[kind].last_error,
                    "updated_by": chats[kind].updated_by,
                }
                if kind in chats
                else {"connected": False}
            )
            for kind in CHAT_NAME
        },
        "platform": platform,
    }


def webhook_url(workspace_id: str) -> str:
    return f"{_api_base()}/api/v1/webhooks/github/{workspace_id}"


def webhook_secret(workspace_id: str) -> Optional[str]:
    db = SessionLocal()
    try:
        row = db.get(WorkspaceIntegration, (workspace_id, GITHUB_HOOK))
        return decrypt(row.url) if row and row.enabled else None
    finally:
        db.close()


def mark_webhook_event(workspace_id: str) -> None:
    db = SessionLocal()
    try:
        row = db.get(WorkspaceIntegration, (workspace_id, GITHUB_HOOK))
        if row:
            row.last_ok_at = _now()
            db.commit()
    finally:
        db.close()


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def workspace_for_ci_key(key: str) -> Optional[str]:
    """Espacio dueño de la clave del pipeline, o None si no existe."""
    key = (key or "").strip()
    if not key.startswith(CI_KEY_PREFIX):
        return None
    db = SessionLocal()
    try:
        row = (
            db.query(WorkspaceIntegration)
            .filter(WorkspaceIntegration.kind == CI_KEY, WorkspaceIntegration.url == _hash_key(key))
            .first()
        )
        if row is None:
            return None
        row.last_ok_at = _now()
        db.commit()
        return row.workspace_id
    finally:
        db.close()


def _store(db, ctx: WorkspaceCtx, kind: str, value: str) -> None:
    row = db.get(WorkspaceIntegration, (ctx.id, kind))
    if row is None:
        row = WorkspaceIntegration(workspace_id=ctx.id, kind=kind)
        db.add(row)
    row.url, row.enabled, row.last_error, row.last_ok_at = value, True, None, None
    row.updated_by, row.updated_at = ctx.email, _now()


@router.post("/github/webhook")
def create_github_webhook(ctx: WorkspaceCtx = Depends(require_ws_admin)):
    """Genera (o renueva) el secreto del webhook de GitHub del espacio. Se muestra una sola vez."""
    secret = secrets.token_hex(24)
    db = SessionLocal()
    try:
        _store(db, ctx, GITHUB_HOOK, encrypt(secret))
        _audit(db, ctx, "INTEGRATION_CONNECTED", "Webhook de GitHub")
        db.commit()
        return {"url": webhook_url(ctx.id), "secret": secret, "overview": _overview(db, ctx)}
    finally:
        db.close()


@router.delete("/github/webhook")
def delete_github_webhook(ctx: WorkspaceCtx = Depends(require_ws_admin)):
    db = SessionLocal()
    try:
        row = db.get(WorkspaceIntegration, (ctx.id, GITHUB_HOOK))
        if row is not None:
            db.delete(row)
            _audit(db, ctx, "INTEGRATION_REMOVED", "Webhook de GitHub")
            db.commit()
        return _overview(db, ctx)
    finally:
        db.close()


@router.post("/cicd/key")
def create_ci_key(ctx: WorkspaceCtx = Depends(require_ws_admin)):
    """Genera (o renueva) la clave que usa el pipeline para consultar el gate. Se muestra una sola vez."""
    key = CI_KEY_PREFIX + secrets.token_urlsafe(32)
    db = SessionLocal()
    try:
        _store(db, ctx, CI_KEY, _hash_key(key))
        _audit(db, ctx, "INTEGRATION_CONNECTED", "Clave del pipeline")
        db.commit()
        return {"key": key, "overview": _overview(db, ctx)}
    finally:
        db.close()


@router.delete("/cicd/key")
def delete_ci_key(ctx: WorkspaceCtx = Depends(require_ws_admin)):
    db = SessionLocal()
    try:
        row = db.get(WorkspaceIntegration, (ctx.id, CI_KEY))
        if row is not None:
            db.delete(row)
            _audit(db, ctx, "INTEGRATION_REMOVED", "Clave del pipeline")
            db.commit()
        return _overview(db, ctx)
    finally:
        db.close()


@router.get("")
def list_integrations(ctx: WorkspaceCtx = Depends(require_ws)):
    db = SessionLocal()
    try:
        return _overview(db, ctx)
    finally:
        db.close()


class ChatBody(BaseModel):
    url: str


@router.put("/{kind}")
def connect_chat(kind: ChatKind, body: ChatBody, ctx: WorkspaceCtx = Depends(require_ws_admin)):
    url = _check_url(kind, body.url)
    db = SessionLocal()
    try:
        row = db.get(WorkspaceIntegration, (ctx.id, kind))
        if row is None:
            row = WorkspaceIntegration(workspace_id=ctx.id, kind=kind)
            db.add(row)
        row.url, row.enabled, row.last_error = url, True, None
        row.updated_by, row.updated_at = ctx.email, _now()
        _audit(db, ctx, "INTEGRATION_CONNECTED", CHAT_NAME[kind])
        db.commit()
        return _overview(db, ctx)
    finally:
        db.close()


@router.delete("/{kind}")
def disconnect_chat(kind: ChatKind, ctx: WorkspaceCtx = Depends(require_ws_admin)):
    db = SessionLocal()
    try:
        row = db.get(WorkspaceIntegration, (ctx.id, kind))
        if row is not None:
            db.delete(row)
            _audit(db, ctx, "INTEGRATION_REMOVED", CHAT_NAME[kind])
            db.commit()
        return _overview(db, ctx)
    finally:
        db.close()


@router.post("/{kind}/test")
def test_chat(kind: ChatKind, ctx: WorkspaceCtx = Depends(require_ws_admin)):
    db = SessionLocal()
    try:
        row = db.get(WorkspaceIntegration, (ctx.id, kind))
        if row is None:
            raise HTTPException(status_code=404, detail=f"{CHAT_NAME[kind]} no está conectado.")
        err = _post(row, "Prueba de SSPILLOWY", [
            f"Este canal recibirá las alertas de seguridad de «{ctx.name}».",
            f"Conectado por {row.updated_by or ctx.email}.",
        ])
        if err:
            row.last_error = err
        else:
            row.last_ok_at, row.last_error = _now(), None
        db.commit()
        if err:
            raise HTTPException(status_code=502, detail=err)
        return _overview(db, ctx)
    finally:
        db.close()
