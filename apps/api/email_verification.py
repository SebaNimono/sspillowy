"""Verificación de correo para cuentas con contraseña."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from database import SessionLocal
from email_service import mailer_configured, send_verification_email
from models import User
from oauth_common import FRONTEND_URL, redirect_oauth_error

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", "http://localhost:8000").rstrip("/")
TOKEN_TTL_HOURS = int(os.getenv("EMAIL_VERIFICATION_TTL_HOURS", "24"))

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class ResendVerificationBody(BaseModel):
    email: str = Field(min_length=5, max_length=255)


def _issue_token() -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)
    return token, expires


def _verify_url(token: str) -> str:
    return f"{API_PUBLIC_URL}/api/v1/auth/verify-email?token={token}"


async def assign_verification_token(user: User, db) -> bool:
    token, expires = _issue_token()
    user.verification_token = token
    user.verification_token_expires_at = expires
    user.email_verified = False
    db.commit()
    return await send_verification_email(to=user.email, name=user.name, verify_url=_verify_url(token))


def mark_email_verified(user: User, db) -> None:
    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires_at = None
    db.commit()


def is_password_user_verified(user: User) -> bool:
    if user.provider != "password" and user.password_hash and user.email_verified:
        return True
    if user.provider == "password":
        return bool(user.email_verified)
    return True


@router.get("/verify-email")
def verify_email(token: str = ""):
    if not token.strip():
        return redirect_oauth_error("verify_missing_token")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.verification_token == token.strip()).first()
        if not user:
            return redirect_oauth_error("verify_invalid_token")

        exp = user.verification_token_expires_at
        if exp is not None and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp and exp < datetime.now(timezone.utc):
            return redirect_oauth_error("verify_expired_token")

        mark_email_verified(user, db)
        return RedirectResponse(f"{FRONTEND_URL}/?email_verified=1", status_code=302)
    finally:
        db.close()


@router.post("/resend-verification")
async def resend_verification(body: ResendVerificationBody):
    email = body.email.strip().lower()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.password_hash:
            # No revelar si el correo existe
            return {"ok": True, "message": "Si el correo está registrado, recibirás un nuevo enlace."}

        if user.email_verified:
            return {"ok": True, "message": "Este correo ya está verificado. Puedes iniciar sesión."}

        sent = await assign_verification_token(user, db)
        msg = "Te enviamos un nuevo enlace de verificación."
        if not sent and not mailer_configured():
            msg = "Correo pendiente de envío (servidor sin SMTP/Resend). Revisa los logs de la API."
        return {"ok": True, "message": msg, "email_sent": sent}
    finally:
        db.close()
