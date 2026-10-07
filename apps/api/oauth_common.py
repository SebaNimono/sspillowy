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
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import RedirectResponse

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey_change_me_in_production_123456789").strip()

# Caché/fallback en RAM; cada entrada lleva expires_at y se valida igual que en Postgres
SESSIONS: dict[str, dict] = {}

SESSION_TTL_HOURS = float(os.getenv("SESSION_TTL_HOURS", "12"))
SESSION_REMEMBER_DAYS = float(os.getenv("SESSION_REMEMBER_DAYS", "30"))


def session_ttl(remember: bool) -> timedelta:
    return timedelta(days=SESSION_REMEMBER_DAYS) if remember else timedelta(hours=SESSION_TTL_HOURS)

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def frontend_redirect(query: str) -> RedirectResponse:
    return RedirectResponse(f"{FRONTEND_URL}/?{query}", status_code=302)


def redirect_oauth_error(code: str, detail: str = "") -> RedirectResponse:
    q = f"oauth_error={quote(code, safe='')}"
    if detail:
        q += f"&oauth_detail={quote(detail[:180], safe='')}"
    return frontend_redirect(q)


def issue_state(remember: bool = False) -> str:
    """State firmado (sobrevive redeploys de Railway; no depende de RAM)."""
    data = {"n": secrets.token_urlsafe(8), "t": int(datetime.now(timezone.utc).timestamp())}
    if remember:
        data["r"] = 1
    payload = base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")
    sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()[:20]
    return f"{payload}.{sig}"


def consume_state(state: str | None) -> dict | None:
    """Devuelve el payload del state si es válido y reciente; None si no."""
    if not state or "." not in state:
        return None
    payload, sig = state.rsplit(".", 1)
    expected = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()[:20]
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        pad = "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload + pad).decode())
        issued = datetime.fromtimestamp(data["t"], tz=timezone.utc)
    except (ValueError, KeyError, json.JSONDecodeError):
        return None
    if datetime.now(timezone.utc) - issued > timedelta(minutes=10):
        return None
    return data


def state_remember(state_data: dict | None) -> bool:
    return bool((state_data or {}).get("r"))


def save_session(
    *,
    email: str,
    name: str,
    provider: str,
    avatar_url: str | None = None,
    provider_subject: str | None = None,
    remember: bool = False,
    **_extra: object,
) -> str:
    """Upsert usuario en Supabase/Postgres + sesión. Fallback a RAM si falla la DB."""
    session_id = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + session_ttl(remember)
    payload = {
        "id": session_id,
        "email": email,
        "name": name,
        "avatar_url": avatar_url,
        "provider": provider,
        "remember": remember,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
    }

    try:
        from database import SessionLocal
        from models import AuthSession, User

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            now = datetime.now(timezone.utc)
            if user:
                user.name = name or user.name
                user.avatar_url = avatar_url or user.avatar_url
                # No pisar google/github si solo están definiendo password para Pulse
                if provider != "password" or not user.provider:
                    user.provider = provider
                if provider_subject:
                    user.provider_subject = provider_subject
                if provider != "password":
                    user.email_verified = True
                    user.verification_token = None
                    user.verification_token_expires_at = None
                user.last_login_at = now
            else:
                user = User(
                    id=str(uuid.uuid4()),
                    email=email,
                    name=name,
                    avatar_url=avatar_url,
                    provider=provider,
                    provider_subject=provider_subject,
                    email_verified=provider != "password",
                    created_at=now,
                    last_login_at=now,
                )
                db.add(user)
                db.flush()

            db.add(
                AuthSession(
                    id=session_id,
                    user_id=user.id,
                    provider=provider,
                    expires_at=expires_at,
                    created_at=now,
                )
            )
            db.commit()
            payload["user_id"] = user.id
        finally:
            db.close()
    except Exception as exc:
        print(f"[sspillowy] save_session DB fallback: {exc}")

    SESSIONS[session_id] = payload
    return session_id


def _expired(iso: str | None) -> bool:
    if not iso:
        return True
    try:
        exp = datetime.fromisoformat(iso)
    except ValueError:
        return True
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp < datetime.now(timezone.utc)


def load_session(session_id: str) -> dict | None:
    mem = SESSIONS.get(session_id)
    if mem:
        if not _expired(mem.get("expires_at")):
            return mem
        SESSIONS.pop(session_id, None)
        return None

    try:
        from database import SessionLocal
        from models import AuthSession, User

        db = SessionLocal()
        try:
            row = (
                db.query(AuthSession, User)
                .join(User, User.id == AuthSession.user_id)
                .filter(AuthSession.id == session_id)
                .first()
            )
            if not row:
                return None
            auth, user = row
            exp = auth.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                return None
            data = {
                "id": auth.id,
                "email": user.email,
                "name": user.name,
                "avatar_url": user.avatar_url,
                "provider": auth.provider,
                "user_id": user.id,
                "created_at": (auth.created_at or datetime.now(timezone.utc)).isoformat(),
                "expires_at": exp.isoformat(),
            }
            SESSIONS[session_id] = data
            return data
        finally:
            db.close()
    except Exception as exc:
        print(f"[sspillowy] load_session DB error: {exc}")
        return None


def delete_session(session_id: str) -> None:
    SESSIONS.pop(session_id, None)
    try:
        from database import SessionLocal
        from models import AuthSession

        db = SessionLocal()
        try:
            db.query(AuthSession).filter(AuthSession.id == session_id).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()
    except Exception as exc:
        print(f"[sspillowy] delete_session DB error: {exc}")


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
    session = load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sesión OAuth no encontrada o expirada")
    return session


@router.post("/logout")
async def logout(x_session_id: str | None = Header(default=None, alias="X-Session-Id")):
    if x_session_id and x_session_id.strip():
        delete_session(x_session_id.strip())
    return {"ok": True}
