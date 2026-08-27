import os
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from oauth_common import consume_state, frontend_redirect, issue_state, save_session

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "").strip()
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "").strip()
GITHUB_REDIRECT_URI = os.getenv(
    "GITHUB_REDIRECT_URI",
    "http://localhost:8000/api/v1/auth/github/callback",
).strip()

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.get("/github")
async def github_login():
    if not (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET):
        return frontend_redirect("oauth_error=github_not_configured")

    params = urlencode(
        {
            "client_id": GITHUB_CLIENT_ID,
            "redirect_uri": GITHUB_REDIRECT_URI,
            "scope": "read:user user:email",
            "state": issue_state(),
            "allow_signup": "true",
        }
    )
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}", status_code=302)


@router.get("/github/callback")
async def github_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        return frontend_redirect(f"oauth_error={error}")
    if not code or not consume_state(state):
        return frontend_redirect("oauth_error=invalid_state")

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_res = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": GITHUB_REDIRECT_URI,
                },
                headers={"Accept": "application/json"},
            )
            token_res.raise_for_status()
            access_token = token_res.json().get("access_token")
            if not access_token:
                return frontend_redirect("oauth_error=no_access_token")

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
            user_res = await client.get("https://api.github.com/user", headers=headers)
            user_res.raise_for_status()
            profile = user_res.json()

            email = profile.get("email")
            if not email:
                emails_res = await client.get("https://api.github.com/user/emails", headers=headers)
                if emails_res.status_code == 200:
                    emails = emails_res.json()
                    primary = next((item for item in emails if item.get("primary") and item.get("verified")), None)
                    verified = next((item for item in emails if item.get("verified")), None)
                    email = (primary or verified or (emails[0] if emails else {})).get("email")

            if not email:
                login = profile.get("login") or "user"
                email = f"{login}@users.noreply.github.com"
    except httpx.HTTPError:
        return frontend_redirect("oauth_error=github_http")

    session_id = save_session(
        email=email,
        name=profile.get("name") or profile.get("login") or email.split("@")[0],
        avatar_url=profile.get("avatar_url"),
        provider="github",
        github_login=profile.get("login"),
    )
    return frontend_redirect(f"sspillowy_session={session_id}")
