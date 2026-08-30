import base64
import hashlib
import hmac
import json
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey_change_me_in_production_123456789").strip()

SESSIONS: dict[str, dict] = {}

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def frontend_redirect(query: str) -> RedirectResponse:
    return RedirectResponse(f"{FRONTEND_URL}/?{query}", status_code=302)


def redirect_oauth_error(code: str, detail: str = "") -> RedirectResponse:
    q = f"oauth_error={quote(code, safe='')}"
    if detail:
        q += f"&oauth_detail={quote(detail[:180], safe='')}"
    return frontend_redirect(q)


def issue_state() -> str:
    """State firmado (sobrevive redeploys de Railway; no depende de RAM)."""
    payload = base64.urlsafe_b64encode(
        json.dumps({"n": secrets.token_urlsafe(8), "t": int(datetime.now(timezone.utc).timestamp())}).encode()
    ).decode().rstrip("=")
    sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()[:20]
    return f"{payload}.{sig}"


def consume_state(state: str | None) -> bool:
    if not state or "." not in state:
        return False
    payload, sig = state.rsplit(".", 1)
    expected = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()[:20]
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        pad = "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload + pad).decode())
        issued = datetime.fromtimestamp(data["t"], tz=timezone.utc)
    except (ValueError, KeyError, json.JSONDecodeError):
        return False
    return datetime.now(timezone.utc) - issued <= timedelta(minutes=10)


def save_session(**payload: object) -> str:
    session_id = uuid.uuid4().hex
    SESSIONS[session_id] = {
        "id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    return session_id


def map_google_token_error(response: httpx.Response) -> tuple[str, str]:
    try:
        body = response.json()
    except ValueError:
        return "google_http", response.text[:120]
    err = str(body.get("error", "unknown"))
    desc = str(body.get("error_description", ""))[:180]
    mapping = {
        "redirect_uri_mismatch": "google_redirect_mismatch",
        "invalid_client": "google_invalid_client",
        "invalid_grant": "google_invalid_grant",
        "access_denied": "access_denied",
    }
    return mapping.get(err, "google_http"), desc or err


def map_microsoft_token_error(response: httpx.Response) -> tuple[str, str]:
    try:
        body = response.json()
    except ValueError:
        return "microsoft_http", response.text[:120]
    desc = str(body.get("error_description", body.get("error", "")))[:220]
    upper = desc.upper()
    if "AADSTS50011" in upper or "REDIRECT URI" in upper:
        return "microsoft_redirect_mismatch", desc
    if "AADSTS7000215" in upper or "INVALID CLIENT SECRET" in upper or "CLIENT SECRET" in upper:
        return "microsoft_invalid_secret", desc
    if "AADSTS50194" in upper or "AADSTS90023" in upper:
        return "microsoft_accounts", desc
    if body.get("error") == "invalid_client":
        return "microsoft_invalid_client", desc
    return "microsoft_http", desc


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
