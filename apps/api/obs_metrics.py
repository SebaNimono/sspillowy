"""Recolector de métricas de funcionamiento en memoria.

Acumula por hora (para la consola, se persiste en obs_buckets) y en totales desde el arranque
(para /metrics en formato Prometheus).
"""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

# Tramos de latencia en milisegundos; el último tramo implícito es +Inf.
LAT_BOUNDS = [50, 100, 250, 500, 1000, 2500, 5000, 10000]

STARTED_AT = datetime.now(timezone.utc)
_lock = threading.Lock()
_pending: dict[tuple[str, str, str], dict] = {}
_totals: dict[tuple[str, str, str], dict] = {}


def _empty() -> dict:
    return {"count": 0, "errors": 0, "client_errors": 0, "sum_ms": 0.0, "max_ms": 0.0, "hist": [0] * (len(LAT_BOUNDS) + 1)}


def _slot(ms: float) -> int:
    for i, bound in enumerate(LAT_BOUNDS):
        if ms <= bound:
            return i
    return len(LAT_BOUNDS)


def _add(agg: dict, ms: float, error: bool, client_error: bool) -> None:
    agg["count"] += 1
    agg["errors"] += 1 if error else 0
    agg["client_errors"] += 1 if client_error else 0
    agg["sum_ms"] += ms
    agg["max_ms"] = max(agg["max_ms"], ms)
    agg["hist"][_slot(ms)] += 1


def record(kind: str, key: str, ms: float, *, error: bool = False, client_error: bool = False, label: str = "") -> None:
    """kind: http | email | pillow. label distingue series en Prometheus (p. ej. clase de estado HTTP)."""
    hour = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0).isoformat()
    with _lock:
        _add(_pending.setdefault((hour, kind, key), _empty()), ms, error, client_error)
        _add(_totals.setdefault((kind, key, label), _empty()), ms, error, client_error)


def drain() -> dict[tuple[str, str, str], dict]:
    global _pending
    with _lock:
        out, _pending = _pending, {}
    return out


def restore(items: dict[tuple[str, str, str], dict]) -> None:
    """Devuelve al buffer lo que no se pudo guardar."""
    with _lock:
        for k, v in items.items():
            cur = _pending.setdefault(k, _empty())
            cur["count"] += v["count"]
            cur["errors"] += v["errors"]
            cur["client_errors"] += v["client_errors"]
            cur["sum_ms"] += v["sum_ms"]
            cur["max_ms"] = max(cur["max_ms"], v["max_ms"])
            cur["hist"] = [a + b for a, b in zip(cur["hist"], v["hist"])]


def pending_snapshot() -> dict[tuple[str, str, str], dict]:
    with _lock:
        return {k: {**v, "hist": list(v["hist"])} for k, v in _pending.items()}


def totals_snapshot() -> dict[tuple[str, str, str], dict]:
    with _lock:
        return {k: {**v, "hist": list(v["hist"])} for k, v in _totals.items()}


class Timer:
    """with Timer("email", "send") as t: ...; t.error = True si falló."""

    def __init__(self, kind: str, key: str):
        self.kind, self.key, self.error = kind, key, False

    def __enter__(self) -> "Timer":
        self._t0 = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        ms = (time.perf_counter() - self._t0) * 1000
        failed = self.error or exc_type is not None
        record(self.kind, self.key, ms, error=failed, label="error" if failed else "ok")


class MetricsMiddleware:
    """Middleware ASGI: cuenta peticiones, errores y latencia por ruta."""

    SKIP = {"/metrics", "/health"}

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") == "OPTIONS":
            await self.app(scope, receive, send)
            return
        t0 = time.perf_counter()
        status = {"code": 500}

        async def _send(message):
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, _send)
        finally:
            route = scope.get("route")
            path = getattr(route, "path", None) or "unmatched"
            if path not in self.SKIP:
                code = status["code"]
                record(
                    "http",
                    f"{scope.get('method', 'GET')} {path}",
                    (time.perf_counter() - t0) * 1000,
                    error=code >= 500,
                    client_error=400 <= code < 500,
                    label=f"{code // 100}xx",
                )
