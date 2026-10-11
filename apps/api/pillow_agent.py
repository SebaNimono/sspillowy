"""Agente Pillow — asistente de dashboard vía Gemini (HITL, sin acciones automáticas)."""

from __future__ import annotations

import asyncio
import json
import logging
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
from obs_metrics import Timer

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
logger = logging.getLogger("sspillowy.pillow")


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
Acompañas al usuario en todas las secciones de la plataforma: Risk Posture (dashboards), Priorización contextual
(hallazgos), Fix Intelligence (triaje y remediación), Secret Management, Supply Chain & SBOM, Escaneos, Security Gates,
Compliance continuo y Documentación. Explicas qué significan los datos de la pantalla actual, priorizas qué atender
primero y cómo corregirlo.
Reglas:
- Responde en español, conciso y profesional. Usa los datos del contexto; no inventes cifras ni hallazgos.
- Nunca ejecutes acciones ni cierres hallazgos: solo explicas y propones. Las decisiones las toma una persona (HITL).
- Si faltan datos en el contexto, dilo y sugiere qué hacer primero (agregar repos, escanear).
- Ten en cuenta la conversación previa para dar continuidad.
- suggested_widgets: SOLO si la pantalla actual es el dashboard (page = dashboard) y el usuario pide visualizaciones;
  en cualquier otro caso devuelve una lista vacía. Máximo 4 items con type (id del catálogo), title y metric opcional.
{WIDGET_CATALOG}
Responde SOLO JSON válido con esta forma:
{{"reply": "texto para el usuario", "suggested_widgets": [{{"type": "bar_chart", "title": "...", "metric": "findings_by_engine"}}]}}
"""


class PillowHistoryLine(BaseModel):
    role: str = Field(max_length=10)
    text: str = Field(max_length=3000)


class PillowChatBody(BaseModel):
    message: str = Field(min_length=2, max_length=2000)
    user_key: str = Field(min_length=3, max_length=255)
    dashboard_context: dict[str, Any] | None = None
    page: str | None = Field(default=None, max_length=40)
    page_context: dict[str, Any] | None = None
    history: list[PillowHistoryLine] | None = None


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
    """Extrae JSON de la respuesta de Gemini (markdown, texto mezclado o JSON puro)."""
    raw = (text or "").strip()
    if not raw:
        raise json.JSONDecodeError("empty", raw, 0)

    candidates: list[str] = [raw]

    # Quitar bloques ```json ... ```
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
    if fence:
        candidates.insert(0, fence.group(1).strip())

    # Primer objeto JSON balanceado (más fiable que regex greedy)
    start = raw.find("{")
    if start >= 0:
        depth = 0
        in_string = False
        escape = False
        for i in range(start, len(raw)):
            ch = raw[i]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidates.append(raw[start : i + 1])
                    break

    for chunk in candidates:
        if not chunk:
            continue
        try:
            parsed = json.loads(chunk)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue

    # Último recurso: devolver el texto como reply (mejor que error al usuario)
    cleaned = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.IGNORECASE).strip()
    return {"reply": cleaned[:3000] or "Listo.", "suggested_widgets": []}


PILLOW_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "suggested_widgets": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string"},
                    "title": {"type": "string"},
                    "metric": {"type": "string"},
                },
                "required": ["type", "title"],
            },
        },
    },
    "required": ["reply", "suggested_widgets"],
}


def _gemini_model_candidates() -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for name in [GEMINI_MODEL, *GEMINI_MODEL_FALLBACKS, "gemini-3.6-flash", "gemini-flash-latest"]:
        if name and name not in seen:
            seen.add(name)
            ordered.append(name)
    return ordered


_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def _friendly_gemini_error(status: int, raw: str) -> str:
    logger.warning("Proveedor IA respondió %s: %s", status, raw)
    if status in (404, 401, 403):
        return "Pillow no está disponible ahora mismo por un problema de configuración. Avisa al administrador."
    if status in (429, 503):
        return "Pillow está saturado en este momento. Intenta de nuevo en unos minutos; no se descontó ningún crédito."
    return "Pillow no respondió. Intenta de nuevo en unos minutos; no se descontó ningún crédito."


async def call_gemini(user_message: str, context: dict | None = None, **kwargs: Any) -> dict:
    if not GEMINI_API_KEY:
        return await _call_gemini(user_message, context, **kwargs)
    with Timer("pillow", "chat"):
        return await _call_gemini(user_message, context, **kwargs)


async def _call_gemini(
    user_message: str,
    context: dict | None = None,
    *,
    system_prompt: str = SYSTEM_PROMPT,
    schema: dict[str, Any] | None = None,
    history: list[dict] | None = None,
    context_label: str = "Contexto actual",
    max_tokens: int = 2048,
) -> dict:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Pillow aún no está activado en el servidor. Avisa al administrador.")
    schema = schema or PILLOW_RESPONSE_SCHEMA

    ctx_block = ""
    if context:
        ctx_block = f"\n{context_label} (JSON):\n{json.dumps(context, ensure_ascii=False, default=str)[:6000]}\n"

    contents: list[dict] = []
    for line in (history or [])[-8:]:
        role = "model" if line.get("role") == "pillow" else "user"
        text = str(line.get("text") or "").strip()[:1500]
        if not text or (not contents and role == "model"):
            continue
        if contents and contents[-1]["role"] == role:
            contents[-1]["parts"][0]["text"] += f"\n{text}"
        else:
            contents.append({"role": role, "parts": [{"text": text}]})
    if contents and contents[-1]["role"] == "user":
        contents.append({"role": "model", "parts": [{"text": "(sin respuesta)"}]})
    contents.append({"role": "user", "parts": [{"text": f"{ctx_block}\nPregunta del usuario:\n{user_message}"}]})
    base_payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
    }

    last_status = 502
    last_raw = ""
    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in _gemini_model_candidates():
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            for use_schema in (True, False):
                gen_config: dict[str, Any] = {
                    "temperature": 0.35,
                    "maxOutputTokens": max_tokens,
                    "responseMimeType": "application/json",
                }
                if use_schema:
                    gen_config["responseSchema"] = schema
                payload = {**base_payload, "generationConfig": gen_config}
                for attempt in range(3):
                    try:
                        res = await client.post(url, params={"key": GEMINI_API_KEY}, json=payload)
                    except httpx.HTTPError as exc:
                        logger.warning("Proveedor IA sin respuesta (%s): %s", model, exc)
                        res = None
                    if res is not None and res.status_code not in _RETRYABLE_STATUS:
                        break
                    if attempt < 2:
                        await asyncio.sleep(1.5 * (attempt + 1))
                if res is None:
                    last_status = 504
                    break
                if res.status_code == 200:
                    body = res.json()
                    candidates = body.get("candidates") or []
                    if not candidates:
                        block = (body.get("promptFeedback") or {}).get("blockReason")
                        if block:
                            raise HTTPException(
                                status_code=502,
                                detail="Pillow no puede responder a eso por sus políticas de contenido. Reformula la pregunta.",
                            )
                        raise HTTPException(status_code=502, detail="Pillow devolvió una respuesta vacía. Intenta de nuevo.")
                    parts = (candidates[0].get("content") or {}).get("parts") or []
                    text = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
                    if not text:
                        raise HTTPException(status_code=502, detail="Pillow devolvió una respuesta vacía. Intenta de nuevo.")
                    return _parse_gemini_json(text)
                last_status = res.status_code
                last_raw = res.text[:300]
                if res.status_code == 404:
                    break
                if res.status_code == 400 and use_schema:
                    continue
                break

    raise HTTPException(status_code=502, detail=_friendly_gemini_error(last_status, last_raw))


@router.get("/quota", response_model=PillowQuotaResponse)
def pillow_quota(user_key: str = ""):
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

        page = (body.page or "dashboard").strip()
        context: dict[str, Any] = {"page": page}
        if body.page_context:
            context["data"] = body.page_context
        elif body.dashboard_context:
            context["data"] = body.dashboard_context
        parsed = await call_gemini(
            body.message.strip(),
            context,
            history=[h.model_dump() for h in body.history or []],
            context_label="Pantalla actual del usuario y sus datos",
        )
        credits_remaining = _consume_credit(db, key)

        widgets_raw = (parsed.get("suggested_widgets") or []) if page == "dashboard" else []
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
        raise HTTPException(
            status_code=502,
            detail="Pillow no pudo interpretar su propia respuesta. Intenta de nuevo.",
        ) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"Error de Pillow: {exc}") from exc
    finally:
        db.close()


@router.get("/admin/status", response_model=PillowAdminStatusResponse)
def pillow_admin_status(user_key: str = ""):
    key = user_key.strip().lower()
    return PillowAdminStatusResponse(is_admin=bool(key and key in _admin_emails()))


@router.get("/admin/usage", response_model=PillowAdminUsageResponse)
def pillow_admin_usage(admin_key: str = ""):
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
def pillow_admin_reset(body: PillowResetBody):
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
