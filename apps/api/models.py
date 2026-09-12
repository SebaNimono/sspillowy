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


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    action = Column(String, nullable=False, index=True)
    target = Column(String, nullable=True)
    detail = Column(Text, nullable=True)
    actor_email = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PillowDailyUsage(Base):
    """Créditos diarios del agente Pillow por usuario (email)."""

    __tablename__ = "pillow_daily_usage"

    user_key = Column(String, primary_key=True)
    usage_date = Column(Date, primary_key=True)
    credits_used = Column(Integer, default=0)
