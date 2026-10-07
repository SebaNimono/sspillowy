import os
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from oauth_common import (
    consume_state,
    frontend_redirect,
    issue_state,
    map_microsoft_token_error,
    redirect_oauth_error,
    save_session,
    state_remember,
)

MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID", "").strip()
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "").strip()
MICROSOFT_TENANT = os.getenv("MICROSOFT_TENANT", "common").strip() or "common"
MICROSOFT_REDIRECT_URI = os.getenv(
    "MICROSOFT_REDIRECT_URI",
    "http://localhost:8000/api/v1/auth/microsoft/callback",
).strip()

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def _authority() -> str:
    return f"https://login.microsoftonline.com/{MICROSOFT_TENANT}/oauth2/v2.0"


@router.get("/microsoft")
async def microsoft_login(remember: bool = False, login_hint: str | None = None):
    if not (MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET):
        return redirect_oauth_error("microsoft_not_configured")

    query = {
        "client_id": MICROSOFT_CLIENT_ID,
        "redirect_uri": MICROSOFT_REDIRECT_URI,
        "response_type": "code",
        "response_mode": "query",
        "scope": "openid profile email User.Read",
        "state": issue_state(remember),
    }
    hint = (login_hint or "").strip()
    if hint:
        query["login_hint"] = hint
    else:
        query["prompt"] = "select_account"
    params = urlencode(query)
    return RedirectResponse(f"{_authority()}/authorize?{params}", status_code=302)


@router.get("/microsoft/callback")
async def microsoft_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        return redirect_oauth_error(error)
    state_data = consume_state(state)
    if not code or not state_data:
        return redirect_oauth_error("invalid_state")

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_res = await client.post(
                f"{_authority()}/token",
                data={
                    "client_id": MICROSOFT_CLIENT_ID,
                    "client_secret": MICROSOFT_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": MICROSOFT_REDIRECT_URI,
                },
                headers={"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"},
            )
            if token_res.is_error:
                code_key, detail = map_microsoft_token_error(token_res)
                return redirect_oauth_error(code_key, detail)

            access_token = token_res.json().get("access_token")
            if not access_token:
                return redirect_oauth_error("no_access_token")

            user_res = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if user_res.is_error:
                return redirect_oauth_error("microsoft_profile_http", user_res.text[:120])

            profile = user_res.json()
    except httpx.HTTPError as exc:
        return redirect_oauth_error("microsoft_http", str(exc)[:120])

    email = profile.get("mail") or profile.get("userPrincipalName")
    if not email:
        return redirect_oauth_error("microsoft_no_email")

    session_id = save_session(
        remember=state_remember(state_data),
        email=email,
        name=profile.get("displayName") or email.split("@")[0],
        provider="microsoft",
        provider_subject=str(profile.get("id") or ""),
    )
    return frontend_redirect(f"sspillowy_session={session_id}")
