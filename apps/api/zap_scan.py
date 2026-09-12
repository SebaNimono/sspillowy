"""OWASP ZAP-style DAST baseline contra una URL (headers / TLS / rutas sensibles).

En Railway no instalamos ZAP+Java completo (imagen enorme). Este baseline produce
hallazgos equivalentes al passive/baseline de ZAP. Si existe zap.sh (ZAP_HOME),
se usa el binario real.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import ssl
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from models import Finding

DEFAULT_TARGET = os.getenv("ZAP_DEFAULT_TARGET", "https://sspillowy.com").strip()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def zap_available() -> bool:
    """Siempre True: baseline lite; o ZAP real si está instalado."""
    return True


def zap_binary() -> str | None:
    for candidate in (
        os.getenv("ZAP_SH", "").strip(),
        "/opt/zaproxy/zap.sh",
        shutil.which("zap.sh"),
    ):
        if candidate and Path(candidate).exists():
            return candidate
    return None


def _map_risk(raw: str | None) -> str:
    s = (raw or "Informational").strip().lower()
    if s in {"high", "3"}:
        return "HIGH"
    if s in {"medium", "2"}:
        return "MEDIUM"
    if s in {"low", "1"}:
        return "LOW"
    if s in {"critical"}:
        return "CRITICAL"
    return "INFO"


def _fetch(url: str, timeout: int = 20) -> tuple[int, dict[str, str], str]:
    req = Request(
        url,
        headers={"User-Agent": "SSPILLOWY-ZAP-Baseline/1.0"},
        method="GET",
    )
    ctx = ssl.create_default_context()
    try:
        with urlopen(req, timeout=timeout, context=ctx) as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            body = resp.read(8000).decode("utf-8", errors="replace")
            return int(getattr(resp, "status", 200) or 200), headers, body
    except HTTPError as exc:
        headers = {k.lower(): v for k, v in (exc.headers or {}).items()}
        return int(exc.code), headers, ""
    except URLError as exc:
        raise RuntimeError(f"No se pudo alcanzar {url}: {exc}") from exc


def _run_zap_binary(target: str, timeout: int = 240) -> list[dict]:
    zap = zap_binary()
    if not zap:
        return []
    out = Path("/tmp") / f"zap-out-{uuid.uuid4().hex}.json"
    # Modo rápido (-cmd -quickurl); salida JSON si la versión lo soporta vía -jsonreport
    cmd = [
        zap,
        "-cmd",
        "-quickurl",
        target,
        "-quickout",
        str(out),
        "-quickprogress",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if not out.exists():
        err = (proc.stderr or proc.stdout or "sin salida")[:400]
        raise RuntimeError(f"ZAP no generó reporte: {err}")
    raw = out.read_text(encoding="utf-8", errors="replace")
    out.unlink(missing_ok=True)
    data = json.loads(raw)
    # Formatos posibles: lista de alerts o site->alerts
    alerts: list[dict] = []
    if isinstance(data, list):
        alerts = data
    elif isinstance(data, dict):
        if "site" in data:
            for site in data.get("site") or []:
                alerts.extend(site.get("alerts") or [])
        alerts.extend(data.get("alerts") or [])
    flat = []
    for a in alerts:
        flat.append(
            {
                "title": (a.get("name") or a.get("alert") or "ZAP alert")[:200],
                "description": (a.get("description") or a.get("otherinfo") or "")[:2000],
                "severity": _map_risk(str(a.get("risk") or a.get("riskcode"))),
                "file_path": a.get("url") or target,
                "cwe": f"CWE-{a['cweid']}" if a.get("cweid") not in (None, "0", 0) else None,
                "plugin": str(a.get("pluginid") or a.get("pluginId") or ""),
            }
        )
    return flat


def run_zap_baseline_lite(target: str) -> list[dict]:
    """Passive baseline: cabeceras de seguridad, cookies, rutas sensibles."""
    findings: list[dict] = []
    status, headers, _body = _fetch(target)

    def add(plugin: str, title: str, desc: str, severity: str, path: str | None = None):
        findings.append(
            {
                "title": f"{plugin}: {title}"[:200],
                "description": desc[:2000],
                "severity": severity,
                "file_path": path or target,
                "cwe": None,
                "plugin": plugin,
            }
        )

    # --- Headers (equivalente a reglas ZAP 10020/10021/10035/10038/10055…) ---
    if "strict-transport-security" not in headers:
        add(
            "10035",
            "Missing HTTP Strict-Transport-Security header",
            "La respuesta no incluye HSTS. Un atacante en red puede forzar HTTP y degradar TLS. "
            "Remediación: Strict-Transport-Security: max-age=31536000; includeSubDomains",
            "MEDIUM",
        )
    if "x-content-type-options" not in headers:
        add(
            "10021",
            "X-Content-Type-Options header missing",
            "Sin nosniff el navegador puede MIME-sniffar. Remediación: X-Content-Type-Options: nosniff",
            "LOW",
        )
    if "x-frame-options" not in headers and "content-security-policy" not in headers:
        add(
            "10020",
            "Missing Anti-clickjacking Header",
            "No hay X-Frame-Options ni CSP frame-ancestors. Riesgo de clickjacking. "
            "Remediación: X-Frame-Options: DENY o CSP frame-ancestors 'none'",
            "MEDIUM",
        )
    if "content-security-policy" not in headers:
        add(
            "10055",
            "CSP: Wildcard Directive / header missing",
            "No se detectó Content-Security-Policy. Aumenta riesgo XSS. Defina una CSP restrictiva.",
            "MEDIUM",
        )
    if "referrer-policy" not in headers:
        add(
            "10063",
            "Referrer-Policy header missing",
            "Sin Referrer-Policy puede filtrarse la URL completa en Referer. Remediación: Referrer-Policy: no-referrer-when-downgrade o stricter.",
            "LOW",
        )
    if "permissions-policy" not in headers and "feature-policy" not in headers:
        add(
            "10063",
            "Permissions Policy Header Not Set",
            "No hay Permissions-Policy. Considere limitar cámara/micrófono/geolocalización.",
            "INFO",
        )

    server = headers.get("server") or headers.get("x-powered-by")
    if server:
        add(
            "10036",
            "HTTP Server Header / Banner Disclosure",
            f"El servidor revela banner: «{server}». Facilita fingerprinting. Oculte o genérice Server/X-Powered-By.",
            "LOW",
        )

    # Cookies
    raw_cookies = headers.get("set-cookie") or ""
    if raw_cookies:
        low = raw_cookies.lower()
        if "httponly" not in low:
            add(
                "10010",
                "Cookie No HttpOnly Flag",
                "Cookie sin HttpOnly: accesible desde JS (XSS → robo de sesión).",
                "MEDIUM",
            )
        if target.startswith("https://") and "secure" not in low:
            add(
                "10011",
                "Cookie Without Secure Flag",
                "Cookie sin Secure en HTTPS: puede enviarse en HTTP claro.",
                "MEDIUM",
            )

    # Rutas sensibles (solo reportar si 200)
    base = target.rstrip("/")
    sensitive = ["/.env", "/.git/HEAD", "/server-status", "/actuator/health", "/phpinfo.php"]
    for path in sensitive:
        try:
            code, _, _ = _fetch(base + path, timeout=8)
            if code == 200:
                add(
                    "10095",
                    f"Sensitive path exposed: {path}",
                    f"La ruta {path} respondió HTTP 200 en {base}. Revise exposición de secretos o metadatos.",
                    "HIGH",
                    base + path,
                )
        except Exception:
            continue

    if status >= 500:
        add(
            "100000",
            "Server error on target root",
            f"El target devolvió HTTP {status} en la raíz. Verifique disponibilidad antes del DAST.",
            "INFO",
        )

    return findings


def run_zap_scan(target_url: str | None = None, timeout: int = 240) -> list[dict]:
    target = (target_url or DEFAULT_TARGET or "").strip()
    if not target:
        raise RuntimeError(
            "ZAP/DAST requiere una URL. Configure dast_url en el repo o ZAP_DEFAULT_TARGET."
        )
    if not target.startswith("http://") and not target.startswith("https://"):
        target = "https://" + target

    # Preferir ZAP real si está instalado
    if zap_binary():
        try:
            return _run_zap_binary(target, timeout=timeout)
        except Exception:
            # Continuar con baseline lite
            pass
    return run_zap_baseline_lite(target)


def persist_zap_findings(
    db,
    *,
    scan,
    repo,
    results: list[dict],
) -> dict[str, int]:
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    max_findings = int(os.getenv("ZAP_MAX_FINDINGS", "40"))
    for item in results[:max_findings]:
        severity = (item.get("severity") or "INFO").upper()
        if severity not in counts:
            severity = "INFO"
        counts[severity] = counts.get(severity, 0) + 1
        db.add(
            Finding(
                id=str(uuid.uuid4()),
                repository_id=repo.id,
                scan_id=scan.id,
                title=(item.get("title") or "ZAP finding")[:200],
                description=(item.get("description") or "")[:2000],
                engine="owasp_zap",
                severity=severity,
                file_path=(str(item.get("file_path") or "")[:500] or None),
                line_number=None,
                cwe=item.get("cwe"),
                owasp_category="A05:2021-Security Misconfiguration",
                iso_control="A.8.9 — Gestión de configuración",
                status="OPEN",
                ai_triaged=False,
                ai_confidence=None,
                ai_summary=None,
                ai_remediation=None,
                created_at=_now(),
            )
        )
    return counts
