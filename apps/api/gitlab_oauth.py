import os
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from oauth_common import consume_state, frontend_redirect, issue_state, save_session, state_remember

GITLAB_BASE_URL = os.getenv("GITLAB_BASE_URL", "https://gitlab.com").rstrip("/")
GITLAB_CLIENT_ID = os.getenv("GITLAB_CLIENT_ID", "").strip()
GITLAB_CLIENT_SECRET = os.getenv("GITLAB_CLIENT_SECRET", "").strip()
GITLAB_REDIRECT_URI = os.getenv(
    "GITLAB_REDIRECT_URI",
    "http://localhost:8000/api/v1/auth/gitlab/callback",
).strip()

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.get("/gitlab")
async def gitlab_login(remember: bool = False):
    if not (GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET):
        return frontend_redirect("oauth_error=gitlab_not_configured")

    params = urlencode(
        {
            "client_id": GITLAB_CLIENT_ID,
            "redirect_uri": GITLAB_REDIRECT_URI,
            "response_type": "code",
            "scope": "read_user",
            "state": issue_state(remember),
        }
    )
    return RedirectResponse(f"{GITLAB_BASE_URL}/oauth/authorize?{params}", status_code=302)


@router.get("/gitlab/callback")
async def gitlab_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        return frontend_redirect(f"oauth_error={error}")
    state_data = consume_state(state)
    if not code or not state_data:
        return frontend_redirect("oauth_error=invalid_state")

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_res = await client.post(
                f"{GITLAB_BASE_URL}/oauth/token",
                data={
                    "client_id": GITLAB_CLIENT_ID,
                    "client_secret": GITLAB_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": GITLAB_REDIRECT_URI,
                },
                headers={"Accept": "application/json"},
            )
            token_res.raise_for_status()
            access_token = token_res.json().get("access_token")
            if not access_token:
                return frontend_redirect("oauth_error=no_access_token")

            user_res = await client.get(
                f"{GITLAB_BASE_URL}/api/v4/user",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_res.raise_for_status()
            profile = user_res.json()
    except httpx.HTTPError:
        return frontend_redirect("oauth_error=gitlab_http")

    username = profile.get("username") or "user"
    email = profile.get("email") or f"{username}@users.noreply.gitlab.com"
    session_id = save_session(
        remember=state_remember(state_data),
        email=email,
        name=profile.get("name") or username,
        avatar_url=profile.get("avatar_url"),
        provider="gitlab",
        provider_subject=str(profile.get("id") or username),
    )
    return frontend_redirect(f"sspillowy_session={session_id}")
