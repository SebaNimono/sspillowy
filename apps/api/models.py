import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    """Usuario SSO (Google/…) o registro manual (email + contraseña)."""

    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    provider = Column(String, nullable=False, index=True)  # google | github | gitlab | microsoft | password
    provider_subject = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)  # solo cuentas con login manual / Pulse
    email_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    verification_token_expires_at = Column(DateTime, nullable=True)
    password_reset_token = Column(String, nullable=True)
    password_reset_expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    sessions = relationship("AuthSession", back_populates="user", cascade="all, delete-orphan")


class AuthSession(Base):
    """Sesión corta tras OAuth (el front guarda el id y consulta /auth/session/{id})."""

    __tablename__ = "auth_sessions"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="sessions")


class Repository(Base):
    __tablename__ = "repositories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, index=True)
    url = Column(String, nullable=False, unique=True)
    branch = Column(String, default="main")
    is_active = Column(Boolean, default=True)
    health_score = Column(Integer, default=100)
    open_criticals = Column(Integer, default=0)
    open_highs = Column(Integer, default=0)
    total_findings = Column(Integer, default=0)
    last_scan_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    # URL HTTP(S) para DAST (OWASP ZAP baseline). Opcional.
    dast_url = Column(String, nullable=True)

    scans = relationship("Scan", back_populates="repository", cascade="all, delete-orphan")
    findings = relationship("Finding", back_populates="repository", cascade="all, delete-orphan")


