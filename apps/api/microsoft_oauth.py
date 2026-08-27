import os
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from oauth_common import consume_state, frontend_redirect, issue_state, save_session

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
async def microsoft_login():
    if not (MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET):
        return frontend_redirect("oauth_error=microsoft_not_configured")

    params = urlencode(
        {
            "client_id": MICROSOFT_CLIENT_ID,
            "redirect_uri": MICROSOFT_REDIRECT_URI,
            "response_type": "code",
            "response_mode": "query",
            "scope": "openid profile email User.Read",
            "state": issue_state(),
            "prompt": "select_account",
        }
    )
    return RedirectResponse(f"{_authority()}/authorize?{params}", status_code=302)


@router.get("/microsoft/callback")
async def microsoft_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        return frontend_redirect(f"oauth_error={error}")
    if not code or not consume_state(state):
        return frontend_redirect("oauth_error=invalid_state")

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
                    "scope": "openid profile email User.Read",
                },
                headers={"Accept": "application/json"},
            )
            token_res.raise_for_status()
            access_token = token_res.json().get("access_token")
            if not access_token:
                return frontend_redirect("oauth_error=no_access_token")

            user_res = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_res.raise_for_status()
            profile = user_res.json()
    except httpx.HTTPError:
        return frontend_redirect("oauth_error=microsoft_http")

    email = profile.get("mail") or profile.get("userPrincipalName")
    if not email:
        return frontend_redirect("oauth_error=microsoft_no_email")

    session_id = save_session(
        email=email,
        name=profile.get("displayName") or email.split("@")[0],
        provider="microsoft",
        microsoft_id=profile.get("id"),
    )
    return frontend_redirect(f"sspillowy_session={session_id}")
