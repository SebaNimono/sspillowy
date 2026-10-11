"""Registro e inicio de sesión con email + contraseña (web + Pulse)."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

import bcrypt
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from database import SessionLocal
from email_service import mailer_configured
from email_verification import assign_verification_token
from models import User
from oauth_common import save_session

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterBody(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=120)


class LoginBody(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False


class AuthResponse(BaseModel):
    session_id: str
    email: str
    name: str
    provider: str
    user_id: str | None = None


class RegisterResponse(BaseModel):
    requires_verification: bool = False
    email: str
    message: str
    email_sent: bool = False
    session_id: str | None = None
    name: str | None = None
    provider: str | None = None
    user_id: str | None = None


def _norm_email(email: str) -> str:
    return email.strip().lower()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def _validate_email(email: str) -> str:
    email = _norm_email(email)
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Correo electrónico no válido")
    return email


def _require_verified_password_login(user: User) -> None:
    if user.provider == "password" and user.password_hash and not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja o solicita un nuevo enlace.",
        )


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterBody):
    email = _validate_email(body.email)
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")

    name = (body.name or "").strip() or email.split("@")[0]
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        now = datetime.now(timezone.utc)

        if existing and existing.password_hash and existing.provider == "password":
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo. Inicia sesión.")

        if existing:
            # Cuenta SSO previa: define contraseña (ya verificada por el proveedor)
            existing.password_hash = _hash_password(body.password)
            if name:
                existing.name = name
            existing.email_verified = True
            existing.verification_token = None
            existing.verification_token_expires_at = None
            existing.last_login_at = now
            db.commit()
            db.refresh(existing)
            user = existing

            session_id = save_session(
                email=user.email,
                name=user.name,
                provider=user.provider,
                avatar_url=user.avatar_url,
                provider_subject=user.provider_subject or user.id,
            )
            return RegisterResponse(
                requires_verification=False,
                email=user.email,
                message="Contraseña definida. Ya puedes iniciar sesión (útil para Pulse).",
                session_id=session_id,
                name=user.name,
                provider=user.provider,
                user_id=user.id,
            )

        user = User(
            id=str(uuid.uuid4()),
            email=email,
            name=name,
            provider="password",
            password_hash=_hash_password(body.password),
            email_verified=False,
            created_at=now,
            last_login_at=now,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        sent = await assign_verification_token(user, db)
        message = "Cuenta creada. Revisa tu correo y haz clic en el enlace de verificación."
        if not sent and not mailer_configured():
            message = (
                "Cuenta creada. El servidor aún no envía correos (configura Resend o SMTP en Railway). "
                "Hasta entonces no podrás iniciar sesión con contraseña."
            )

        return RegisterResponse(
            requires_verification=True,
            email=user.email,
            message=message,
            email_sent=sent,
        )
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"No se pudo registrar: {exc}") from exc
    finally:
        db.close()


@router.post("/login", response_model=AuthResponse)
def login(body: LoginBody):
    email = _validate_email(body.email)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

        if not user.password_hash:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Esta cuenta entró con Google/GitHub/etc. "
                    "En Crear cuenta usa el mismo correo para definir una contraseña (útil para Pulse)."
                ),
            )

        if not _verify_password(body.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

        _require_verified_password_login(user)

        user.last_login_at = datetime.now(timezone.utc)
        db.commit()

        session_id = save_session(
            email=user.email,
            name=user.name,
            provider="password",
            avatar_url=user.avatar_url,
            provider_subject=user.id,
            remember=body.remember,
        )
        return AuthResponse(
            session_id=session_id,
            email=user.email,
            name=user.name,
            provider="password",
            user_id=user.id,
        )
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"No se pudo iniciar sesión: {exc}") from exc
    finally:
        db.close()
