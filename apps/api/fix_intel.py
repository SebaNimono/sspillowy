"""Fix Intelligence: cola priorizada de hallazgos + triaje asistido por IA (Gemini) con decisión humana (HITL).

La prioridad es determinista (severidad, exposición, fix disponible, ruta de test…) y la IA solo agrega un
veredicto sugerido y pasos de remediación; ningún estado cambia hasta que una persona acepta la sugerencia.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth_deps import require_hub_read, require_hub_write
from database import SessionLocal, db_ping
from models import AuditEvent, Finding, Repository
from pillow_agent import PILLOW_DAILY_CREDITS, _consume_credit, _get_quota, call_gemini
from semgrep_scan import ACTIVE_STATUSES, _refresh_repo_counters

router = APIRouter(prefix="/api/v1/fix-intel", tags=["Fix Intelligence"])

VERDICTS = ("LIKELY_REAL", "NEEDS_REVIEW", "LIKELY_FALSE_POSITIVE")
MAX_TRIAGE_BATCH = 5

_SEVERITY_BASE = {"CRITICAL": 40, "HIGH": 30, "MEDIUM": 18, "LOW": 8, "INFO": 3}
_SEVERITY_ES = {"CRITICAL": "crítica", "HIGH": "alta", "MEDIUM": "media", "LOW": "baja", "INFO": "informativa"}
_PKG_RE = re.compile(r"Paquete:\s*(\S+)@([^\s@]+)(?:\s*→\s*fix\s*(.+))?$", re.MULTILINE)
_TEST_PATH_RE = re.compile(
    r"(^|/)(tests?|__tests__|spec|specs|fixtures?|examples?|samples?|demo|mocks?|testdata)(/|$)"
    r"|(\.|_|-)(test|spec)\.[a-z0-9]+$",
    re.IGNORECASE,
)
_GITHUB_RE = re.compile(r"github\.com[/:]([^/]+)/([^/]+?)(?:\.git)?/?$", re.IGNORECASE)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def _require_db() -> None:
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible")


def _package_info(f: Finding) -> tuple[str | None, str | None, str | None]:
    if (f.engine or "") != "trivy":
        return None, None, None
    m = _PKG_RE.search(f.description or "")
    if not m:
        return None, None, None
    fix = (m.group(3) or "").strip() or None
    return m.group(1), m.group(2), fix


def _is_test_path(path: str | None) -> bool:
    return bool(path and _TEST_PATH_RE.search(path.replace("\\", "/")))


def _priority(f: Finding) -> tuple[int, list[dict], str | None]:
    sev = (f.severity or "").upper()
    score = _SEVERITY_BASE.get(sev, 5)
    reasons: list[dict] = [{"label": f"Severidad {_SEVERITY_ES.get(sev, 'n/d')}", "tone": "neutral", "delta": score}]
    engine = (f.engine or "").lower()
    pkg, _version, fix = _package_info(f)

    if engine == "owasp_zap":
        score += 15
        reasons.append({"label": "Expuesto en la app en ejecución", "tone": "up", "delta": 15})
    if engine == "gitleaks":
        score += 15
        reasons.append({"label": "Credencial filtrada", "tone": "up", "delta": 15})
    if fix:
        score += 10
        reasons.append({"label": "Fix disponible (quick win)", "tone": "up", "delta": 10})
    if (f.owasp_category or "").upper().startswith("A03"):
        score += 8
        reasons.append({"label": "Inyección (OWASP A03)", "tone": "up", "delta": 8})
    if _is_test_path(f.file_path):
        score -= 15
        reasons.append({"label": "Ruta de test o ejemplo", "tone": "down", "delta": -15})
    if f.ai_verdict == "LIKELY_REAL":
        score += 10
        reasons.append({"label": "IA: probable real", "tone": "up", "delta": 10})
    elif f.ai_verdict == "LIKELY_FALSE_POSITIVE":
        score -= 20
        reasons.append({"label": "IA: probable falso positivo", "tone": "down", "delta": -20})
    return max(0, min(100, score)), reasons, fix


def _fix_hint(f: Finding) -> str:
    engine = (f.engine or "").lower()
    pkg, version, fix = _package_info(f)
    if engine == "trivy" and pkg:
        if fix:
            return f"Actualiza {pkg} de {version} a {fix} y vuelve a escanear."
        return f"{pkg}@{version} aún no tiene versión corregida: evalúa reemplazarlo o mitigar su uso."
    if engine == "gitleaks":
        return "Rota y revoca la credencial; sigue el checklist en Secret Management."
    if engine == "owasp_zap":
        return "Ajusta la configuración del servidor o las cabeceras HTTP indicadas y re-escanea la URL."
    if engine == "semgrep":
        where = f" en {f.file_path}:{f.line_number}" if f.file_path and f.line_number else ""
        return f"Revisa el patrón inseguro{where} y aplica la corrección recomendada por la regla."
    return "Revisa el hallazgo y aplica la corrección correspondiente."


def _effort(f: Finding) -> str:
    engine = (f.engine or "").lower()
    _pkg, _version, fix = _package_info(f)
    if engine == "trivy":
        return "Bajo" if fix else "Alto"
    return "Medio"


def _item(f: Finding, repo_names: dict[str, str]) -> dict:
    score, reasons, fix = _priority(f)
    pkg, version, _ = _package_info(f)
    return {
        "id": f.id,
        "repository_id": f.repository_id,
        "repository_name": repo_names.get(f.repository_id, "—"),
        "engine": f.engine,
        "severity": (f.severity or "").upper(),
        "title": f.title,
        "description": (f.description or "")[:800],
        "file_path": f.file_path,
        "line_number": f.line_number,
        "cwe": f.cwe,
        "owasp_category": f.owasp_category,
        "status": f.status,
        "score": score,
        "reasons": reasons,
        "package": pkg,
        "version": version,
        "fix_version": fix,
        "fix_hint": _fix_hint(f),
        "effort": _effort(f),
        "ai_verdict": f.ai_verdict,
        "ai_confidence": f.ai_confidence,
        "ai_summary": f.ai_summary,
        "ai_remediation": f.ai_remediation,
        "ai_triaged_at": _iso(f.ai_triaged_at),
        "ai_feedback": f.ai_feedback,
        "created_at": _iso(f.created_at),
    }


def _audit(db, action: str, target: str, detail: str, actor: str) -> None:
    db.add(
        AuditEvent(
            id=str(uuid.uuid4()),
            action=action,
            target=target[:200],
            detail=detail[:1000],
            actor_email=actor,
            created_at=_now(),
        )
    )


def finding_fingerprint(f: Finding) -> str:
    path = (f.file_path or "").replace("\\", "/").lstrip("./")
    return f"{(f.engine or '').lower()}|{f.title or ''}|{path}"


def carry_forward_triage(db, *, repo_id: str, scan_id: str) -> int:
    """Copia triaje IA y decisiones (falso positivo, riesgo aceptado) de escaneos anteriores al nuevo.

    Sin esto cada re-escaneo crea filas nuevas y se pierde el trabajo de triaje ya hecho.
    """
    new_rows = (
        db.query(Finding)
        .filter(Finding.repository_id == repo_id, Finding.scan_id == scan_id)
        .all()
    )
    if not new_rows:
        return 0
    prior_rows = (
        db.query(Finding)
        .filter(
            Finding.repository_id == repo_id,
            Finding.scan_id != scan_id,
            (Finding.ai_triaged.is_(True)) | (Finding.status.in_(["FALSE_POSITIVE", "ACCEPTED_RISK"])),
        )
        .order_by(Finding.created_at.desc())
        .limit(5000)
        .all()
    )
    latest: dict[str, Finding] = {}
    for p in prior_rows:
        latest.setdefault(finding_fingerprint(p), p)

    carried = 0
    for f in new_rows:
        prev = latest.get(finding_fingerprint(f))
        if not prev:
            continue
        if prev.ai_triaged:
            f.ai_triaged = True
            f.ai_verdict = prev.ai_verdict
            f.ai_confidence = prev.ai_confidence
            f.ai_summary = prev.ai_summary
            f.ai_remediation = prev.ai_remediation
            f.ai_triaged_at = prev.ai_triaged_at
            f.ai_feedback = prev.ai_feedback
        if prev.status in ("FALSE_POSITIVE", "ACCEPTED_RISK") and f.status in ACTIVE_STATUSES:
            f.status = prev.status
        elif prev.ai_feedback == "ACCEPTED" and prev.ai_verdict in ("LIKELY_REAL", "NEEDS_REVIEW"):
            f.status = "IN_REVIEW"
        carried += 1
    return carried


# --------------------------------------------------------------------------- consultas


@router.get("")
def fix_intel_queue(
    repository_id: Optional[str] = Query(default=None),
    limit: int = Query(default=400, ge=1, le=1000),
    _auth=Depends(require_hub_read),
):
    _require_db()
    db = SessionLocal()
    try:
        repos = db.query(Repository).all()
        repo_names = {r.id: r.name for r in repos}
        q = db.query(Finding).filter(Finding.status.in_(list(ACTIVE_STATUSES)))
        if repository_id:
            q = q.filter(Finding.repository_id == repository_id)
        rows = q.all()
        items = sorted((_item(f, repo_names) for f in rows), key=lambda i: (-i["score"], i["title"]))

        triaged = [i for i in items if i["ai_verdict"]]
        decided = (
            db.query(Finding.ai_feedback)
            .filter(Finding.ai_feedback.in_(["ACCEPTED", "DISMISSED"]))
            .all()
        )
        accepted = sum(1 for (fb,) in decided if fb == "ACCEPTED")
        dismissed = sum(1 for (fb,) in decided if fb == "DISMISSED")
        kpis = {
            "active": len(items),
            "triaged": len(triaged),
            "likely_real": sum(1 for i in triaged if i["ai_verdict"] == "LIKELY_REAL"),
            "needs_review": sum(1 for i in triaged if i["ai_verdict"] == "NEEDS_REVIEW"),
            "likely_false_positive": sum(1 for i in triaged if i["ai_verdict"] == "LIKELY_FALSE_POSITIVE"),
            "quick_wins": sum(1 for i in items if i["fix_version"]),
            "urgent": sum(1 for i in items if i["score"] >= 50),
            "ai_accepted": accepted,
            "ai_dismissed": dismissed,
            "ai_acceptance_rate": round(accepted / (accepted + dismissed), 2) if accepted + dismissed else None,
        }
        return {
            "kpis": kpis,
            "items": items[:limit],
            "repositories": [{"id": r.id, "name": r.name} for r in sorted(repos, key=lambda r: r.name.lower())],
            "max_batch": MAX_TRIAGE_BATCH,
        }
    finally:
        db.close()


# --------------------------------------------------------------------------- triaje IA

TRIAGE_SYSTEM_PROMPT = """Eres un analista AppSec senior que hace triaje de hallazgos de escáneres
(Semgrep = SAST, Gitleaks = secretos, Trivy = dependencias SCA y configuración, OWASP ZAP = DAST).
Para cada hallazgo decide un veredicto:
- LIKELY_REAL: es explotable o claramente un problema real que hay que corregir.
- NEEDS_REVIEW: depende de contexto que no ves (uso real, configuración, flujo de datos).
- LIKELY_FALSE_POSITIVE: patrón detectado pero sin riesgo real (código de test, fixtures, ejemplos,
  valores dummy, dependencias solo de desarrollo, entrada no controlada por el usuario, etc.).
