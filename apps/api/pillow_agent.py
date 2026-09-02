"""Agente Pillow — asistente de dashboard vía Gemini (HITL, sin acciones automáticas)."""

from __future__ import annotations

import json
import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import SessionLocal, db_ping
from models import PillowDailyUsage

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
# gemini-2.0/2.5 ya no están disponibles para cuentas nuevas → 3.6-flash (Google AI Studio)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()
GEMINI_MODEL_FALLBACKS = [
    m.strip()
    for m in os.getenv("GEMINI_MODEL_FALLBACKS", "gemini-flash-latest,gemini-2.5-flash").split(",")
    if m.strip()
]
PILLOW_DAILY_CREDITS = int(os.getenv("PILLOW_DAILY_CREDITS", "2"))

router = APIRouter(prefix="/api/v1/pillow", tags=["Pillow"])


def _admin_emails() -> set[str]:
    raw = os.getenv("PILLOW_ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _require_admin(admin_key: str) -> str:
    key = admin_key.strip().lower()
    if not key or key not in _admin_emails():
        raise HTTPException(status_code=403, detail="No autorizado. Solo administradores Pillow.")
    return key


def _reset_user_credits(db, user_key: str) -> None:
    row = _quota_row(db, user_key.strip().lower())
    if row:
        db.delete(row)
        db.commit()

WIDGET_CATALOG = """
Tipos de widget que el usuario puede añadir al dashboard (usa solo estos ids en suggested_widgets):
- timeseries: serie temporal (hallazgos, escaneos)
- query_value: número grande (KPI único)
- top_list: ranking (motores, repos)
- table: tabla de hallazgos
- list: lista compacta de eventos
- pie_chart: distribución por severidad o motor
- bar_chart: barras comparativas
- heatmap: mapa de calor de actividad
- treemap: áreas proporcionales
- notes: nota o recordatorio de auditoría
"""

SYSTEM_PROMPT = f"""Eres Pillow, el agente de IA de SSPILLOWY (plataforma DevSecOps).
Ayudas a diseñar dashboards de seguridad: qué gráficos usar y cómo interpretar métricas.
Reglas:
- Responde en español, conciso y profesional.
- Nunca ejecutes acciones: solo sugieres widgets y explicas.
- Si faltan datos en el contexto, dilo y sugiere qué registrar primero (repos, escaneos).
- suggested_widgets: máximo 4 items, cada uno con type (id del catálogo), title y metric opcional.
{WIDGET_CATALOG}
Responde SOLO JSON válido con esta forma:
{{"reply": "texto para el usuario", "suggested_widgets": [{{"type": "bar_chart", "title": "...", "metric": "findings_by_engine"}}]}}
"""


class PillowChatBody(BaseModel):
    message: str = Field(min_length=2, max_length=2000)
    user_key: str = Field(min_length=3, max_length=255)
    dashboard_context: dict[str, Any] | None = None


class PillowQuotaResponse(BaseModel):
    configured: bool
    daily_limit: int
    credits_used: int
    credits_remaining: int
    resets_at: str


class PillowWidgetSuggestion(BaseModel):
    type: str
    title: str
    metric: str | None = None


class PillowChatResponse(BaseModel):
    reply: str
    suggested_widgets: list[PillowWidgetSuggestion]
    credits_remaining: int
    daily_limit: int


class PillowAdminStatusResponse(BaseModel):
    is_admin: bool


class PillowUsageRow(BaseModel):
    user_key: str
    credits_used: int
    daily_limit: int
    usage_date: str


class PillowAdminUsageResponse(BaseModel):
    usage: list[PillowUsageRow]


class PillowResetBody(BaseModel):
    admin_key: str = Field(min_length=3, max_length=255)
    target_user_key: str = Field(min_length=3, max_length=255)


class PillowResetResponse(BaseModel):
    ok: bool
    message: str
    credits_remaining: int


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _quota_row(db, user_key: str) -> PillowDailyUsage | None:
    return (
        db.query(PillowDailyUsage)
        .filter(PillowDailyUsage.user_key == user_key.strip().lower(), PillowDailyUsage.usage_date == _today_utc())
        .first()
    )


def _get_quota(db, user_key: str) -> tuple[int, int]:
    row = _quota_row(db, user_key)
    used = row.credits_used if row else 0
    return used, max(0, PILLOW_DAILY_CREDITS - used)


def _consume_credit(db, user_key: str) -> int:
    key = user_key.strip().lower()
    today = _today_utc()
    row = _quota_row(db, key)
    if row:
        if row.credits_used >= PILLOW_DAILY_CREDITS:
            raise HTTPException(
                status_code=429,
                detail=f"Límite diario alcanzado ({PILLOW_DAILY_CREDITS} consultas). Vuelve mañana.",
            )
        row.credits_used += 1
    else:
        row = PillowDailyUsage(user_key=key, usage_date=today, credits_used=1)
        db.add(row)
    db.commit()
    db.refresh(row)
    return max(0, PILLOW_DAILY_CREDITS - row.credits_used)


def _parse_gemini_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            return json.loads(match.group(0))
        raise


def _gemini_model_candidates() -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for name in [GEMINI_MODEL, *GEMINI_MODEL_FALLBACKS, "gemini-3.6-flash", "gemini-flash-latest"]:
        if name and name not in seen:
            seen.add(name)
            ordered.append(name)
    return ordered


def _friendly_gemini_error(status: int, raw: str) -> str:
    if status == 404:
        return (
            "El modelo de Gemini configurado ya no está disponible. "
            "En Railway cambia GEMINI_MODEL a gemini-3.6-flash y redeploy."
        )
    if status in (401, 403):
        return "API key de Gemini inválida o sin permisos. Revisa GEMINI_API_KEY en Railway."
    return f"Gemini no respondió ({status}). Intenta de nuevo en unos minutos."


async def _call_gemini(user_message: str, context: dict | None) -> dict:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Pillow no está configurado (falta GEMINI_API_KEY en el servidor).")

    ctx_block = ""
    if context:
        ctx_block = f"\nContexto actual del dashboard (JSON):\n{json.dumps(context, ensure_ascii=False)[:4000]}\n"

    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": f"{ctx_block}\nPregunta del usuario:\n{user_message}"}]}],
        "generationConfig": {
            "temperature": 0.35,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json",
        },
    }

    last_status = 502
    last_raw = ""
    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in _gemini_model_candidates():
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            res = await client.post(url, params={"key": GEMINI_API_KEY}, json=payload)
            if res.status_code == 200:
                body = res.json()
                try:
                    text = body["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError) as exc:
                    raise HTTPException(status_code=502, detail="Respuesta de Gemini inesperada.") from exc
                return _parse_gemini_json(text)
            last_status = res.status_code
            last_raw = res.text[:300]
            if res.status_code != 404:
                break

    raise HTTPException(status_code=502, detail=_friendly_gemini_error(last_status, last_raw))


@router.get("/quota", response_model=PillowQuotaResponse)
async def pillow_quota(user_key: str = ""):
    key = user_key.strip().lower()
    if not key:
        raise HTTPException(status_code=400, detail="user_key requerido (email del usuario).")

    tomorrow = datetime.combine(_today_utc() + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)

    if not db_ping():
        return PillowQuotaResponse(
            configured=bool(GEMINI_API_KEY),
            daily_limit=PILLOW_DAILY_CREDITS,
            credits_used=0,
            credits_remaining=PILLOW_DAILY_CREDITS,
            resets_at=tomorrow.isoformat(),
        )

    db = SessionLocal()
    try:
        used, remaining = _get_quota(db, key)
        return PillowQuotaResponse(
            configured=bool(GEMINI_API_KEY),
            daily_limit=PILLOW_DAILY_CREDITS,
            credits_used=used,
            credits_remaining=remaining,
            resets_at=tomorrow.isoformat(),
        )
    finally:
        db.close()


@router.post("/chat", response_model=PillowChatResponse)
async def pillow_chat(body: PillowChatBody):
    key = body.user_key.strip().lower()
    if not key:
        raise HTTPException(status_code=400, detail="user_key requerido.")

    db = SessionLocal()
    try:
        used, remaining_before = _get_quota(db, key)
        if remaining_before <= 0:
            raise HTTPException(
                status_code=429,
                detail=f"Límite diario alcanzado ({PILLOW_DAILY_CREDITS} consultas). Vuelve mañana.",
            )

        parsed = await _call_gemini(body.message.strip(), body.dashboard_context)
        credits_remaining = _consume_credit(db, key)

        widgets_raw = parsed.get("suggested_widgets") or []
        widgets: list[PillowWidgetSuggestion] = []
        if isinstance(widgets_raw, list):
            for item in widgets_raw[:4]:
                if not isinstance(item, dict):
                    continue
                wtype = str(item.get("type", "notes")).strip().lower()
                title = str(item.get("title", "Widget")).strip()[:120]
                metric = item.get("metric")
                widgets.append(
                    PillowWidgetSuggestion(
                        type=wtype,
                        title=title,
                        metric=str(metric)[:80] if metric else None,
                    )
                )

        reply = str(parsed.get("reply", "Listo.")).strip()[:3000]
        return PillowChatResponse(
            reply=reply,
            suggested_widgets=widgets,
            credits_remaining=credits_remaining,
            daily_limit=PILLOW_DAILY_CREDITS,
        )
    except HTTPException:
        raise
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Pillow no pudo interpretar la respuesta de Gemini.") from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"Error de Pillow: {exc}") from exc
    finally:
        db.close()


@router.get("/admin/status", response_model=PillowAdminStatusResponse)
async def pillow_admin_status(user_key: str = ""):
    key = user_key.strip().lower()
    return PillowAdminStatusResponse(is_admin=bool(key and key in _admin_emails()))


@router.get("/admin/usage", response_model=PillowAdminUsageResponse)
async def pillow_admin_usage(admin_key: str = ""):
    _require_admin(admin_key)
    if not db_ping():
        return PillowAdminUsageResponse(usage=[])

    db = SessionLocal()
    try:
        today = _today_utc()
        rows = db.query(PillowDailyUsage).filter(PillowDailyUsage.usage_date == today).all()
        return PillowAdminUsageResponse(
            usage=[
                PillowUsageRow(
                    user_key=r.user_key,
                    credits_used=r.credits_used,
                    daily_limit=PILLOW_DAILY_CREDITS,
                    usage_date=str(r.usage_date),
                )
                for r in rows
            ]
        )
    finally:
        db.close()


@router.post("/admin/reset-credits", response_model=PillowResetResponse)
async def pillow_admin_reset(body: PillowResetBody):
    _require_admin(body.admin_key)
    target = body.target_user_key.strip().lower()

    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible.")

    db = SessionLocal()
    try:
        _reset_user_credits(db, target)
        return PillowResetResponse(
            ok=True,
            message=f"Créditos restablecidos para {target}.",
            credits_remaining=PILLOW_DAILY_CREDITS,
        )
    finally:
        db.close()
