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
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
# gemini-2.0/2.5 ya no están disponibles para cuentas nuevas → 3.6-flash (Google AI Studio)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()
GEMINI_MODEL_FALLBACKS = [
    m.strip()
    for m in os.getenv("GEMINI_MODEL_FALLBACKS", "gemini-flash-latest,gemini-2.5-flash").split(",")
    if m.strip()
]
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3-32b").strip()
GROQ_MODEL_FALLBACKS = [
    m.strip()
    for m in os.getenv(
        "GROQ_MODEL_FALLBACKS",
        "qwen/qwen3-32b,qwen-qwq-32b,llama-3.3-70b-versatile,openai/gpt-oss-120b,openai/gpt-oss-20b,llama-3.1-8b-instant",
    ).split(",")
    if m.strip()
]
PILLOW_DAILY_CREDITS = int(os.getenv("PILLOW_DAILY_CREDITS", "2"))


def _active_groq_key() -> str:
    gk = (os.getenv("GROQ_API_KEY") or GROQ_API_KEY or "").strip()
    if gk:
        return gk
    mk = (os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY or "").strip()
    if mk.startswith("gsk_"):
        return mk
    return ""


def _active_gemini_key() -> str:
    mk = (os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY or "").strip()
    if mk and not mk.startswith("gsk_"):
        return mk
    return ""


def pillow_configured() -> bool:
    return bool(_active_groq_key() or _active_gemini_key())

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
- Responde en español, conciso, amable y profesional. Usa los datos del contexto; no inventes cifras ni hallazgos.
- Si el usuario solo te saluda (por ejemplo 'hola', 'buenas', 'hey', 'saludos') o hace preguntas abiertas breves, responde de forma corta y cordial: '¡Hola! ¿En qué deseas que te ayude hoy?' sin soltar resúmenes automáticos extensos de hallazgos a menos que el usuario lo solicite explícitamente.
- Si el usuario adjunta una captura o archivo, analiza su contenido con atención respecto a la pantalla o problema de seguridad planteado.
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
    """Extrae JSON de la respuesta de IA (markdown, bloques <think> de Qwen, texto mezclado o JSON puro)."""
    raw = (text or "").strip()
    if not raw:
        raise json.JSONDecodeError("empty", raw, 0)
    raw = re.sub(r"<think>[\s\S]*?</think>", "", raw, flags=re.IGNORECASE).strip() or raw

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


def _groq_model_candidates() -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for name in [
        GROQ_MODEL,
        *GROQ_MODEL_FALLBACKS,
        "qwen/qwen3-32b",
        "llama-3.3-70b-versatile",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
    ]:
        if name and name not in seen:
            seen.add(name)
            ordered.append(name)
    return ordered


async def _call_groq(
    groq_key: str,
    user_message: str,
    context: dict | None = None,
    *,
    system_prompt: str = SYSTEM_PROMPT,
    schema: dict[str, Any] | None = None,
    history: list[dict] | None = None,
    context_label: str = "Contexto actual",
    max_tokens: int = 2048,
) -> dict:
    schema = schema or PILLOW_RESPONSE_SCHEMA
    ctx_block = ""
    if context:
        ctx_block = f"\n{context_label} (JSON):\n{json.dumps(context, ensure_ascii=False, default=str)[:6000]}\n"

    schema_instruction = (
        f"\nIMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido que cumpla este esquema JSON:\n"
        f"{json.dumps(schema, ensure_ascii=False)}\nNo incluyas texto fuera del JSON."
    )
    messages: list[dict[str, str]] = [
        {"role": "system", "content": f"{system_prompt}\n{schema_instruction}"},
    ]
    for line in (history or [])[-8:]:
        role = "assistant" if line.get("role") == "pillow" else "user"
        text = str(line.get("text") or "").strip()[:1500]
        if text:
            messages.append({"role": role, "content": text})
    messages.append({"role": "user", "content": f"{ctx_block}\nPregunta del usuario:\n{user_message}"})

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}
    last_status = 502
    last_raw = ""

    async with httpx.AsyncClient(timeout=30.0) as client:
        models_to_try = list(_groq_model_candidates())
        for idx, model in enumerate(models_to_try):
            for use_json_mode in (True, False):
                payload: dict[str, Any] = {
                    "model": model,
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": max_tokens,
                }
                if use_json_mode:
                    payload["response_format"] = {"type": "json_object"}
                try:
                    res = await client.post(url, headers=headers, json=payload)
                except httpx.HTTPError as exc:
                    logger.warning("Groq sin respuesta (%s): %s", model, exc)
                    res = None
                if res is None:
                    last_status = 504
                    break
                if res.status_code == 200:
                    body = res.json()
                    choices = body.get("choices") or []
                    if choices:
                        text = ((choices[0].get("message") or {}).get("content") or "").strip()
                        if text:
                            return _parse_gemini_json(text)
                last_status = res.status_code
                last_raw = res.text[:300]
                if res.status_code == 400 and use_json_mode:
                    continue
                if res.status_code in (400, 404) and idx == 0:
                    try:
                        mres = await client.get("https://api.groq.com/openai/v1/models", headers=headers)
                        if mres.status_code == 200:
                            avail = [m.get("id", "") for m in (mres.json().get("data") or []) if m.get("id")]
                            qwen_avail = [m for m in avail if "qwen" in m.lower()]
                            for qm in reversed(qwen_avail):
                                if qm not in models_to_try:
                                    models_to_try.insert(idx + 1, qm)
                    except Exception:
                        pass
                break

    raise HTTPException(status_code=502, detail=_friendly_gemini_error(last_status, last_raw))


