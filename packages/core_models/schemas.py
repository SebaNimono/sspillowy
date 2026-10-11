from enum import Enum
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class EngineType(str, Enum):
    SEMGREP = "semgrep"
    TRIVY = "trivy"
    GITLEAKS = "gitleaks"
    OWASP_ZAP = "owasp_zap"

class SeverityLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"

class FindingStatus(str, Enum):
    OPEN = "OPEN"
    IN_REVIEW = "IN_REVIEW"
    ACCEPTED_RISK = "ACCEPTED_RISK"
    FIXED = "FIXED"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    SUPERSEDED = "SUPERSEDED"

# Finding Schemas
class FindingBase(BaseModel):
    title: str
    description: str
    engine: EngineType
    severity: SeverityLevel
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    cwe: Optional[str] = None
    owasp_category: Optional[str] = None
    iso_control: Optional[str] = None

class FindingCreate(FindingBase):
    repository_id: str
    scan_id: str

class FindingResponse(FindingBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    repository_id: str
    scan_id: str
    status: FindingStatus = FindingStatus.OPEN
    ai_triaged: bool = False
    ai_confidence: Optional[float] = None
    ai_summary: Optional[str] = None
    ai_remediation: Optional[str] = None
    created_at: datetime
    first_seen_at: Optional[datetime] = None
    repository_name: Optional[str] = None
    triggered_by: Optional[str] = None

# Repository Schemas
class RepositoryBase(BaseModel):
    name: str
    url: str
    branch: str = "main"
    dast_url: Optional[str] = None

class RepositoryCreate(RepositoryBase):
    provider: Optional[str] = None
    access_token: Optional[str] = None

class RepositoryUpdate(BaseModel):
    name: Optional[str] = None
    branch: Optional[str] = None
    dast_url: Optional[str] = None
    # None = sin cambios; "" = quitar el token guardado.
    access_token: Optional[str] = None

class RepositoryResponse(RepositoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: Optional[str] = None
    has_access_token: bool = False
    is_active: bool = True
    health_score: int = 100
    open_criticals: int = 0
    open_highs: int = 0
    total_findings: int = 0
    last_scan_at: Optional[datetime] = None
    created_at: datetime

# Scan Schemas
class ScanCreate(BaseModel):
    repository_id: str
    triggered_by: str = "web_user"
    branch: str = "main"
    # Motores: semgrep, gitleaks, trivy, owasp_zap
    engines: List[str] = Field(default_factory=lambda: ["semgrep", "gitleaks", "trivy"])
    # Override de URL DAST (si no, usa repo.dast_url o ZAP_DEFAULT_TARGET)
    target_url: Optional[str] = None


class ScanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    repository_id: str
    status: str
    triggered_by: str
    branch: str
    total_findings: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    gate_status: Optional[str] = None  # PASSED | BLOCKED | SKIPPED
    gate_detail: Optional[str] = None
    progress_stage: Optional[str] = None
    progress_detail: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

# Security Gate Policy Schema
class SecurityGatePolicy(BaseModel):
    id: str = "default-policy"
    name: str = "Política Estándar DevSecOps"
    max_critical_allowed: int = 0
    max_high_allowed: int = 2
    block_on_secrets: bool = True
    require_ciso_approval_for_bypass: bool = True
    enabled: bool = True


class GateCheckResponse(BaseModel):
    """Resultado de evaluación del gate (para consola + CI)."""

    allowed: bool
    decision: str  # PASSED | BLOCKED | DISABLED
    reasons: List[str] = Field(default_factory=list)
    summary: str = ""
    open_critical: int = 0
    open_high: int = 0
    open_secrets: int = 0
    max_critical_allowed: int = 0
    max_high_allowed: int = 0
    block_on_secrets: bool = True
    require_ciso_approval_for_bypass: bool = True
    policy_name: str = ""
    policy_id: str = "default-policy"
    repository_id: Optional[str] = None
    repository_name: Optional[str] = None

# Dashboard Stats Schema
class DashboardStats(BaseModel):
    overall_health_score: int
    monitored_repos: int
    total_scans_run: int
    total_open_findings: int
    critical_findings: int
    high_findings: int
    medium_findings: int
    low_findings: int
    secrets_leaked_prevented: int
    findings_by_engine: dict
    trend_7d: List[int] = Field(default_factory=list)


class FindingStatusUpdate(BaseModel):
    status: FindingStatus
    note: Optional[str] = None


class NotificationType(str, Enum):
    SECRET_LEAK = "SECRET_LEAK"
    CRITICAL_FINDING = "CRITICAL_FINDING"
    GATE_BLOCK = "GATE_BLOCK"
    SCAN_COMPLETED = "SCAN_COMPLETED"
    PULSE_BYPASS = "PULSE_BYPASS"
    AI_TRIAGE = "AI_TRIAGE"


class NotificationResponse(BaseModel):
    id: str
    type: NotificationType
    severity: SeverityLevel
    title: str
    message: str
    repository_id: Optional[str] = None
    finding_id: Optional[str] = None
    read: bool = False
    created_at: datetime


class AuditEventResponse(BaseModel):
    id: str
    actor: str
    action: str
    target: str
    detail: str
    created_at: datetime


class HeatmapCell(BaseModel):
    date: str
    count: int
    level: int


class HeatmapResponse(BaseModel):
    cells: List[HeatmapCell]
    max_count: int
    total_findings_period: int
    weeks: int = 12


class IsoControl(BaseModel):
    code: str
    title: str
    status: str
    related_engine: Optional[str] = None
    open_findings: int = 0
    reason: Optional[str] = None


class ComplianceReport(BaseModel):
    standard: str
    period: str
    health_score: int
    controls: List[IsoControl]
    generated_at: datetime
    evidence_pack_ready: bool = True
