import os
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from oauth_common import consume_state, frontend_redirect, issue_state, save_session

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:8000/api/v1/auth/google/callback",
).strip()

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.get("/google")
async def google_login():
    if not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET):
        return frontend_redirect("oauth_error=google_not_configured")

    params = urlencode(
        {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "state": issue_state(),
            "access_type": "online",
            "prompt": "select_account",
        }
    )
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}", status_code=302)


@router.get("/google/callback")
async def google_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        return frontend_redirect(f"oauth_error={error}")
    if not code or not consume_state(state):
        return frontend_redirect("oauth_error=invalid_state")

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                },
                headers={"Accept": "application/json"},
            )
            token_res.raise_for_status()
            access_token = token_res.json().get("access_token")
            if not access_token:
                return frontend_redirect("oauth_error=no_access_token")

            user_res = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_res.raise_for_status()
            profile = user_res.json()
    except httpx.HTTPError:
        return frontend_redirect("oauth_error=google_http")

    email = profile.get("email")
    if not email:
        return frontend_redirect("oauth_error=google_no_email")

    session_id = save_session(
        email=email,
        name=profile.get("name") or email.split("@")[0],
        avatar_url=profile.get("picture"),
        provider="google",
    )
    return frontend_redirect(f"sspillowy_session={session_id}")
