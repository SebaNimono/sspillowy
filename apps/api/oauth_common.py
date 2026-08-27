import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

_PENDING_STATES: dict[str, datetime] = {}
SESSIONS: dict[str, dict] = {}

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def frontend_redirect(query: str) -> RedirectResponse:
    return RedirectResponse(f"{FRONTEND_URL}/?{query}", status_code=302)


def issue_state() -> str:
    state = secrets.token_urlsafe(24)
    _PENDING_STATES[state] = datetime.now(timezone.utc)
    return state


def consume_state(state: str | None) -> bool:
    if not state or state not in _PENDING_STATES:
        return False
    issued = _PENDING_STATES.pop(state)
    return datetime.now(timezone.utc) - issued <= timedelta(minutes=10)


def save_session(**payload: object) -> str:
    session_id = uuid.uuid4().hex
    SESSIONS[session_id] = {
        "id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    return session_id


def env_configured(*keys: str) -> bool:
    return all(os.getenv(key, "").strip() for key in keys)


@router.get("/providers")
async def list_auth_providers():
    return {
        "github": env_configured("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"),
        "gitlab": env_configured("GITLAB_CLIENT_ID", "GITLAB_CLIENT_SECRET"),
        "google": env_configured("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
        "microsoft": env_configured("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"),
    }


@router.get("/session/{session_id}")
async def get_auth_session(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sesión OAuth no encontrada o expirada")
    return session
