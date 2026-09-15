"""Dependencias de autenticación para rutas del hub."""

from __future__ import annotations

import os
from typing import Annotated, Optional

from fastapi import Header, HTTPException, status

from oauth_common import load_session


def hub_auth_mode() -> str:
    """writes (default) | all | off"""
    raw = (os.getenv("HUB_AUTH_MODE") or "writes").strip().lower()
    if raw in ("off", "false", "0", "disabled"):
        return "off"
    if raw in ("all", "full", "strict"):
        return "all"
    return "writes"


def extract_session_id(
    x_session_id: Optional[str] = None,
    authorization: Optional[str] = None,
) -> Optional[str]:
    if x_session_id and x_session_id.strip():
        return x_session_id.strip()
    if authorization:
        parts = authorization.strip().split(None, 1)
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
            return parts[1].strip()
    return None


def resolve_session(
    x_session_id: Annotated[Optional[str], Header(alias="X-Session-Id")] = None,
    authorization: Annotated[Optional[str], Header()] = None,
) -> Optional[dict]:
    sid = extract_session_id(x_session_id, authorization)
    if not sid:
        return None
    return load_session(sid)


def require_session(
    x_session_id: Annotated[Optional[str], Header(alias="X-Session-Id")] = None,
    authorization: Annotated[Optional[str], Header()] = None,
) -> dict:
    session = resolve_session(x_session_id, authorization)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión requerida. Inicia sesión en el hub e incluye X-Session-Id.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return session


def require_hub_write(
    x_session_id: Annotated[Optional[str], Header(alias="X-Session-Id")] = None,
    authorization: Annotated[Optional[str], Header()] = None,
) -> Optional[dict]:
    """Exige sesión si HUB_AUTH_MODE es writes o all."""
    mode = hub_auth_mode()
    if mode == "off":
        return resolve_session(x_session_id, authorization)
    return require_session(x_session_id, authorization)


def require_hub_read(
    x_session_id: Annotated[Optional[str], Header(alias="X-Session-Id")] = None,
    authorization: Annotated[Optional[str], Header()] = None,
) -> Optional[dict]:
    """Exige sesión solo si HUB_AUTH_MODE=all."""
    mode = hub_auth_mode()
    if mode == "all":
        return require_session(x_session_id, authorization)
    return resolve_session(x_session_id, authorization)
