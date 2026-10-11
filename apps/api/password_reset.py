"""Recuperación de contraseña por correo."""

from __future__ import annotations

import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import SessionLocal
from email_service import mailer_configured, send_password_reset_email
from models import User
from oauth_common import FRONTEND_URL

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
RESET_TTL_HOURS = int(os.getenv("PASSWORD_RESET_TTL_HOURS", "1"))

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

GENERIC_OK = {
    "ok": True,
    "message": "Si el correo está registrado con contraseña, recibirás un enlace para restablecerla.",
}


class ForgotPasswordBody(BaseModel):
    email: str = Field(min_length=5, max_length=255)


class ResetPasswordBody(BaseModel):
    token: str = Field(min_length=10, max_length=128)
    password: str = Field(min_length=8, max_length=128)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _reset_url(token: str) -> str:
    return f"{FRONTEND_URL.rstrip('/')}/restablecer-contrasena?token={token}"


def _issue_reset_token() -> tuple[str, datetime]:
    return secrets.token_urlsafe(32), datetime.now(timezone.utc) + timedelta(hours=RESET_TTL_HOURS)


def _token_expired(exp: datetime | None) -> bool:
    if exp is None:
        return True
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp < datetime.now(timezone.utc)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordBody):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Correo electrónico no válido")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.is_active:
            return GENERIC_OK

        # Cuenta solo SSO sin contraseña: no enviar reset (evita confusión)
        if not user.password_hash:
            return GENERIC_OK

        token, expires = _issue_reset_token()
        user.password_reset_token = token
        user.password_reset_expires_at = expires
        db.commit()

        await send_password_reset_email(to=user.email, name=user.name, reset_url=_reset_url(token))
        if not mailer_configured():
            print(f"[sspillowy] Reset sin mailer. Enlace para {email}: {_reset_url(token)}")

        return GENERIC_OK
    finally:
        db.close()


@router.get("/reset-password/validate")
def validate_reset_token(token: str = ""):
    token = token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token requerido")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.password_reset_token == token).first()
        if not user or _token_expired(user.password_reset_expires_at):
            raise HTTPException(status_code=400, detail="El enlace no es válido o ha expirado.")
        return {"ok": True, "email": user.email}
    finally:
        db.close()


@router.post("/reset-password")
def reset_password(body: ResetPasswordBody):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.password_reset_token == body.token.strip()).first()
        if not user or _token_expired(user.password_reset_expires_at):
            raise HTTPException(status_code=400, detail="El enlace no es válido o ha expirado.")

        user.password_hash = _hash_password(body.password)
        user.email_verified = True
        user.password_reset_token = None
        user.password_reset_expires_at = None
        user.last_login_at = datetime.now(timezone.utc)
        db.commit()

        return {"ok": True, "message": "Contraseña actualizada. Ya puedes iniciar sesión."}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"No se pudo actualizar la contraseña: {exc}") from exc
    finally:
        db.close()
