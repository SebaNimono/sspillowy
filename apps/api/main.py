import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import shared schemas
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from packages.core_models import (
    EngineType,
    SeverityLevel,
    FindingStatus,
    FindingResponse,
    RepositoryResponse,
    RepositoryCreate,
    ScanCreate,
    ScanResponse,
    SecurityGatePolicy,
    DashboardStats,
)

app = FastAPI(
    title="SSPILLOWY API Core",
    description="Software Security Platform for Intelligent, Low-latency Oversight & Warning Yield",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        "status": FindingStatus.IN_REVIEW,
        "ai_triaged": True,
        "ai_confidence": 0.91,
        "ai_summary": "Ausencia de HSTS permite ataques Man-In-The-Middle por downgrade de HTTPS a HTTP.",
        "ai_remediation": "Agregar middleware en FastAPI: `response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'`.",
        "created_at": datetime.now(timezone.utc)
    }
]

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
        "created_at": datetime.now(timezone.utc),
        "completed_at": datetime.now(timezone.utc)
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
        "created_at": datetime.now(timezone.utc),
        "completed_at": datetime.now(timezone.utc)
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

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "SSPILLOWY Core API",
        "version": "0.1.0",
        "database": "postgresql (healthy)",
        "redis_worker": "arq (ready)"
    }

@app.get("/api/v1/stats", response_model=DashboardStats, tags=["Dashboard"])
async def get_dashboard_stats():
    return DashboardStats(
        overall_health_score=82,
        monitored_repos=len(MOCK_REPOSITORIES),
        total_scans_run=48,
        total_open_findings=len(MOCK_FINDINGS),
        critical_findings=sum(1 for f in MOCK_FINDINGS if f["severity"] == SeverityLevel.CRITICAL),
        high_findings=sum(1 for f in MOCK_FINDINGS if f["severity"] == SeverityLevel.HIGH),
        medium_findings=sum(1 for f in MOCK_FINDINGS if f["severity"] == SeverityLevel.MEDIUM),
        low_findings=sum(1 for f in MOCK_FINDINGS if f["severity"] == SeverityLevel.LOW),
        secrets_leaked_prevented=14,
        findings_by_engine={
            "semgrep": 5,
            "trivy": 4,
            "gitleaks": 2,
            "owasp_zap": 3
        }
    )

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
        "created_at": datetime.now(timezone.utc)
    }
    MOCK_REPOSITORIES.append(new_repo)
    return new_repo

@app.get("/api/v1/findings", response_model=List[FindingResponse], tags=["Findings"])
async def list_findings(
    repository_id: Optional[str] = None,
    engine: Optional[EngineType] = None,
    severity: Optional[SeverityLevel] = None
):
    results = MOCK_FINDINGS
    if repository_id:
        results = [f for f in results if f["repository_id"] == repository_id]
    if engine:
        results = [f for f in results if f["engine"] == engine]
    if severity:
        results = [f for f in results if f["severity"] == severity]
    return results

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
        "created_at": datetime.now(timezone.utc),
        "completed_at": None
    }
    MOCK_SCANS.append(new_scan)
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
    return MOCK_POLICY