class Scan(Base):
    __tablename__ = "scans"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    repository_id = Column(String, ForeignKey("repositories.id"), nullable=False, index=True)
    status = Column(String, default="RUNNING")  # RUNNING, COMPLETED, FAILED
    triggered_by = Column(String, default="web_hub")
    branch = Column(String, default="main")
    total_findings = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)
    # PASSED | BLOCKED | SKIPPED | None (aún no evaluado)
    gate_status = Column(String, nullable=True)
    gate_detail = Column(Text, nullable=True)
    # Progreso en vivo: queued | cloning | semgrep | gitleaks | trivy | owasp_zap | gate | done | failed
    progress_stage = Column(String, nullable=True)
    progress_detail = Column(Text, nullable=True)
    # Motores que terminaron bien, separados por coma (None en escaneos anteriores a este campo)
    engines_ok = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    repository = relationship("Repository", back_populates="scans")
    findings = relationship("Finding", back_populates="scan", cascade="all, delete-orphan")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    repository_id = Column(String, ForeignKey("repositories.id"), nullable=False, index=True)
    scan_id = Column(String, ForeignKey("scans.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    engine = Column(String, nullable=False)  # semgrep, trivy, gitleaks, owasp_zap
    severity = Column(String, nullable=False)  # CRITICAL, HIGH, MEDIUM, LOW, INFO
    file_path = Column(String, nullable=True)
    line_number = Column(Integer, nullable=True)
    cwe = Column(String, nullable=True)
    owasp_category = Column(String, nullable=True)
    iso_control = Column(String, nullable=True)
    status = Column(String, default="OPEN")  # OPEN, IN_REVIEW, ACCEPTED_RISK, FIXED, FALSE_POSITIVE
    ai_triaged = Column(Boolean, default=False)
    ai_confidence = Column(Float, nullable=True)
    ai_summary = Column(Text, nullable=True)
    ai_remediation = Column(Text, nullable=True)
    # LIKELY_REAL | NEEDS_REVIEW | LIKELY_FALSE_POSITIVE
    ai_verdict = Column(String, nullable=True)
    ai_triaged_at = Column(DateTime, nullable=True)
    # ACCEPTED | DISMISSED: decisión humana sobre la sugerencia de la IA
    ai_feedback = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    repository = relationship("Repository", back_populates="findings")
    scan = relationship("Scan", back_populates="findings")


class SecurityGate(Base):
    __tablename__ = "security_gates"

    id = Column(String, primary_key=True, default="default-policy")
    name = Column(String, default="Default Organization Security Gate")
    max_critical_allowed = Column(Integer, default=0)
    max_high_allowed = Column(Integer, default=0)
    block_on_secrets = Column(Boolean, default=True)
    require_ciso_approval_for_bypass = Column(Boolean, default=True)
    enabled = Column(Boolean, default=True)


class GateBypassRequest(Base):
    """Excepción temporal al Security Gate (aprobación CISO en el hub)."""

    __tablename__ = "gate_bypass_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    repository_id = Column(String, ForeignKey("repositories.id"), nullable=True, index=True)
    reason = Column(Text, nullable=False)
    status = Column(String, default="PENDING", index=True)  # PENDING|APPROVED|REJECTED|EXPIRED
    requested_by = Column(String, nullable=False)
    decided_by = Column(String, nullable=True)
    decision_note = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    decided_at = Column(DateTime, nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    action = Column(String, nullable=False, index=True)
    target = Column(String, nullable=True)
    detail = Column(Text, nullable=True)
    actor_email = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SecretIncident(Base):
    """Respuesta a un secreto filtrado. Sobrevive a re-escaneos: se identifica por fingerprint."""

    __tablename__ = "secret_incidents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    fingerprint = Column(String, nullable=False, unique=True, index=True)
    repository_id = Column(String, ForeignKey("repositories.id"), nullable=False, index=True)
    rule_id = Column(String, nullable=False)
    provider = Column(String, nullable=False, default="generic")
    severity = Column(String, nullable=False, default="HIGH")
    file_path = Column(String, nullable=True)
    line_number = Column(Integer, nullable=True)
    preview = Column(String, nullable=True)
    # OPEN | IN_PROGRESS | RESOLVED | FALSE_POSITIVE
    status = Column(String, nullable=False, default="OPEN", index=True)
    owner_email = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    rotated_at = Column(DateTime, nullable=True)
    rotated_by = Column(String, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    revoked_by = Column(String, nullable=True)
    history_cleaned_at = Column(DateTime, nullable=True)
    history_cleaned_by = Column(String, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(String, nullable=True)
    first_seen_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_seen_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime, nullable=True)
    reopened_count = Column(Integer, default=0)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SbomComponent(Base):
    """Inventario vigente de dependencias de un repositorio (último análisis con Trivy)."""

    __tablename__ = "sbom_components"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    repository_id = Column(String, ForeignKey("repositories.id"), nullable=False, index=True)
    scan_id = Column(String, nullable=True)
    name = Column(String, nullable=False, index=True)
    version = Column(String, nullable=True)
    ecosystem = Column(String, nullable=True)
    purl = Column(String, nullable=True)
    licenses = Column(String, nullable=True)
    manifest = Column(String, nullable=True)
    direct = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SbomSnapshot(Base):
    """Resumen de cada SBOM generado y su diferencia con el anterior."""

    __tablename__ = "sbom_snapshots"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    repository_id = Column(String, ForeignKey("repositories.id"), nullable=False, index=True)
    scan_id = Column(String, nullable=True)
    component_count = Column(Integer, default=0)
    added = Column(Text, nullable=True)
    removed = Column(Text, nullable=True)
    updated = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DashboardView(Base):
    """Dashboard guardado: alcance (repos), periodo, bloques visibles, umbrales y widgets de Pillow."""

    __tablename__ = "dashboard_views"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    # JSON: lista de ids de repositorio; vacía = todos
    repository_ids = Column(Text, nullable=True)
    range_days = Column(Integer, default=30)
    # JSON: {"widgets": {...}, "thresholds": {...}}
    config = Column(Text, nullable=True)
    pillow_widgets = Column(Text, nullable=True)
    owner_email = Column(String, nullable=True, index=True)
    shared = Column(Boolean, default=True)
    # JSON: emails que lo marcaron como favorito
    starred_by = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Runbook(Base):
    """Regla "cuando pasa X → haz Y" que se evalúa al terminar cada análisis."""

    __tablename__ = "runbooks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    enabled = Column(Boolean, default=True)
    # SECRET_DETECTED | NEW_FINDING | GATE_BLOCKED | SLA_BREACHED | SCAN_FAILED
    trigger = Column(String, nullable=False, index=True)
    # JSON: {"repository_ids": [...], "min_severity": "CRITICAL"}
    conditions = Column(Text, nullable=True)
    # JSON: [{"type": "email", ...}, ...]
    actions = Column(Text, nullable=False)
    template = Column(String, nullable=True)
    owner_email = Column(String, nullable=True)
    run_count = Column(Integer, default=0)
    last_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class RunbookExecution(Base):
    __tablename__ = "runbook_executions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    runbook_id = Column(String, nullable=False, index=True)
    runbook_name = Column(String, nullable=False)
    trigger = Column(String, nullable=False)
    repository_id = Column(String, nullable=True, index=True)
    repository_name = Column(String, nullable=True)
    scan_id = Column(String, nullable=True)
    # SUCCESS | PARTIAL | FAILED | SIMULATED
    status = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    # JSON: [{"type", "label", "ok", "message"}]
    results = Column(Text, nullable=True)
    # JSON: fingerprints que dispararon la ejecución (evita repetir avisos de plazo vencido)
    fingerprints = Column(Text, nullable=True)
    actor = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class PillowDailyUsage(Base):
    """Créditos diarios del agente Pillow por usuario (email)."""

    __tablename__ = "pillow_daily_usage"

    user_key = Column(String, primary_key=True)
    usage_date = Column(Date, primary_key=True)
    credits_used = Column(Integer, default=0)
