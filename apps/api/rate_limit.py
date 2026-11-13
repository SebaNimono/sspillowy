import threading
import time
from collections import defaultdict, deque
from fastapi import Request
from fastapi.responses import JSONResponse

_LOCK = threading.Lock()
_BUCKETS: dict[str, deque[float]] = defaultdict(deque)

# Límites (max_requests, window_seconds) por prefijo de ruta sensible
SENSITIVE_RULES: list[tuple[str, int, int]] = [
    ("/api/v1/auth/login", 10, 60),
    ("/api/v1/auth/register", 5, 60),
    ("/api/v1/auth/forgot-password", 5, 300),
    ("/api/v1/auth/reset-password", 5, 300),
    ("/api/v1/auth/resend-verification", 5, 300),
    ("/api/v1/scans", 20, 60),
    ("/api/v1/pillow/chat", 30, 60),
]
DEFAULT_MUTATION_LIMIT = (120, 60)


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def rate_limit_middleware(request: Request, call_next):
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return await call_next(request)

    path = request.url.path
    limit, window = DEFAULT_MUTATION_LIMIT
    for prefix, rule_limit, rule_window in SENSITIVE_RULES:
        if path.startswith(prefix):
            limit, window = rule_limit, rule_window
            break

    key = f"{_client_ip(request)}:{path}"
    now = time.monotonic()

    with _LOCK:
        q = _BUCKETS[key]
        while q and (now - q[0]) > window:
            q.popleft()
        if len(q) >= limit:
            retry_after = max(1, int(window - (now - q[0])))
            return JSONResponse(
                status_code=429,
                content={"detail": "Demasiadas solicitudes. Intenta nuevamente más tarde."},
                headers={"Retry-After": str(retry_after)},
            )
        q.append(now)

    return await call_next(request)
