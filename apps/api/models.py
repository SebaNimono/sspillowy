import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

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
