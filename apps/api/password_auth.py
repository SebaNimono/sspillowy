"""Registro e inicio de sesión con email + contraseña (web + Pulse)."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

import bcrypt
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from database import SessionLocal
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


class AuthResponse(BaseModel):
    session_id: str
    email: str
    name: str
    provider: str
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


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterBody):
    email = _validate_email(body.email)
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")

    name = (body.name or "").strip() or email.split("@")[0]
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        now = datetime.now(timezone.utc)

        if existing and existing.password_hash:
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo. Inicia sesión.")

        if existing:
            # Cuenta OAuth previa: permite definir contraseña para Pulse / login manual
            existing.password_hash = _hash_password(body.password)
            if name:
                existing.name = name
            existing.last_login_at = now
            db.commit()
            db.refresh(existing)
            user = existing
        else:
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                name=name,
                provider="password",
                password_hash=_hash_password(body.password),
                created_at=now,
                last_login_at=now,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        session_id = save_session(
            email=user.email,
            name=user.name,
            provider="password",
            avatar_url=user.avatar_url,
            provider_subject=user.id,
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
        raise HTTPException(status_code=503, detail=f"No se pudo registrar: {exc}") from exc
    finally:
        db.close()


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginBody):
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

        user.last_login_at = datetime.now(timezone.utc)
        db.commit()

        session_id = save_session(
            email=user.email,
            name=user.name,
            provider="password",
            avatar_url=user.avatar_url,
            provider_subject=user.id,
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
