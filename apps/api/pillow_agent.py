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
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip()
PILLOW_DAILY_CREDITS = int(os.getenv("PILLOW_DAILY_CREDITS", "2"))

router = APIRouter(prefix="/api/v1/pillow", tags=["Pillow"])

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

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    async with httpx.AsyncClient(timeout=45.0) as client:
        res = await client.post(url, params={"key": GEMINI_API_KEY}, json=payload)

    if res.status_code != 200:
        detail = res.text[:300]
        raise HTTPException(status_code=502, detail=f"Gemini no respondió ({res.status_code}): {detail}")

    body = res.json()
    try:
        text = body["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise HTTPException(status_code=502, detail="Respuesta de Gemini inesperada.") from exc

    return _parse_gemini_json(text)


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