async def call_gemini(user_message: str, context: dict | None = None, **kwargs: Any) -> dict:
    if not pillow_configured():
        return await _call_gemini(user_message, context, **kwargs)
    with Timer("pillow", "chat"):
        groq_key = _active_groq_key()
        if groq_key:
            try:
                return await _call_groq(groq_key, user_message, context, **kwargs)
            except HTTPException:
                if not _active_gemini_key():
                    raise
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
    gemini_key = _active_gemini_key()
    if not gemini_key:
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
                        res = await client.post(url, params={"key": gemini_key}, json=payload)
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
            configured=pillow_configured(),
            daily_limit=PILLOW_DAILY_CREDITS,
            credits_used=0,
            credits_remaining=PILLOW_DAILY_CREDITS,
            resets_at=tomorrow.isoformat(),
        )

    db = SessionLocal()
    try:
        used, remaining = _get_quota(db, key)
        return PillowQuotaResponse(
            configured=pillow_configured(),
            daily_limit=PILLOW_DAILY_CREDITS,
            credits_used=used,
            credits_remaining=remaining,
            resets_at=tomorrow.isoformat(),
        )
    finally:
        db.close()


_AI_SECRET_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"(?i)\b(ghp|gho|ghu|ghs|ghr|github_pat|glpat|xoxb|xoxp|sk|AIza)[-_A-Za-z0-9]{16,}\b"),
    re.compile(r"(?i)\b(bearer|token|secret|password|passwd|api[_-]?key)\s*[:=]\s*['\"]?[A-Za-z0-9._\-/+]{12,}['\"]?"),
]


def _sanitize_for_ai(value: Any) -> Any:
    if isinstance(value, str):
        out = value
        for pat in _AI_SECRET_PATTERNS:
            out = pat.sub("[REDACTED_SECRET]", out)
        return out
    if isinstance(value, list):
        return [_sanitize_for_ai(v) for v in value]
    if isinstance(value, dict):
        return {k: _sanitize_for_ai(v) for k, v in value.items()}
    return value

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

        # Saludos directos responden de inmediato sin consumir crédito ni abrumar al usuario
        clean_msg = body.message.strip().lower().rstrip("!?. ,;")
        if clean_msg in {"hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "hey", "saludos", "que tal", "hola pillow"}:
            return PillowChatResponse(
                reply="¡Hola! ¿En qué deseas que te ayude hoy?",
                suggested_widgets=[],
                credits_remaining=remaining_before,
                daily_limit=PILLOW_DAILY_CREDITS,
            )

        page = (body.page or "dashboard").strip()
        context: dict[str, Any] = {"page": page}
        if body.page_context:
            context["data"] = body.page_context
        elif body.dashboard_context:
            context["data"] = body.dashboard_context
        parsed = await call_gemini(_sanitize_for_ai(body.message.strip()), _sanitize_for_ai(context), history=_sanitize_for_ai([h.model_dump() for h in body.history or []]),
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


