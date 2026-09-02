import uuid
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Import shared schemas
import sys
import os

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from packages.core_models import (
    EngineType,
    SeverityLevel,
    FindingStatus,
    FindingResponse,
    FindingStatusUpdate,
    RepositoryResponse,
    RepositoryCreate,
    ScanCreate,
    ScanResponse,
    SecurityGatePolicy,
    DashboardStats,
    NotificationType,
    NotificationResponse,
    AuditEventResponse,
    HeatmapResponse,
    ComplianceReport,
    IsoControl,
)

from github_oauth import router as github_auth_router
from gitlab_oauth import router as gitlab_auth_router
from google_oauth import router as google_auth_router
from microsoft_oauth import router as microsoft_auth_router
from oauth_common import router as auth_meta_router
from password_auth import router as password_auth_router
from email_verification import router as email_verification_router
from password_reset import router as password_reset_router
from pillow_agent import router as pillow_router
from database import init_db, db_ping, SessionLocal
from email_service import mailer_status
from dashboard_metrics import compute_dashboard_stats, compute_heatmap, list_audit_events

app = FastAPI(
    title="SSPILLOWY API Core",
    description="Software Security Platform for Intelligent, Low-latency Oversight & Warning Yield",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

@app.on_event("startup")
async def on_startup():
    ok = init_db()
    print(f"[sspillowy] database ready={ok}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_meta_router)
app.include_router(password_auth_router)
app.include_router(email_verification_router)
app.include_router(password_reset_router)
app.include_router(pillow_router)
app.include_router(github_auth_router)
app.include_router(gitlab_auth_router)
app.include_router(google_auth_router)
app.include_router(microsoft_auth_router)

# In-memory mock store for instant UI demo & development
MOCK_REPOSITORIES = [
    {
        "id": "repo-1",
        "name": "sspillowy-backend-api",
        "url": "github.com/org/sspillowy-backend",
        "branch": "main",
        "is_active": True,
        "health_score": 88,
        "open_criticals": 1,
        "open_highs": 2,
        "total_findings": 12,
        "last_scan_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc)
    },
    {
        "id": "repo-2",
        "name": "payment-gateway-service",
        "url": "github.com/org/payment-gateway",
        "branch": "develop",
        "is_active": True,
        "health_score": 62,
        "open_criticals": 3,
        "open_highs": 5,
        "total_findings": 28,
        "last_scan_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc)
    },
    {
        "id": "repo-3",
        "name": "auth-identity-provider",
        "url": "github.com/org/auth-service",
        "branch": "main",
        "is_active": True,
        "health_score": 95,
        "open_criticals": 0,
        "open_highs": 1,
        "total_findings": 4,
        "last_scan_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc)
    }
]

MOCK_FINDINGS = [
    {
        "id": "find-1",
        "repository_id": "repo-1",
        "scan_id": "scan-101",
        "title": "Hardcoded AWS Secret Key detected in repository history",
        "description": "GitLeaks identifícó un token de AWS (AKIA...) expuesto en el commit a8f91c.",
        "engine": EngineType.GITLEAKS,
        "severity": SeverityLevel.CRITICAL,
        "file_path": "apps/api/config/aws_client.py",
        "line_number": 42,
        "cwe": "CWE-798: Use of Hard-coded Credentials",
        "owasp_category": "A07:2021 - Identification and Authentication Failures",
        "iso_control": "A.8.5 — Autenticación segura",
        "status": FindingStatus.OPEN,
        "ai_triaged": True,
        "ai_confidence": 0.98,
        "ai_summary": "La credencial de AWS expuesta coincide con una clave de acceso activa con permisos de lectura en S3.",
        "ai_remediation": "Revocar inmediatamente la clave AWS en IAM Console y mover el secreto a AWS Secrets Manager o variable de entorno.",
        "created_at": datetime.now(timezone.utc)
    },
    {
        "id": "find-2",
        "repository_id": "repo-2",
        "scan_id": "scan-102",
        "title": "Potential SQL Injection in dynamic query concatenation",
        "description": "Semgrep detectó concatenación directa de parámetros no saneados en la consulta SQL.",
        "engine": EngineType.SEMGREP,
        "severity": SeverityLevel.CRITICAL,
        "file_path": "src/services/user_search.py",
        "line_number": 115,
        "cwe": "CWE-89: SQL Injection",
        "owasp_category": "A03:2021 - Injection",
        "iso_control": "A.8.28 — Codificación segura",
        "status": FindingStatus.OPEN,
        "ai_triaged": True,
        "ai_confidence": 0.94,
        "ai_summary": "El parámetro `search_query` ingresado por el cliente se interpole directamente en el string SQL.",
        "ai_remediation": "Sustituir por SQLAlchemy parameterized query: `session.query(User).filter(User.username == query)`.",
        "created_at": datetime.now(timezone.utc)
    },
    {
        "id": "find-3",
        "repository_id": "repo-2",
        "scan_id": "scan-102",
        "title": "CVE-2024-21626: container breakout vulnerability in runc dependency",
        "description": "Trivy detectó una vulnerabilidad crítica en la imagen Docker base.",
        "engine": EngineType.TRIVY,
        "severity": SeverityLevel.HIGH,
        "file_path": "Dockerfile",
        "line_number": 1,
        "cwe": "CWE-1395: Dependency Vulnerability",
        "owasp_category": "A06:2021 - Vulnerable and Outdated Components",
        "iso_control": "A.8.8 — Vulnerabilidades técnicas",
        "status": FindingStatus.OPEN,
        "ai_triaged": True,
        "ai_confidence": 0.89,
        "ai_summary": "La versión base python:3.10-slim usa una versión vulnerable de runc.",
        "ai_remediation": "Actualizar la primera línea del Dockerfile a `FROM python:3.12-slim` o ejecutar `apt-get update && apt-get upgrade -y`.",
        "created_at": datetime.now(timezone.utc)
    },
    {
        "id": "find-4",
        "repository_id": "repo-1",
        "scan_id": "scan-101",
        "title": "Missing HTTP Strict-Transport-Security (HSTS) Header",
        "description": "OWASP ZAP detectó que el endpoint `/api/v1/auth` no incluye encabezado HSTS.",
        "engine": EngineType.OWASP_ZAP,
        "severity": SeverityLevel.MEDIUM,
        "file_path": "/api/v1/auth/login",
        "line_number": 0,
        "cwe": "CWE-523: Unprotected Transport Channel",
        "owasp_category": "A05:2021 - Security Misconfiguration",
        "iso_control": "A.8.9 — Gestión de configuración",
        "status": FindingStatus.IN_REVIEW,
        "ai_triaged": True,
        "ai_confidence": 0.91,
        "ai_summary": "Ausencia de HSTS permite ataques Man-In-The-Middle por downgrade de HTTPS a HTTP.",
        "ai_remediation": "Agregar middleware en FastAPI: `response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'`.",
        "created_at": datetime.now(timezone.utc)
    },
    {
        "id": "find-5",
        "repository_id": "repo-3",
        "scan_id": "scan-103",
        "title": "Reflected XSS via unsanitized query parameter in login callback",
        "description": "Semgrep detectó interpolación del parámetro `redirect` en una plantilla HTML sin escape.",
        "engine": EngineType.SEMGREP,
        "severity": SeverityLevel.HIGH,
        "file_path": "src/auth/callback.py",
        "line_number": 67,
        "cwe": "CWE-79: Cross-site Scripting",
        "owasp_category": "A03:2021 - Injection",
        "iso_control": "A.8.28 — Codificación segura",
        "status": FindingStatus.OPEN,
        "ai_triaged": True,
        "ai_confidence": 0.87,
        "ai_summary": "El parámetro redirect se refleja en la respuesta HTML. Es explotable si el callback es alcanzable sin autenticación previa.",
        "ai_remediation": "Escape HTML del valor o usa una allowlist de URLs internas: `redirect if redirect in ALLOWED_REDIRECTS else '/'`.",
        "created_at": datetime.now(timezone.utc)
    },
    {
        "id": "find-6",
        "repository_id": "repo-1",
        "scan_id": "scan-101",
        "title": "Private RSA key committed in .env.local history",
        "description": "GitLeaks identificó un bloque BEGIN RSA PRIVATE KEY en el historial de .env.local.",
        "engine": EngineType.GITLEAKS,
        "severity": SeverityLevel.CRITICAL,
        "file_path": ".env.local",
        "line_number": 12,
        "cwe": "CWE-321: Use of Hard-coded Cryptographic Key",
        "owasp_category": "A02:2021 - Cryptographic Failures",
        "iso_control": "A.8.3 — Protección de la información",
        "status": FindingStatus.OPEN,
        "ai_triaged": True,
        "ai_confidence": 0.99,
        "ai_summary": "La clave privada está en el historial Git y debe considerarse comprometida aunque el archivo actual esté en .gitignore.",
        "ai_remediation": "Rotar el par de claves, reescribir el historial con git-filter-repo y bloquear el patrón en pre-commit (GitLeaks).",
        "created_at": datetime.now(timezone.utc)
    },
    {
        "id": "find-7",
        "repository_id": "repo-2",
        "scan_id": "scan-102",
        "title": "CORS Access-Control-Allow-Origin set to wildcard '*'",
        "description": "OWASP ZAP detectó política CORS permisiva en /api/v1/payments.",
        "engine": EngineType.OWASP_ZAP,
        "severity": SeverityLevel.HIGH,
        "file_path": "/api/v1/payments",
        "line_number": 0,
        "cwe": "CWE-942: Overly Permissive CORS Policy",
        "owasp_category": "A05:2021 - Security Misconfiguration",
        "iso_control": "A.8.9 — Gestión de configuración",
        "status": FindingStatus.OPEN,
        "ai_triaged": True,
        "ai_confidence": 0.92,
        "ai_summary": "Un origen arbitrario puede leer respuestas autenticadas si las cookies no están SameSite=Strict.",
        "ai_remediation": "Reemplazar allow_origins=['*'] por la lista explícita de orígenes del Web Hub y Pulse.",
        "created_at": datetime.now(timezone.utc)
    }
]

def _now():
    return datetime.now(timezone.utc)


def _hours_ago(hours: int):
    return _now() - timedelta(hours=hours)


MOCK_SCANS = [
    {
        "id": "scan-101",
        "repository_id": "repo-1",
        "status": "COMPLETED",
        "triggered_by": "webhook_git",
        "branch": "main",
        "total_findings": 12,
        "critical_count": 1,
        "high_count": 2,
        "medium_count": 5,
        "low_count": 4,
        "created_at": _hours_ago(26),
        "completed_at": _hours_ago(25)
    },
    {
        "id": "scan-102",
        "repository_id": "repo-2",
        "status": "COMPLETED",
        "triggered_by": "manual_web",
        "branch": "develop",
        "total_findings": 28,
        "critical_count": 3,
        "high_count": 5,
        "medium_count": 12,
        "low_count": 8,
        "created_at": _hours_ago(6),
        "completed_at": _hours_ago(5)
    },
    {
        "id": "scan-103",
        "repository_id": "repo-3",
        "status": "COMPLETED",
        "triggered_by": "webhook_git",
        "branch": "main",
        "total_findings": 4,
        "critical_count": 0,
        "high_count": 1,
        "medium_count": 2,
        "low_count": 1,
        "created_at": _hours_ago(3),
        "completed_at": _hours_ago(2)
    },
    {
        "id": "scan-104",
        "repository_id": "repo-2",
        "status": "RUNNING",
        "triggered_by": "web_hub",
        "branch": "develop",
        "total_findings": 0,
        "critical_count": 0,
        "high_count": 0,
        "medium_count": 0,
        "low_count": 0,
        "created_at": _hours_ago(0),
        "completed_at": None
    }
]

MOCK_POLICY = SecurityGatePolicy(
    id="default-policy",
    name="Política Estándar DevSecOps SSPILLOWY",
    max_critical_allowed=0,
    max_high_allowed=2,
    block_on_secrets=True,
    require_ciso_approval_for_bypass=True,
    enabled=True
)

MOCK_AUDIT: List[dict] = [
    {
        "id": "evt-001",
        "actor": "sistema",
        "action": "SCAN_COMPLETED",
        "target": "payment-gateway-service",
        "detail": "Escaneo scan-102 finalizado: 3 críticas, 5 altas. Security Gate en evaluación.",
        "created_at": _hours_ago(5)
    },
    {
        "id": "evt-002",
        "actor": "LLM Router",
        "action": "AI_TRIAGE",
        "target": "find-2",
        "detail": "SQL Injection triada con confianza 94%. Propuesta de query parametrizada lista para HITL.",
        "created_at": _hours_ago(5)
    },
    {
        "id": "evt-003",
        "actor": "security-gate",
        "action": "GATE_BLOCK",
        "target": "payment-gateway-service",
        "detail": "Pipeline bloqueado: max_critical_allowed=0 excedido (3 hallazgos CRITICAL).",
        "created_at": _hours_ago(5)
    },
    {
        "id": "evt-004",
        "actor": "GitLeaks",
        "action": "SECRET_LEAK",
        "target": "sspillowy-backend-api",
        "detail": "Clave AWS AKIA... detectada en historial. Push a Pulse App disparado.",
        "created_at": _hours_ago(25)
    },
    {
        "id": "evt-005",
        "actor": "webhook_git",
        "action": "SCAN_TRIGGERED",
        "target": "auth-identity-provider",
        "detail": "Push a main encoló workers Semgrep + Trivy + GitLeaks.",
        "created_at": _hours_ago(3)
    },
    {
        "id": "evt-006",
        "actor": "web_hub",
        "action": "FINDING_IN_REVIEW",
        "target": "find-4",
        "detail": "Auditor marcó HSTS missing como IN_REVIEW. IA no auto-cierra el hallazgo.",
        "created_at": _hours_ago(2)
    }
]

MOCK_NOTIFICATIONS: List[dict] = [
    {
        "id": "notif-1",
        "type": NotificationType.SECRET_LEAK,
        "severity": SeverityLevel.CRITICAL,
        "title": "Secreto AWS expuesto en sspillowy-backend-api",
        "message": "GitLeaks detectó una clave de acceso activa en el historial de commits. Pulse App notificada.",
        "repository_id": "repo-1",
        "finding_id": "find-1",
        "read": False,
        "created_at": _hours_ago(25)
    },
    {
        "id": "notif-2",
        "type": NotificationType.GATE_BLOCK,
        "severity": SeverityLevel.CRITICAL,
        "title": "Security Gate bloqueó el pipeline de payment-gateway",
        "message": "Umbral de 0 críticas excedido. Bypass requiere firma del CISO en SSPILLOWY Pulse.",
        "repository_id": "repo-2",
        "finding_id": "find-2",
        "read": False,
        "created_at": _hours_ago(5)
    },
    {
        "id": "notif-3",
        "type": NotificationType.CRITICAL_FINDING,
        "severity": SeverityLevel.CRITICAL,
        "title": "Clave RSA privada en historial de .env.local",
        "message": "El secreto debe rotarse aunque el archivo actual esté ignorado.",
        "repository_id": "repo-1",
        "finding_id": "find-6",
        "read": False,
        "created_at": _hours_ago(24)
    },
    {
        "id": "notif-4",
        "type": NotificationType.AI_TRIAGE,
        "severity": SeverityLevel.HIGH,
        "title": "Triaje IA listo: SQL Injection en user_search.py",
        "message": "Confianza 94%. Esperando validación humana (human-in-the-loop).",
        "repository_id": "repo-2",
        "finding_id": "find-2",
        "read": True,
        "created_at": _hours_ago(5)
    },
    {
        "id": "notif-5",
        "type": NotificationType.SCAN_COMPLETED,
        "severity": SeverityLevel.MEDIUM,
        "title": "Escaneo completado en auth-identity-provider",
        "message": "4 hallazgos. Health Score del repositorio: 95/100.",
        "repository_id": "repo-3",
        "finding_id": None,
        "read": True,
        "created_at": _hours_ago(2)
    },
    {
        "id": "notif-6",
        "type": NotificationType.PULSE_BYPASS,
        "severity": SeverityLevel.HIGH,
        "title": "Solicitud de bypass móvil pendiente",
        "message": "El pipeline de payment-gateway-service espera aprobación biométrica del CISO.",
        "repository_id": "repo-2",
        "finding_id": None,
        "read": False,
        "created_at": _hours_ago(4)
    }
]


def _append_audit(actor: str, action: str, target: str, detail: str) -> None:
    MOCK_AUDIT.insert(0, {
        "id": f"evt-{uuid.uuid4().hex[:6]}",
        "actor": actor,
        "action": action,
        "target": target,
        "detail": detail,
        "created_at": _now()
    })


def _open_findings():
    return [f for f in MOCK_FINDINGS if f["status"] in (FindingStatus.OPEN, FindingStatus.IN_REVIEW)]


def _heatmap_count(day: date) -> int:
    seed = (day.toordinal() * 17 + day.month * 3) % 11
    if day.weekday() >= 5:
        seed = seed // 3
    return seed


def _heatmap_level(count: int) -> int:
    if count <= 0:
        return 0
    if count <= 2:
        return 1
    if count <= 4:
        return 2
    if count <= 7:
        return 3
    return 4

@app.get("/health", tags=["Health"])
async def health_check():
    db_ok = db_ping()
    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "SSPILLOWY Core API",
        "version": "0.1.0",
        "database": "postgresql (ok)" if db_ok else "unavailable (using memory fallback for auth)",
        "redis_worker": "arq (ready)",
        "email_mailer": mailer_status(),
    }

def _empty_dashboard_stats() -> DashboardStats:
    return DashboardStats(
        overall_health_score=0,
        monitored_repos=0,
        total_scans_run=0,
        total_open_findings=0,
        critical_findings=0,
        high_findings=0,
        medium_findings=0,
        low_findings=0,
        secrets_leaked_prevented=0,
        findings_by_engine={},
        trend_7d=[0, 0, 0, 0, 0, 0, 0],
    )


def _empty_heatmap(weeks: int = 12) -> HeatmapResponse:
    today = _now().date()
    days = weeks * 7 - 1
    cells = [
        {"date": (today - timedelta(days=i)).isoformat(), "count": 0, "level": 0}
        for i in range(days, -1, -1)
    ]
    return HeatmapResponse(cells=cells, max_count=0, total_findings_period=0, weeks=weeks)


@app.get("/api/v1/stats", response_model=DashboardStats, tags=["Dashboard"])
async def get_dashboard_stats():
    db = SessionLocal()
    try:
        if not db_ping():
            return _empty_dashboard_stats()
        return DashboardStats(**compute_dashboard_stats(db))
    except Exception as exc:
        print(f"[sspillowy] dashboard stats error: {exc}")
        return _empty_dashboard_stats()
    finally:
        db.close()


@app.get("/api/v1/heatmap", response_model=HeatmapResponse, tags=["Dashboard"])
async def get_heatmap(weeks: int = Query(default=12, ge=4, le=52)):
    db = SessionLocal()
    try:
        if not db_ping():
            return _empty_heatmap(weeks)
        return HeatmapResponse(**compute_heatmap(db, weeks=weeks))
    except Exception as exc:
        print(f"[sspillowy] heatmap error: {exc}")
        return _empty_heatmap(weeks)
    finally:
        db.close()


@app.get("/api/v1/audit-log", response_model=List[AuditEventResponse], tags=["Audit"])
async def list_audit_log(limit: int = Query(default=40, ge=1, le=200)):
    db = SessionLocal()
    try:
        if not db_ping():
            return []
        return list_audit_events(db, limit=limit)
    except Exception as exc:
        print(f"[sspillowy] audit log error: {exc}")
        return []
    finally:
        db.close()

@app.get("/api/v1/repositories", response_model=List[RepositoryResponse], tags=["Repositories"])
async def list_repositories():
    return MOCK_REPOSITORIES

@app.post("/api/v1/repositories", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED, tags=["Repositories"])
async def create_repository(repo: RepositoryCreate):
    new_repo = {
        "id": f"repo-{uuid.uuid4().hex[:6]}",
        "name": repo.name,
        "url": repo.url,
        "branch": repo.branch,
        "is_active": True,
        "health_score": 100,
        "open_criticals": 0,
        "open_highs": 0,
        "total_findings": 0,
        "last_scan_at": None,
        "created_at": _now()
    }
    MOCK_REPOSITORIES.append(new_repo)
    _append_audit("web_hub", "REPO_REGISTERED", repo.name, f"Repositorio {repo.url} registrado en rama {repo.branch}.")
    return new_repo

@app.get("/api/v1/findings", response_model=List[FindingResponse], tags=["Findings"])
async def list_findings(
    repository_id: Optional[str] = None,
    engine: Optional[EngineType] = None,
    severity: Optional[SeverityLevel] = None,
    finding_status: Optional[FindingStatus] = Query(default=None, alias="status"),
):
    results = MOCK_FINDINGS
    if repository_id:
        results = [f for f in results if f["repository_id"] == repository_id]
    if engine:
        results = [f for f in results if f["engine"] == engine]
    if severity:
        results = [f for f in results if f["severity"] == severity]
    if finding_status:
        results = [f for f in results if f["status"] == finding_status]
    return results

@app.patch("/api/v1/findings/{finding_id}", response_model=FindingResponse, tags=["Findings"])
async def update_finding_status(finding_id: str, payload: FindingStatusUpdate):
    finding = next((f for f in MOCK_FINDINGS if f["id"] == finding_id), None)
    if not finding:
        raise HTTPException(status_code=404, detail="Hallazgo no encontrado")
    finding["status"] = payload.status
    note = payload.note or "Sin nota adicional"
    _append_audit(
        "auditor",
        f"FINDING_{payload.status.value}",
        finding_id,
        f"Estado actualizado a {payload.status.value} (HITL). {note}",
    )
    return finding

@app.post("/api/v1/scans", response_model=ScanResponse, status_code=status.HTTP_201_CREATED, tags=["Scans"])
async def trigger_scan(scan_in: ScanCreate):
    new_scan = {
        "id": f"scan-{uuid.uuid4().hex[:6]}",
        "repository_id": scan_in.repository_id,
        "status": "RUNNING",
        "triggered_by": scan_in.triggered_by,
        "branch": scan_in.branch,
        "total_findings": 0,
        "critical_count": 0,
        "high_count": 0,
        "medium_count": 0,
        "low_count": 0,
        "created_at": _now(),
        "completed_at": None
    }
    MOCK_SCANS.insert(0, new_scan)
    repo = next((r for r in MOCK_REPOSITORIES if r["id"] == scan_in.repository_id), None)
    target = repo["name"] if repo else scan_in.repository_id
    _append_audit("web_hub", "SCAN_TRIGGERED", target, f"Escaneo {new_scan['id']} encolado (Semgrep, Trivy, GitLeaks, ZAP).")
    MOCK_NOTIFICATIONS.insert(0, {
        "id": f"notif-{uuid.uuid4().hex[:6]}",
        "type": NotificationType.SCAN_COMPLETED,
        "severity": SeverityLevel.INFO,
        "title": f"Escaneo iniciado en {target}",
        "message": "Workers ARQ ejecutando Semgrep, Trivy, GitLeaks y OWASP ZAP en paralelo.",
        "repository_id": scan_in.repository_id,
        "finding_id": None,
        "read": False,
        "created_at": _now()
    })
    return new_scan

@app.get("/api/v1/scans", response_model=List[ScanResponse], tags=["Scans"])
async def list_scans():
    return MOCK_SCANS

@app.get("/api/v1/security-gates", response_model=SecurityGatePolicy, tags=["Security Gates"])
async def get_security_gate():
    return MOCK_POLICY

@app.post("/api/v1/security-gates", response_model=SecurityGatePolicy, tags=["Security Gates"])
async def update_security_gate(policy: SecurityGatePolicy):
    global MOCK_POLICY
    MOCK_POLICY = policy
    _append_audit(
        "web_hub",
        "GATE_UPDATED",
        policy.name,
        f"Umbrales actualizados: critical≤{policy.max_critical_allowed}, high≤{policy.max_high_allowed}, block_secrets={policy.block_on_secrets}.",
    )
    return MOCK_POLICY

@app.get("/api/v1/notifications", response_model=List[NotificationResponse], tags=["Notifications"])
async def list_notifications(unread_only: bool = False):
    items = MOCK_NOTIFICATIONS
    if unread_only:
        items = [n for n in items if not n["read"]]
    return items

@app.post("/api/v1/notifications/{notification_id}/read", response_model=NotificationResponse, tags=["Notifications"])
async def mark_notification_read(notification_id: str):
    notification = next((n for n in MOCK_NOTIFICATIONS if n["id"] == notification_id), None)
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    notification["read"] = True
    return notification

@app.post("/api/v1/notifications/read-all", tags=["Notifications"])
async def mark_all_notifications_read():
    for notification in MOCK_NOTIFICATIONS:
        notification["read"] = True
    return {"updated": len(MOCK_NOTIFICATIONS)}

@app.get("/api/v1/compliance/iso27001", response_model=ComplianceReport, tags=["Compliance"])
async def get_iso_compliance():
    open_items = _open_findings()

    def count_for(*needles: str) -> int:
        return sum(1 for f in open_items if any(n in (f.get("iso_control") or "") for n in needles))

    controls = [
        IsoControl(code="A.8.8", title="Gestión de vulnerabilidades técnicas", status="PARTIAL", related_engine="trivy", open_findings=count_for("A.8.8")),
        IsoControl(code="A.8.9", title="Gestión de configuración", status="PARTIAL", related_engine="owasp_zap", open_findings=count_for("A.8.9")),
        IsoControl(code="A.8.28", title="Codificación segura", status="PARTIAL", related_engine="semgrep", open_findings=count_for("A.8.28")),
        IsoControl(code="A.8.5", title="Autenticación segura", status="GAP", related_engine="gitleaks", open_findings=count_for("A.8.5")),
        IsoControl(code="A.8.3", title="Protección de la información", status="GAP", related_engine="gitleaks", open_findings=count_for("A.8.3")),
        IsoControl(code="A.8.25", title="Seguridad en el ciclo de desarrollo", status="COMPLIANT", related_engine=None, open_findings=0),
        IsoControl(code="A.8.26", title="Requisitos de seguridad de las aplicaciones", status="COMPLIANT", related_engine=None, open_findings=0),
        IsoControl(code="A.8.32", title="Gestión del cambio", status="COMPLIANT", related_engine=None, open_findings=0),
        IsoControl(code="A.5.33", title="Protección de registros / evidencia", status="COMPLIANT", related_engine=None, open_findings=0),
    ]
    return ComplianceReport(
        standard="ISO/IEC 27001:2022",
        period="2026-Q3",
        health_score=82,
        controls=controls,
        generated_at=_now(),
        evidence_pack_ready=True,
    )
