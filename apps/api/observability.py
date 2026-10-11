"""Observabilidad: salud de la plataforma y del pipeline de seguridad.

- Persiste cada minuto las métricas del recolector (obs_metrics) en obs_buckets.
- GET /api/v1/observability: componentes, objetivos de servicio (SLO), series, motores, rutas e incidentes.
- GET /metrics: formato de exposición de Prometheus, protegido con METRICS_TOKEN.
"""

from __future__ import annotations

import atexit
import hmac
import json
import os
import statistics
import threading
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import PlainTextResponse

import obs_metrics
from database import SessionLocal, db_ping
from models import AuditEvent, Finding, ObsBucket, RunbookExecution, Scan, SecretIncident
from workspaces import WorkspaceCtx, require_ws
from obs_metrics import LAT_BOUNDS

router = APIRouter(prefix="/api/v1/observability", tags=["Observabilidad"])
metrics_router = APIRouter(tags=["Observabilidad"])

FLUSH_SECONDS = 60
RETENTION_DAYS = 35
RANGES = {"24h": (timedelta(hours=24), "hour"), "7d": (timedelta(days=7), "day"), "30d": (timedelta(days=30), "day")}
ENGINES = [("semgrep", "Semgrep"), ("gitleaks", "Gitleaks"), ("trivy", "Trivy"), ("owasp_zap", "OWASP ZAP")]
WEBHOOK_KEY = "POST /api/v1/webhooks/github"
PILLOW_PREFIX = "/api/v1/pillow"
INCIDENT_ACTIONS = {
    "SCAN_FAILED": ("error", "Análisis fallido"),
    "ENGINE_FAILED": ("error", "Falló un motor de análisis"),
    "SCAN_CLONE_FALLBACK": ("warning", "No se pudo clonar el repositorio"),
    "SBOM_FAILED": ("warning", "No se generó el inventario de librerías"),
    "SECRET_SYNC_FAILED": ("warning", "Falló la sincronización de secretos"),
    "TRIAGE_CARRY_FAILED": ("warning", "No se traspasaron las revisiones anteriores"),
    "WEBHOOK_REPO_UNKNOWN": ("warning", "Aviso de GitHub de un repositorio no registrado"),
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _n(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def _naive(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


# --------------------------------------------------------------------------- persistencia


def flush_once() -> None:
    items = obs_metrics.drain()
    if not items:
        return
    db = SessionLocal()
    try:
        for (hour, kind, key), v in items.items():
            bucket = _naive(datetime.fromisoformat(hour))
            row = (
                db.query(ObsBucket)
                .filter(ObsBucket.bucket == bucket, ObsBucket.kind == kind, ObsBucket.key == key)
                .first()
            )
            if row is None:
                row = ObsBucket(
                    id=str(uuid.uuid4()), bucket=bucket, kind=kind, key=key[:300],
                    count=0, errors=0, client_errors=0, sum_ms=0.0, max_ms=0.0,
                    hist=json.dumps([0] * (len(LAT_BOUNDS) + 1)),
                )
                db.add(row)
            hist = json.loads(row.hist or "[]") or [0] * (len(LAT_BOUNDS) + 1)
            row.count = (row.count or 0) + v["count"]
            row.errors = (row.errors or 0) + v["errors"]
            row.client_errors = (row.client_errors or 0) + v["client_errors"]
            row.sum_ms = (row.sum_ms or 0.0) + v["sum_ms"]
            row.max_ms = max(row.max_ms or 0.0, v["max_ms"])
            row.hist = json.dumps([a + b for a, b in zip(hist, v["hist"])])
        db.commit()
    except Exception as exc:
        db.rollback()
        obs_metrics.restore(items)
        print(f"[sspillowy] observability flush failed: {exc}")
    finally:
        db.close()


def _prune() -> None:
    db = SessionLocal()
    try:
        db.query(ObsBucket).filter(ObsBucket.bucket < _naive(_now() - timedelta(days=RETENTION_DAYS))).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


_flusher_started = False


def start_flusher() -> None:
    global _flusher_started
    if _flusher_started:
        return
    _flusher_started = True

    def loop():
        last_prune = 0.0
        while True:
            time.sleep(FLUSH_SECONDS)
            flush_once()
            if time.time() - last_prune > 3600:
                _prune()
                last_prune = time.time()

    threading.Thread(target=loop, name="obs-flusher", daemon=True).start()
    atexit.register(flush_once)


# --------------------------------------------------------------------------- cálculo


def _empty() -> dict:
    return {"count": 0, "errors": 0, "client_errors": 0, "sum_ms": 0.0, "max_ms": 0.0, "hist": [0] * (len(LAT_BOUNDS) + 1)}


def _merge(into: dict, v: dict) -> dict:
    into["count"] += v["count"]
    into["errors"] += v["errors"]
    into["client_errors"] += v["client_errors"]
    into["sum_ms"] += v["sum_ms"]
    into["max_ms"] = max(into["max_ms"], v["max_ms"])
    into["hist"] = [a + b for a, b in zip(into["hist"], v["hist"])]
    return into


def _p95(agg: dict) -> float | None:
    total = agg["count"]
    if not total:
        return None
    target = 0.95 * total
    acc = 0
    for i, n in enumerate(agg["hist"]):
        if acc + n >= target and n:
            lower = LAT_BOUNDS[i - 1] if i > 0 else 0
            upper = LAT_BOUNDS[i] if i < len(LAT_BOUNDS) else max(agg["max_ms"], lower)
            return round(min(lower + (upper - lower) * (target - acc) / n, agg["max_ms"]))
        acc += n
    return round(agg["max_ms"])


def _fast(agg: dict, limit_ms: int = 1000) -> int:
    idx = LAT_BOUNDS.index(limit_ms)
    return sum(agg["hist"][: idx + 1])


def _load_buckets(db, since: datetime) -> list[dict]:
    rows: dict[tuple, dict] = {}
    for r in db.query(ObsBucket).filter(ObsBucket.bucket >= _naive(since)).all():
        hist = json.loads(r.hist or "[]") or [0] * (len(LAT_BOUNDS) + 1)
        rows[(_aware(r.bucket), r.kind, r.key)] = {
            "count": r.count or 0, "errors": r.errors or 0, "client_errors": r.client_errors or 0,
            "sum_ms": r.sum_ms or 0.0, "max_ms": r.max_ms or 0.0, "hist": hist,
        }
    for (hour, kind, key), v in obs_metrics.pending_snapshot().items():
        b = datetime.fromisoformat(hour)
        if b >= since.replace(minute=0, second=0, microsecond=0):
            _merge(rows.setdefault((b, kind, key), _empty()), v)
    return [{"bucket": b, "kind": k, "key": key, **v} for (b, k, key), v in rows.items()]


def _slo(sid: str, name: str, description: str, target: float, total: int, bad: int) -> dict:
    if not total:
        return {"id": sid, "name": name, "description": description, "target": target, "value": None,
                "total": 0, "bad": 0, "budget_remaining": None, "status": "no_data"}
    value = round(100 * (total - bad) / total, 2)
    allowed = (1 - target / 100) * total
    remaining = 100.0 if bad == 0 else (100 * (1 - bad / allowed) if allowed > 0 else -100.0)
    remaining = round(max(-100.0, min(100.0, remaining)), 1)
    status = "breached" if value < target else ("at_risk" if remaining < 25 else "ok")
    return {"id": sid, "name": name, "description": description, "target": target, "value": value,
            "total": total, "bad": bad, "budget_remaining": remaining, "status": status}


def _scan_minutes(s: Scan) -> float | None:
    if not s.completed_at or not s.created_at:
        return None
    return max(0.0, (_aware(s.completed_at) - _aware(s.created_at)).total_seconds() / 60)


def _engine_availability() -> dict[str, tuple[bool, str]]:
    out: dict[str, tuple[bool, str]] = {}
    try:
        from semgrep_scan import semgrep_available

        out["semgrep"] = (semgrep_available(), "")
    except Exception:
        out["semgrep"] = (False, "")
    try:
        from gitleaks_scan import gitleaks_available

        out["gitleaks"] = (gitleaks_available(), "")
    except Exception:
        out["gitleaks"] = (False, "")
    try:
        from trivy_scan import trivy_available

        out["trivy"] = (trivy_available(), "")
    except Exception:
        out["trivy"] = (False, "")
    try:
        from zap_scan import zap_available, zap_binary

        full = bool(zap_binary())
        out["owasp_zap"] = (full or zap_available(), "completo" if full else "modo liviano")
    except Exception:
        out["owasp_zap"] = (False, "")
    return out


def _db_latency() -> float | None:
    t0 = time.perf_counter()
    ok = db_ping()
    return round((time.perf_counter() - t0) * 1000, 1) if ok else None


def compute_observability(
    db, range_key: str = "24h", now: datetime | None = None, *, workspace_id: str, repo_ids: list[str]
) -> dict:
    """La salud de la API, el correo y Pillow es de toda la plataforma; análisis e incidentes, solo del espacio."""
    now = now or _now()
    repo_ids = repo_ids or ["__none__"]
    span, step = RANGES.get(range_key, RANGES["24h"])
    since = now - span
    buckets = _load_buckets(db, since)
    http = [b for b in buckets if b["kind"] == "http"]
    api = [b for b in http if PILLOW_PREFIX not in b["key"]]
    email = [b for b in buckets if b["kind"] == "email"]
    pillow = [b for b in buckets if b["kind"] == "pillow"]
    api_agg = _empty()
    for b in api:
        _merge(api_agg, b)
    email_agg = _empty()
    for b in email:
        _merge(email_agg, b)
    pillow_agg = _empty()
    for b in pillow:
        _merge(pillow_agg, b)

    scans = db.query(Scan).filter(Scan.created_at >= _naive(since), Scan.repository_id.in_(repo_ids)).all()
    finished = [s for s in scans if s.status in ("COMPLETED", "FAILED")]
    completed = [s for s in finished if s.status == "COMPLETED"]
    durations = [m for m in (_scan_minutes(s) for s in completed) if m is not None]
    stale_minutes = int(os.getenv("STALE_SCAN_MINUTES", "20"))
    running = db.query(Scan).filter(Scan.status == "RUNNING", Scan.repository_id.in_(repo_ids)).all()
    stuck = [s for s in running if _aware(s.created_at) < now - timedelta(minutes=stale_minutes)]

    # Motores
    engine_runs: dict[str, list[dict]] = defaultdict(list)
    for s in finished:
        try:
            st = json.loads(s.engine_stats) if s.engine_stats else None
        except ValueError:
            st = None
        if st:
            for name, v in st.items():
                engine_runs[name].append({"s": v.get("s"), "ok": bool(v.get("ok")), "at": _aware(s.created_at)})
        elif s.engines_ok:
            for name in s.engines_ok.split(","):
                if name.strip():
                    engine_runs[name.strip()].append({"s": None, "ok": True, "at": _aware(s.created_at)})
    avail = _engine_availability()
    engines = []
    for eid, ename in ENGINES:
        runs = engine_runs.get(eid, [])
        secs = sorted(r["s"] for r in runs if r["s"] is not None)
        fails = sum(1 for r in runs if not r["ok"])
        engines.append({
            "id": eid, "name": ename, "available": avail[eid][0], "mode": avail[eid][1],
            "runs": len(runs), "failures": fails,
            "success_pct": round(100 * (len(runs) - fails) / len(runs)) if runs else None,
            "avg_s": round(statistics.fmean(secs), 1) if secs else None,
            "p95_s": round(secs[min(len(secs) - 1, int(0.95 * len(secs)))], 1) if secs else None,
            "last_run": max((r["at"] for r in runs), default=None),
        })
    clone = engine_runs.get("clone", [])
    clone_secs = [r["s"] for r in clone if r["s"] is not None]

    # Componentes
    components = []
    uptime = (now - obs_metrics.STARTED_AT).total_seconds()
    components.append({"id": "api", "name": "API", "status": "up", "detail": "En línea", "since": obs_metrics.STARTED_AT.isoformat()})
    lat = _db_latency()
    components.append({
        "id": "database", "name": "Base de datos",
        "status": "up" if lat is not None and lat < 500 else ("degraded" if lat is not None else "down"),
        "detail": f"Responde en {lat} ms" if lat is not None else "Sin conexión",
    })
    components.append({
        "id": "worker", "name": "Cola de análisis",
        "status": "degraded" if stuck else "up",
        "detail": f"{len(stuck)} {'análisis atascado' if len(stuck) == 1 else 'análisis atascados'}" if stuck else (f"{len(running)} en curso" if running else "Sin análisis en curso"),
    })
    for e in engines:
        status = "up" if e["available"] else "down"
        detail = "Disponible" + (f" ({e['mode']})" if e["mode"] else "") if e["available"] else "No instalado en el servidor"
        if e["available"] and e["runs"] >= 2 and e["failures"] / e["runs"] >= 0.5:
            status, detail = "degraded", f"{e['failures']} de {e['runs']} ejecuciones fallaron"
        components.append({"id": e["id"], "name": e["name"], "status": status, "detail": detail})

    hook = [b for b in http if b["key"] == WEBHOOK_KEY and b["count"]]
    hook_last = max((b["bucket"] for b in hook), default=None)
    hook_errors = sum(b["errors"] for b in hook)
    if not os.getenv("GITHUB_WEBHOOK_SECRET", "").strip():
        components.append({"id": "webhook", "name": "Webhook de GitHub", "status": "unconfigured", "detail": "Sin configurar"})
    else:
        components.append({
            "id": "webhook", "name": "Webhook de GitHub",
            "status": "degraded" if hook_errors else "up",
            "detail": _n(hook_errors, "aviso con error", "avisos con error") if hook_errors
            else (_n(sum(b["count"] for b in hook), "aviso recibido", "avisos recibidos") if hook else "Sin avisos en el periodo"),
            "last": hook_last.isoformat() if hook_last else None,
        })

    from email_service import mailer_configured

    if not mailer_configured():
        components.append({"id": "email", "name": "Correo", "status": "unconfigured", "detail": "Sin configurar"})
    else:
        bad = email_agg["errors"]
        components.append({
            "id": "email", "name": "Correo",
            "status": "degraded" if email_agg["count"] and bad / email_agg["count"] > 0.2 else "up",
            "detail": f"{_n(email_agg['count'] - bad, 'enviado', 'enviados')}, {bad} con error" if email_agg["count"] else "Sin envíos en el periodo",
        })

    if not os.getenv("GEMINI_API_KEY", "").strip():
        components.append({"id": "pillow", "name": "Pillow", "status": "unconfigured", "detail": "Sin activar"})
    else:
        bad = pillow_agg["errors"]
        components.append({
            "id": "pillow", "name": "Pillow",
            "status": "degraded" if pillow_agg["count"] >= 3 and bad / pillow_agg["count"] > 0.2 else "up",
            "detail": f"{_n(pillow_agg['count'], 'consulta', 'consultas')}, {bad} con error" if pillow_agg["count"] else "Sin consultas en el periodo",
        })

    critical = {"api", "database"}
    if any(c["status"] == "down" and c["id"] in critical for c in components):
        overall = "down"
    elif any(c["status"] in ("down", "degraded") for c in components):
        overall = "degraded"
    else:
        overall = "operational"

    # Objetivos de servicio
    slos = [
        _slo("api_availability", "Disponibilidad de la API", "Peticiones respondidas sin error del servidor.",
             99.5, api_agg["count"], api_agg["errors"]),
        _slo("api_latency", "Velocidad de la API", "Peticiones respondidas en menos de 1 segundo.",
             95.0, api_agg["count"], api_agg["count"] - _fast(api_agg)),
        _slo("scan_success", "Análisis exitosos", "Análisis que terminan con resultados.",
             95.0, len(finished), len(finished) - len(completed)),
        _slo("scan_duration", "Análisis a tiempo", "Análisis que terminan en menos de 15 minutos.",
             90.0, len(durations), sum(1 for m in durations if m > 15)),
    ]
    if pillow_agg["count"]:
        slos.append(_slo("pillow", "Respuestas de Pillow", "Consultas a Pillow respondidas sin error.",
                         95.0, pillow_agg["count"], pillow_agg["errors"]))

    # Series
    def floor(dt: datetime) -> datetime:
        dt = dt.astimezone(timezone.utc)
        return dt.replace(minute=0, second=0, microsecond=0) if step == "hour" else dt.replace(hour=0, minute=0, second=0, microsecond=0)

    delta = timedelta(hours=1) if step == "hour" else timedelta(days=1)
    points: dict[datetime, dict] = {}
    t = floor(since + delta)
    while t <= now:
        points[t] = {"agg": _empty(), "scans_ok": 0, "scans_failed": 0, "minutes": []}
        t += delta
    for b in api:
        p = points.get(floor(b["bucket"]))
        if p:
            _merge(p["agg"], b)
    for s in finished:
        p = points.get(floor(_aware(s.created_at)))
        if p:
            p["scans_ok" if s.status == "COMPLETED" else "scans_failed"] += 1
            m = _scan_minutes(s)
            if s.status == "COMPLETED" and m is not None:
                p["minutes"].append(m)
    series = [
        {
            "t": t.isoformat(),
            "requests": p["agg"]["count"],
            "errors": p["agg"]["errors"],
            "p95_ms": _p95(p["agg"]),
            "scans_ok": p["scans_ok"],
            "scans_failed": p["scans_failed"],
            "scan_minutes": round(statistics.fmean(p["minutes"]), 1) if p["minutes"] else None,
        }
        for t, p in sorted(points.items())
    ]

    # Rutas
    per_route: dict[str, dict] = defaultdict(_empty)
    for b in http:
        _merge(per_route[b["key"]], b)
    routes = []
    for key, agg in sorted(per_route.items(), key=lambda kv: -kv[1]["count"])[:15]:
        method, _, path = key.partition(" ")
        routes.append({
            "method": method, "path": path, "count": agg["count"],
            "error_pct": round(100 * agg["errors"] / agg["count"], 1) if agg["count"] else 0,
            "client_error_pct": round(100 * agg["client_errors"] / agg["count"], 1) if agg["count"] else 0,
            "avg_ms": round(agg["sum_ms"] / agg["count"]) if agg["count"] else None,
            "p95_ms": _p95(agg),
        })

    # Incidentes
    incidents = []
    for e in (
        db.query(AuditEvent)
        .filter(
            AuditEvent.action.in_(list(INCIDENT_ACTIONS)),
            AuditEvent.created_at >= _naive(since),
            AuditEvent.workspace_id == workspace_id,
        )
        .order_by(AuditEvent.created_at.desc())
        .limit(40)
        .all()
    ):
        sev, title = INCIDENT_ACTIONS[e.action]
        incidents.append({"at": _aware(e.created_at).isoformat(), "severity": sev, "title": title,
                          "target": e.target, "detail": (e.detail or "")[:300]})
    for x in (
        db.query(RunbookExecution)
        .filter(
            RunbookExecution.status == "FAILED",
            RunbookExecution.created_at >= _naive(since),
            RunbookExecution.workspace_id == workspace_id,
        )
        .order_by(RunbookExecution.created_at.desc())
        .limit(20)
        .all()
    ):
        incidents.append({"at": _aware(x.created_at).isoformat(), "severity": "warning", "title": "Falló una automatización",
                          "target": x.runbook_name, "detail": (x.summary or "")[:300]})
    for s in stuck:
        incidents.append({"at": _aware(s.created_at).isoformat(), "severity": "warning", "title": "Análisis atascado",
                          "target": s.repository.name if s.repository else s.repository_id,
                          "detail": f"Lleva más de {stale_minutes} minutos en curso ({s.progress_stage or 'sin etapa'})."})
    for b in http:
        if b["errors"]:
            incidents.append({"at": b["bucket"].isoformat(), "severity": "error", "title": "Errores del servidor",
                              "target": b["key"], "detail": f"{b['errors']} de {b['count']} peticiones fallaron en esa hora."})
    incidents.sort(key=lambda i: i["at"], reverse=True)

    p95 = _p95(api_agg)
    return {
        "range": range_key if range_key in RANGES else "24h",
        "generated_at": now.isoformat(),
        "status": overall,
        "uptime_seconds": round(uptime),
        "components": components,
        "slos": slos,
        "kpis": {
            "requests": api_agg["count"],
            "error_pct": round(100 * api_agg["errors"] / api_agg["count"], 2) if api_agg["count"] else None,
            "p95_ms": p95,
            "avg_ms": round(api_agg["sum_ms"] / api_agg["count"]) if api_agg["count"] else None,
            "scans": len(finished),
            "scan_success_pct": round(100 * len(completed) / len(finished)) if finished else None,
            "scan_median_minutes": round(statistics.median(durations), 1) if durations else None,
            "clone_avg_s": round(statistics.fmean(clone_secs), 1) if clone_secs else None,
            "running": len(running),
        },
        "series": series,
        "engines": [{**e, "last_run": e["last_run"].isoformat() if e["last_run"] else None} for e in engines],
        "routes": routes,
        "incidents": incidents[:30],
        "integrations": {
            "prometheus": bool(os.getenv("METRICS_TOKEN", "").strip()),
            "metrics_url": (os.getenv("API_PUBLIC_URL") or "https://api.sspillowy.com").rstrip("/") + "/metrics",
            "grafana_url": os.getenv("GRAFANA_URL", "").strip() or None,
        },
    }


# --------------------------------------------------------------------------- API


@router.get("")
def observability_overview(range: str = Query(default="24h"), ws: WorkspaceCtx = Depends(require_ws)):
    if range not in RANGES:
        raise HTTPException(status_code=400, detail="Rango no válido. Usa 24h, 7d o 30d.")
    db = SessionLocal()
    try:
        return compute_observability(db, range, workspace_id=ws.id, repo_ids=ws.repo_ids)
    finally:
        db.close()


def _esc(v: str) -> str:
    return str(v).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _labels(**kw: str) -> str:
    return "{" + ",".join(f'{k}="{_esc(v)}"' for k, v in kw.items()) + "}"


def render_prometheus(db) -> str:
    out: list[str] = []

    def metric(name: str, kind: str, help_text: str, samples: list[tuple[str, float]]) -> None:
        out.append(f"# HELP {name} {help_text}")
        out.append(f"# TYPE {name} {kind}")
        for labels, value in samples:
            out.append(f"{name}{labels} {value}")

    metric("sspillowy_up", "gauge", "La API está en línea.", [("", 1)])
    metric("sspillowy_uptime_seconds", "gauge", "Segundos desde el último arranque.",
           [("", round((_now() - obs_metrics.STARTED_AT).total_seconds()))])
    lat = _db_latency()
    metric("sspillowy_database_up", "gauge", "La base de datos responde.", [("", 1 if lat is not None else 0)])
    if lat is not None:
        metric("sspillowy_database_ping_seconds", "gauge", "Latencia de la base de datos.", [("", lat / 1000)])

    totals = obs_metrics.totals_snapshot()
    req, dur_b, dur_s, dur_c = [], [], [], []
    per_key: dict[str, dict] = defaultdict(_empty)
    for (kind, key, label), v in totals.items():
        if kind != "http":
            continue
        method, _, path = key.partition(" ")
        req.append((_labels(method=method, route=path, status=label), v["count"]))
        _merge(per_key[key], v)
    for key, v in per_key.items():
        method, _, path = key.partition(" ")
        acc = 0
        for i, bound in enumerate(LAT_BOUNDS):
            acc += v["hist"][i]
            dur_b.append((_labels(method=method, route=path, le=str(bound / 1000)), acc))
        dur_b.append((_labels(method=method, route=path, le="+Inf"), v["count"]))
        dur_s.append((_labels(method=method, route=path), round(v["sum_ms"] / 1000, 4)))
        dur_c.append((_labels(method=method, route=path), v["count"]))
    metric("sspillowy_http_requests_total", "counter", "Peticiones HTTP por ruta y clase de estado.", req)
    out.append("# HELP sspillowy_http_request_duration_seconds Duración de las peticiones HTTP.")
    out.append("# TYPE sspillowy_http_request_duration_seconds histogram")
    out.extend(f"sspillowy_http_request_duration_seconds_bucket{lb} {v}" for lb, v in dur_b)
    out.extend(f"sspillowy_http_request_duration_seconds_sum{lb} {v}" for lb, v in dur_s)
    out.extend(f"sspillowy_http_request_duration_seconds_count{lb} {v}" for lb, v in dur_c)

    for kind, name, help_text in (
        ("email", "sspillowy_email_sends_total", "Correos enviados por resultado."),
        ("pillow", "sspillowy_pillow_requests_total", "Consultas a Pillow por resultado."),
    ):
        samples = [(_labels(result=label), v["count"]) for (k, _, label), v in totals.items() if k == kind]
        metric(name, "counter", help_text, samples or [(_labels(result="ok"), 0)])

    since = _naive(_now() - timedelta(hours=24))
    scans = db.query(Scan).filter(Scan.created_at >= since).all()
    by_status: dict[str, int] = defaultdict(int)
    for s in scans:
        by_status[s.status or "UNKNOWN"] += 1
    metric("sspillowy_scans_last_24h", "gauge", "Análisis creados en las últimas 24 horas por estado.",
           [(_labels(status=k), v) for k, v in sorted(by_status.items())] or [(_labels(status="COMPLETED"), 0)])
    mins = [m for m in (_scan_minutes(s) for s in scans if s.status == "COMPLETED") if m is not None]
    metric("sspillowy_scan_duration_seconds_avg_24h", "gauge", "Duración media de los análisis completados (24 h).",
           [("", round(statistics.fmean(mins) * 60, 1) if mins else 0)])
    metric("sspillowy_scans_running", "gauge", "Análisis en curso.",
           [("", db.query(Scan).filter(Scan.status == "RUNNING").count())])
    metric("sspillowy_engine_available", "gauge", "Motor de análisis instalado.",
           [(_labels(engine=k), 1 if v[0] else 0) for k, v in _engine_availability().items()])
    sev_rows = db.query(Finding.severity).filter(Finding.status.in_(["OPEN", "IN_REVIEW"])).all()
    sev: dict[str, int] = defaultdict(int)
    for (s,) in sev_rows:
        sev[(s or "INFO").upper()] += 1
    metric("sspillowy_findings_open", "gauge", "Hallazgos abiertos por severidad.",
           [(_labels(severity=k), sev.get(k, 0)) for k in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")])
    metric("sspillowy_secret_incidents_open", "gauge", "Secretos expuestos pendientes.",
           [("", db.query(SecretIncident).filter(SecretIncident.status.in_(["OPEN", "IN_PROGRESS"])).count())])
    return "\n".join(out) + "\n"


@metrics_router.get("/metrics", response_class=PlainTextResponse, include_in_schema=False)
def prometheus_metrics(authorization: str = Header(default="")):
    token = os.getenv("METRICS_TOKEN", "").strip()
    if not token:
        raise HTTPException(status_code=404, detail="Métricas no habilitadas")
    if not hmac.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        raise HTTPException(status_code=401, detail="Token de métricas no válido")
    db = SessionLocal()
    try:
        return PlainTextResponse(render_prometheus(db), media_type="text/plain; version=0.0.4; charset=utf-8")
    finally:
        db.close()
