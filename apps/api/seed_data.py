"""
Seed de datos reales (repos, scans, findings, audit, security gate).

Uso:
  cd apps/api
  python seed_data.py

Idempotente: usa IDs fijos; si ya existen, actualiza/completa sin duplicar.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from database import SessionLocal, init_db, db_ping
from models import AuditEvent, Finding, Repository, Scan, SecurityGate

NOW = datetime.now(timezone.utc)


def _ago(days: int = 0, hours: int = 0) -> datetime:
    return NOW - timedelta(days=days, hours=hours)


REPOS = [
    {
        "id": "repo-sspillowy-api",
        "name": "sspillowy-backend-api",
        "url": "https://github.com/sspillowy/sspillowy-backend",
        "branch": "main",
        "is_active": True,
        "health_score": 78,
        "open_criticals": 1,
        "open_highs": 1,
        "total_findings": 4,
        "last_scan_at": _ago(hours=6),
        "created_at": _ago(days=14),
    },
    {
        "id": "repo-payment-gateway",
        "name": "payment-gateway-service",
        "url": "https://github.com/sspillowy/payment-gateway",
        "branch": "develop",
        "is_active": True,
        "health_score": 55,
        "open_criticals": 2,
        "open_highs": 2,
        "total_findings": 5,
        "last_scan_at": _ago(hours=3),
        "created_at": _ago(days=21),
    },
    {
        "id": "repo-auth-identity",
        "name": "auth-identity-provider",
        "url": "https://github.com/sspillowy/auth-service",
        "branch": "main",
        "is_active": True,
        "health_score": 92,
        "open_criticals": 0,
        "open_highs": 1,
        "total_findings": 2,
        "last_scan_at": _ago(days=1),
        "created_at": _ago(days=30),
    },
]

SCANS = [
    {
        "id": "scan-api-001",
        "repository_id": "repo-sspillowy-api",
        "status": "COMPLETED",
        "triggered_by": "webhook",
        "branch": "main",
        "total_findings": 4,
        "critical_count": 1,
        "high_count": 1,
        "medium_count": 1,
        "low_count": 1,
        "created_at": _ago(hours=7),
        "completed_at": _ago(hours=6),
    },
    {
        "id": "scan-pay-001",
        "repository_id": "repo-payment-gateway",
        "status": "COMPLETED",
        "triggered_by": "web_hub",
        "branch": "develop",
        "total_findings": 5,
        "critical_count": 2,
        "high_count": 2,
        "medium_count": 1,
        "low_count": 0,
        "created_at": _ago(hours=4),
        "completed_at": _ago(hours=3),
    },
    {
        "id": "scan-auth-001",
        "repository_id": "repo-auth-identity",
        "status": "COMPLETED",
        "triggered_by": "ci",
        "branch": "main",
        "total_findings": 2,
        "critical_count": 0,
        "high_count": 1,
        "medium_count": 1,
        "low_count": 0,
        "created_at": _ago(days=1, hours=2),
        "completed_at": _ago(days=1),
    },
    {
        "id": "scan-pay-002",
        "repository_id": "repo-payment-gateway",
        "status": "COMPLETED",
        "triggered_by": "web_hub",
        "branch": "develop",
        "total_findings": 0,
        "critical_count": 0,
        "high_count": 0,
        "medium_count": 0,
        "low_count": 0,
        "created_at": _ago(hours=1),
        "completed_at": _ago(hours=1),
    },
]

FINDINGS = [
    {
        "id": "find-gitleaks-aws",
        "repository_id": "repo-sspillowy-api",
        "scan_id": "scan-api-001",
        "title": "Hardcoded AWS Secret Key detected",
        "description": "GitLeaks identificó un token de AWS (AKIA...) expuesto en el historial del repositorio.",
        "engine": "gitleaks",
        "severity": "CRITICAL",
        "file_path": "apps/api/config/aws_client.py",
        "line_number": 42,
        "cwe": "CWE-798",
        "owasp_category": "A07:2021 - Identification and Authentication Failures",
        "iso_control": "A.8.5 — Autenticación segura",
        "status": "OPEN",
        "ai_triaged": True,
        "ai_confidence": 0.98,
        "ai_summary": "Credencial AWS activa con permisos de lectura en S3. Riesgo de exfiltración si el repo es accesible.",
        "ai_remediation": "Revocar la clave en IAM, rotar secretos y mover a Secrets Manager / variables de entorno.",
        "created_at": _ago(hours=6),
    },
    {
        "id": "find-semgrep-sqli",
        "repository_id": "repo-payment-gateway",
        "scan_id": "scan-pay-001",
        "title": "Potential SQL Injection in dynamic query",
        "description": "Semgrep detectó concatenación de parámetros no saneados en consulta SQL.",
        "engine": "semgrep",
        "severity": "CRITICAL",
        "file_path": "src/services/user_search.py",
        "line_number": 115,
        "cwe": "CWE-89",
        "owasp_category": "A03:2021 - Injection",
        "iso_control": "A.8.28 — Codificación segura",
        "status": "OPEN",
        "ai_triaged": True,
        "ai_confidence": 0.94,
        "ai_summary": "El parámetro search_query se interpola directamente en el string SQL del endpoint de pagos.",
        "ai_remediation": "Usar consultas parametrizadas / ORM (SQLAlchemy filter bind).",
        "created_at": _ago(hours=3),
    },
    {
        "id": "find-trivy-runc",
        "repository_id": "repo-payment-gateway",
        "scan_id": "scan-pay-001",
        "title": "CVE-2024-21626: runc container breakout",
        "description": "Trivy detectó dependencia vulnerable en imagen base Docker.",
        "engine": "trivy",
        "severity": "HIGH",
        "file_path": "Dockerfile",
        "line_number": 1,
        "cwe": "CWE-1395",
        "owasp_category": "A06:2021 - Vulnerable and Outdated Components",
        "iso_control": "A.8.8 — Vulnerabilidades técnicas",
        "status": "OPEN",
        "ai_triaged": True,
        "ai_confidence": 0.89,
        "ai_summary": "Imagen python:3.10-slim incluye runc vulnerable a container breakout.",
        "ai_remediation": "Actualizar a python:3.12-slim y reconstruir la imagen.",
        "created_at": _ago(hours=3),
    },
    {
        "id": "find-zap-hsts",
        "repository_id": "repo-sspillowy-api",
        "scan_id": "scan-api-001",
        "title": "Missing HTTP Strict-Transport-Security header",
        "description": "OWASP ZAP: endpoint /api/v1/auth sin encabezado HSTS.",
        "engine": "owasp_zap",
        "severity": "MEDIUM",
        "file_path": "/api/v1/auth/login",
        "line_number": 0,
        "cwe": "CWE-523",
        "owasp_category": "A05:2021 - Security Misconfiguration",
        "iso_control": "A.8.9 — Gestión de configuración",
        "status": "IN_REVIEW",
        "ai_triaged": True,
        "ai_confidence": 0.81,
        "ai_summary": "Sin HSTS, un MITM puede forzar downgrade HTTP en el primer hop.",
        "ai_remediation": "Añadir Strict-Transport-Security: max-age=31536000; includeSubDomains en middleware FastAPI.",
        "created_at": _ago(days=1),
    },
    {
        "id": "find-semgrep-xss",
        "repository_id": "repo-auth-identity",
        "scan_id": "scan-auth-001",
        "title": "CWE-79: Reflected XSS in search parameter",
        "description": "Semgrep: parámetro de búsqueda reflejado sin encode.",
        "engine": "semgrep",
        "severity": "HIGH",
        "file_path": "src/web/admin_search.py",
        "line_number": 58,
        "cwe": "CWE-79",
        "owasp_category": "A03:2021 - Injection",
        "iso_control": "A.8.28 — Codificación segura",
        "status": "OPEN",
        "ai_triaged": True,
        "ai_confidence": 0.87,
        "ai_summary": "Impacto en sesión admin; posible robo de cookies de consola.",
        "ai_remediation": "Escapar salida HTML / usar templates auto-escape.",
        "created_at": _ago(days=1),
    },
    {
        "id": "find-gitleaks-fixed",
        "repository_id": "repo-sspillowy-api",
        "scan_id": "scan-api-001",
        "title": "API token in .env.example (historical)",
        "description": "GitLeaks: token de ejemplo que ya fue rotado.",
        "engine": "gitleaks",
        "severity": "HIGH",
        "file_path": ".env.example",
        "line_number": 12,
        "cwe": "CWE-798",
        "owasp_category": "A07:2021",
        "iso_control": "A.8.3 — Protección de la información",
        "status": "FIXED",
        "ai_triaged": True,
        "ai_confidence": 0.9,
        "ai_summary": "Secreto de ejemplo; ya rotado y sustituido por placeholder.",
        "ai_remediation": "Mantener solo placeholders en archivos versionados.",
        "created_at": _ago(days=2),
    },
    {
        "id": "find-trivy-medium",
        "repository_id": "repo-payment-gateway",
        "scan_id": "scan-pay-001",
        "title": "Outdated openssl package in base image",
        "description": "Trivy: openssl con CVE de severidad media.",
        "engine": "trivy",
        "severity": "MEDIUM",
        "file_path": "Dockerfile",
        "line_number": 8,
        "cwe": "CWE-1104",
        "owasp_category": "A06:2021",
        "iso_control": "A.8.8 — Vulnerabilidades técnicas",
        "status": "OPEN",
        "ai_triaged": False,
        "ai_confidence": None,
        "ai_summary": None,
        "ai_remediation": None,
        "created_at": _ago(days=2, hours=4),
    },
    {
        "id": "find-zap-cors",
        "repository_id": "repo-auth-identity",
        "scan_id": "scan-auth-001",
        "title": "Overly permissive CORS policy",
        "description": "OWASP ZAP: Access-Control-Allow-Origin: * en endpoint sensible.",
        "engine": "owasp_zap",
        "severity": "MEDIUM",
        "file_path": "/oauth/token",
        "line_number": 0,
        "cwe": "CWE-942",
        "owasp_category": "A05:2021",
        "iso_control": "A.8.9 — Gestión de configuración",
        "status": "OPEN",
        "ai_triaged": True,
        "ai_confidence": 0.76,
        "ai_summary": "CORS abierto aumenta superficie de abuso desde orígenes no confiables.",
        "ai_remediation": "Restringir orígenes a sspillowy.com y localhost de desarrollo.",
        "created_at": _ago(days=3),
    },
    {
        "id": "find-semgrep-path",
        "repository_id": "repo-payment-gateway",
        "scan_id": "scan-pay-001",
        "title": "CWE-22: Path traversal in file download",
        "description": "Semgrep: path del usuario sin normalizar en download.",
        "engine": "semgrep",
        "severity": "CRITICAL",
        "file_path": "src/api/downloads.py",
        "line_number": 33,
        "cwe": "CWE-22",
        "owasp_category": "A01:2021 - Broken Access Control",
        "iso_control": "A.8.28 — Codificación segura",
        "status": "OPEN",
        "ai_triaged": True,
        "ai_confidence": 0.91,
        "ai_summary": "Permite leer archivos fuera del directorio permitido si no se valida el path.",
        "ai_remediation": "Resolver path absoluto y verificar prefijo permitido (safe join).",
        "created_at": _ago(hours=5),
    },
    {
        "id": "find-api-low",
        "repository_id": "repo-sspillowy-api",
        "scan_id": "scan-api-001",
        "title": "Verbose error stack traces in production responses",
        "description": "Semgrep: traceback expuesto en respuestas 500.",
        "engine": "semgrep",
        "severity": "LOW",
        "file_path": "apps/api/main.py",
        "line_number": 210,
        "cwe": "CWE-209",
        "owasp_category": "A04:2021",
        "iso_control": "A.8.28 — Codificación segura",
        "status": "OPEN",
        "ai_triaged": False,
        "ai_confidence": None,
        "ai_summary": None,
        "ai_remediation": None,
        "created_at": _ago(days=4),
    },
    {
        "id": "find-pay-high-secret",
        "repository_id": "repo-payment-gateway",
        "scan_id": "scan-pay-001",
        "title": "Stripe test key committed in config",
        "description": "GitLeaks: sk_test_ en archivo de configuración.",
        "engine": "gitleaks",
        "severity": "HIGH",
        "file_path": "config/payments.yml",
        "line_number": 9,
        "cwe": "CWE-798",
        "owasp_category": "A07:2021",
        "iso_control": "A.8.3 — Protección de la información",
        "status": "IN_REVIEW",
        "ai_triaged": True,
        "ai_confidence": 0.85,
        "ai_summary": "Clave de test; aún así no debe versionarse. Riesgo de confusión con live keys.",
        "ai_remediation": "Mover a secreto de entorno y rotar la clave de test.",
        "created_at": _ago(days=5),
    },
]

AUDITS = [
    {
        "id": "evt-seed-repo",
        "action": "REPO_REGISTERED",
        "target": "sspillowy-backend-api",
        "detail": "Repositorio seed registrado para demo con datos reales.",
        "actor_email": "system@sspillowy.com",
        "created_at": _ago(days=14),
    },
    {
        "id": "evt-seed-scan",
        "action": "SCAN_COMPLETED",
        "target": "payment-gateway-service",
        "detail": "Escaneo multi-motor completado (Semgrep, Trivy, GitLeaks, ZAP).",
        "actor_email": "system@sspillowy.com",
        "created_at": _ago(hours=3),
    },
    {
        "id": "evt-seed-gate",
        "action": "GATE_EVALUATED",
        "target": "Default Organization Security Gate",
        "detail": "Pipeline bloqueado: critical>0 en payment-gateway-service.",
        "actor_email": "ci@sspillowy.com",
        "created_at": _ago(hours=2),
    },
]


def _upsert(db, model, data: dict, pk: str = "id"):
    existing = db.get(model, data[pk])
    if existing:
        for k, v in data.items():
            if k != pk:
                setattr(existing, k, v)
        return existing
    row = model(**data)
    db.add(row)
    return row


def seed(force: bool = False) -> dict:
    if not init_db() or not db_ping():
        raise RuntimeError("Base de datos no disponible. Revisa DATABASE_URL.")

    db = SessionLocal()
    try:
        _upsert(
            db,
            SecurityGate,
            {
                "id": "default-policy",
                "name": "Default Organization Security Gate",
                "max_critical_allowed": 0,
                "max_high_allowed": 2,
                "block_on_secrets": True,
                "require_ciso_approval_for_bypass": True,
                "enabled": True,
            },
        )

        for repo in REPOS:
            _upsert(db, Repository, repo)
        for scan in SCANS:
            _upsert(db, Scan, scan)
        for finding in FINDINGS:
            _upsert(db, Finding, finding)
        for evt in AUDITS:
            _upsert(db, AuditEvent, evt)

        # Recalcular contadores de repos desde findings abiertos
        for repo in db.query(Repository).all():
            opens = [
                f
                for f in db.query(Finding).filter(Finding.repository_id == repo.id).all()
                if (f.status or "") in ("OPEN", "IN_REVIEW")
            ]
            repo.open_criticals = sum(1 for f in opens if f.severity == "CRITICAL")
            repo.open_highs = sum(1 for f in opens if f.severity == "HIGH")
            repo.total_findings = db.query(Finding).filter(Finding.repository_id == repo.id).count()

        db.commit()
        return {
            "repos": db.query(Repository).count(),
            "scans": db.query(Scan).count(),
            "findings": db.query(Finding).count(),
            "audits": db.query(AuditEvent).count(),
        }
    finally:
        db.close()


if __name__ == "__main__":
    stats = seed()
    print("[sspillowy] seed OK:", stats)