Reglas:
- Responde en español, claro y concreto. No inventes datos que no estén en el hallazgo o el fragmento.
- confidence entre 0 y 1; sé conservador si no ves el código.
- summary: 1-2 frases explicando por qué ese veredicto y el impacto.
- remediation: pasos concretos para corregir (máx. 5 pasos cortos). Puedes incluir un ejemplo breve de código
  o el comando para actualizar la dependencia. Si es probable falso positivo, explica cómo confirmarlo o suprimirlo.
- Devuelve un resultado por cada finding_id recibido, usando exactamente el mismo finding_id.
"""

TRIAGE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "finding_id": {"type": "string"},
                    "verdict": {"type": "string", "enum": list(VERDICTS)},
                    "confidence": {"type": "number"},
                    "summary": {"type": "string"},
                    "remediation": {"type": "string"},
                },
                "required": ["finding_id", "verdict", "confidence", "summary", "remediation"],
            },
        }
    },
    "required": ["results"],
}


def _raw_github_url(repo: Repository, path: str) -> str | None:
    m = _GITHUB_RE.search((repo.url or "").strip())
    if not m or not path:
        return None
    clean = path.replace("\\", "/").lstrip("./")
    return f"https://raw.githubusercontent.com/{m.group(1)}/{m.group(2)}/{repo.branch or 'main'}/{clean}"


async def _snippet(client: httpx.AsyncClient, repo: Repository | None, f: Finding) -> str | None:
    """Fragmento de código alrededor de la línea (solo repos públicos de GitHub, nunca para secretos)."""
    if repo is None or (f.engine or "") == "gitleaks" or not f.file_path or not f.line_number:
        return None
    url = _raw_github_url(repo, f.file_path)
    if not url:
        return None
    try:
        res = await client.get(url)
        if res.status_code != 200 or len(res.content) > 800_000:
            return None
        lines = res.text.splitlines()
        start = max(0, f.line_number - 13)
        end = min(len(lines), f.line_number + 12)
        block = "\n".join(f"{n + 1:>5}{'>' if n + 1 == f.line_number else ' '} {lines[n]}" for n in range(start, end))
        return block[:2500]
    except httpx.HTTPError:
        return None


class TriageBody(BaseModel):
    finding_ids: List[str] = Field(min_length=1, max_length=MAX_TRIAGE_BATCH)


@router.post("/triage")
async def fix_intel_triage(body: TriageBody, session=Depends(require_hub_write)):
    _require_db()
    actor = ((session or {}).get("email") or "").strip().lower()
    if not actor:
        raise HTTPException(status_code=401, detail="Inicia sesión para usar el triaje con IA.")
    ids = list(dict.fromkeys(body.finding_ids))

    db = SessionLocal()
    try:
        _used, remaining = _get_quota(db, actor)
        if remaining <= 0:
            raise HTTPException(
                status_code=429,
                detail=f"Límite diario de Pillow alcanzado ({PILLOW_DAILY_CREDITS} consultas). Vuelve mañana.",
            )
        findings = db.query(Finding).filter(Finding.id.in_(ids)).all()
        if not findings:
            raise HTTPException(status_code=404, detail="Hallazgos no encontrados.")
        repos = {r.id: r for r in db.query(Repository).filter(Repository.id.in_({f.repository_id for f in findings}))}

        payload: list[dict] = []
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            for f in findings:
                repo = repos.get(f.repository_id)
                pkg, version, fix = _package_info(f)
                entry: dict[str, Any] = {
                    "finding_id": f.id,
                    "engine": f.engine,
                    "severity": f.severity,
                    "title": f.title,
                    "description": (f.description or "")[:1200],
                    "file_path": f.file_path,
                    "line_number": f.line_number,
                    "cwe": f.cwe,
                    "owasp_category": f.owasp_category,
                    "test_or_example_path": _is_test_path(f.file_path),
                }
                if pkg:
                    entry["package"] = {"name": pkg, "version": version, "fixed_in": fix}
                snippet = await _snippet(client, repo, f)
                if snippet:
                    entry["code_snippet"] = snippet
                payload.append(entry)

        parsed = await call_gemini(
            f"Haz el triaje de estos {len(payload)} hallazgos.",
            {"findings": payload},
            system_prompt=TRIAGE_SYSTEM_PROMPT,
            schema=TRIAGE_SCHEMA,
            context_label="Hallazgos a analizar",
            max_tokens=4096,
        )
        results = parsed.get("results") if isinstance(parsed, dict) else None
        if not isinstance(results, list) or not results:
            raise HTTPException(status_code=502, detail="La IA no devolvió un triaje válido. Intenta de nuevo.")

        by_id = {f.id: f for f in findings}
        now = _now()
        updated = 0
        for r in results:
            if not isinstance(r, dict):
                continue
            f = by_id.get(str(r.get("finding_id") or ""))
            if not f:
                continue
            verdict = str(r.get("verdict") or "").upper()
            if verdict not in VERDICTS:
                verdict = "NEEDS_REVIEW"
            try:
                conf = max(0.0, min(1.0, float(r.get("confidence") or 0)))
            except (TypeError, ValueError):
                conf = 0.0
            f.ai_triaged = True
            f.ai_verdict = verdict
            f.ai_confidence = round(conf, 2)
            f.ai_summary = str(r.get("summary") or "").strip()[:1500]
            f.ai_remediation = str(r.get("remediation") or "").strip()[:4000]
            f.ai_triaged_at = now
            f.ai_feedback = None
            updated += 1
        if not updated:
            raise HTTPException(status_code=502, detail="La IA no devolvió un triaje válido. Intenta de nuevo.")

        credits_remaining = _consume_credit(db, actor)
        _audit(db, "FIX_INTEL_TRIAGE", f"{updated} hallazgos", ", ".join(ids)[:900], actor)
        db.commit()
        repo_names = {rid: r.name for rid, r in repos.items()}
        return {
            "items": [_item(f, repo_names) for f in findings],
            "credits_remaining": credits_remaining,
            "daily_limit": PILLOW_DAILY_CREDITS,
        }
    finally:
        db.close()


class DecisionBody(BaseModel):
    decision: Literal["accept", "dismiss"]


@router.post("/{finding_id}/decision")
def fix_intel_decision(finding_id: str, body: DecisionBody, session=Depends(require_hub_write)):
    _require_db()
    actor = ((session or {}).get("email") or "web_hub").strip().lower()
    db = SessionLocal()
    try:
        f = db.get(Finding, finding_id)
        if not f:
            raise HTTPException(status_code=404, detail="Hallazgo no encontrado.")
        if not f.ai_verdict:
            raise HTTPException(status_code=400, detail="Este hallazgo aún no tiene sugerencia de la IA.")
        repo = db.get(Repository, f.repository_id)

        if body.decision == "accept":
            f.ai_feedback = "ACCEPTED"
            if f.status in ACTIVE_STATUSES:
                f.status = "FALSE_POSITIVE" if f.ai_verdict == "LIKELY_FALSE_POSITIVE" else "IN_REVIEW"
            action = "FIX_INTEL_ACCEPTED"
        else:
            f.ai_feedback = "DISMISSED"
            action = "FIX_INTEL_DISMISSED"
        _audit(db, action, repo.name if repo else f.repository_id, f"{f.ai_verdict} · {f.title}", actor)
        if repo:
            _refresh_repo_counters(db, repo)
        db.commit()
        return _item(f, {repo.id: repo.name} if repo else {})
    finally:
        db.close()
