"""
SSPILLOWY API Core — repos, findings, scans y gates desde PostgreSQL (sin MOCK en memoria).
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import joinedload

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from packages.core_models import (  # noqa: E402
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

from github_oauth import router as github_auth_router  # noqa: E402
from gitlab_oauth import router as gitlab_auth_router  # noqa: E402
from google_oauth import router as google_auth_router  # noqa: E402
from microsoft_oauth import router as microsoft_auth_router  # noqa: E402
from oauth_common import router as auth_meta_router  # noqa: E402
from password_auth import router as password_auth_router  # noqa: E402
from email_verification import router as email_verification_router  # noqa: E402
from password_reset import router as password_reset_router  # noqa: E402
from pillow_agent import router as pillow_router  # noqa: E402
from database import init_db, db_ping, SessionLocal  # noqa: E402
from email_service import mailer_status  # noqa: E402
from dashboard_metrics import (  # noqa: E402
    compute_dashboard_stats,
    compute_heatmap,
    list_audit_events,
    dashboard_has_data,
)
from models import (  # noqa: E402
    AuditEvent,
    Finding,
    Repository,
    Scan,
    SecurityGate,
)
from semgrep_scan import run_repo_scan_job, semgrep_available  # noqa: E402
from gitleaks_scan import gitleaks_available  # noqa: E402
from trivy_scan import trivy_available  # noqa: E402

app = FastAPI(
    title="SSPILLOWY API Core",
    description="Software Security Platform for Intelligent, Low-latency Oversight & Warning Yield",
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.on_event("startup")
async def on_startup():
    ok = init_db()
    print(f"[sspillowy] database ready={ok}")
    if not ok:
        return
    db = SessionLocal()
    try:
        if not dashboard_has_data(db):
            from seed_data import seed

            stats = seed()
            print(f"[sspillowy] empty DB → seed applied: {stats}")
        expired = _expire_stale_running_scans(db)
        if expired:
            print(f"[sspillowy] expired stale RUNNING scans: {expired}")
    except Exception as exc:
        print(f"[sspillowy] seed/cleanup skipped: {exc}")
    finally:
        db.close()


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

# Estado de lectura de notificaciones (efímero por instancia; hallazgos sí son persistentes)
_READ_NOTIFICATION_IDS: set[str] = set()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _expire_stale_running_scans(db) -> int:
    """Marca como FAILED escaneos RUNNING demasiado viejos (jobs muertos / seed)."""
    minutes = int(os.getenv("STALE_SCAN_MINUTES", "20"))
    cutoff = _now() - timedelta(minutes=max(5, minutes))
    rows = (
        db.query(Scan)
        .filter(Scan.status == "RUNNING", Scan.created_at < cutoff)
        .all()
    )
    if not rows:
        return 0
    for scan in rows:
        scan.status = "FAILED"
        scan.completed_at = _now()
        _append_audit(
            db,
            "scan-worker",
            "SCAN_STALE_EXPIRED",
            scan.id,
            f"Escaneo RUNNING expirado (> {minutes} min). Marcado FAILED.",
        )
    db.commit()
    return len(rows)


def _require_db():
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible.")


def _append_audit(db, actor: str, action: str, target: str, detail: str) -> None:
    db.add(
        AuditEvent(
            id=str(uuid.uuid4()),
            action=action,
            target=target,
            detail=detail,
            actor_email=actor,
            created_at=_now(),
        )
    )


def _refresh_repo_counters(db, repo: Repository) -> None:
    findings = db.query(Finding).filter(Finding.repository_id == repo.id).all()
    opens = [f for f in findings if (f.status or "") in ("OPEN", "IN_REVIEW")]
    repo.open_criticals = sum(1 for f in opens if (f.severity or "").upper() == "CRITICAL")
    repo.open_highs = sum(1 for f in opens if (f.severity or "").upper() == "HIGH")
    repo.total_findings = len(opens)


def _repo_out(repo: Repository) -> RepositoryResponse:
    return RepositoryResponse.model_validate(repo)


def _display_file_path(path: str | None) -> str | None:
    """Oculta rutas temporales de clone (/tmp/sspillowy-scan-.../repo/)."""
    if not path:
        return None
    s = str(path).replace("\\", "/").strip()
    for marker in ("/repo/", "/vuln_sample/"):
        if marker in s:
            return s.split(marker, 1)[1]
    if "sspillowy-scan-" in s:
        parts = s.split("/")
        if "repo" in parts:
            return "/".join(parts[parts.index("repo") + 1 :])
    return s


def _finding_out(finding: Finding) -> FindingResponse:
    out = FindingResponse.model_validate(finding)
    repo_name = None
    triggered = None
    try:
        if finding.repository is not None:
            repo_name = finding.repository.name
        if finding.scan is not None:
            triggered = finding.scan.triggered_by
    except Exception:
        pass
    return out.model_copy(
        update={
            "file_path": _display_file_path(out.file_path),
            "repository_name": repo_name,
            "triggered_by": triggered,
        }
    )


def _scan_out(scan: Scan) -> ScanResponse:
    return ScanResponse.model_validate(scan)


def _ensure_default_gate(db) -> SecurityGate:
    gate = db.get(SecurityGate, "default-policy")
    if gate:
        return gate
    gate = SecurityGate(id="default-policy")
    db.add(gate)
    db.commit()
    db.refresh(gate)
    return gate


def _gate_out(gate: SecurityGate) -> SecurityGatePolicy:
    return SecurityGatePolicy(
        id=gate.id,
        name=gate.name or "Default Organization Security Gate",
        max_critical_allowed=gate.max_critical_allowed or 0,
        max_high_allowed=gate.max_high_allowed or 0,
        block_on_secrets=bool(gate.block_on_secrets),
        require_ciso_approval_for_bypass=bool(gate.require_ciso_approval_for_bypass),
        enabled=bool(gate.enabled),
    )


def _build_notifications(db) -> list[dict]:
    """Notificaciones derivadas de findings abiertos + scans recientes (datos reales)."""
    items: list[dict] = []

    criticals = (
        db.query(Finding)
        .filter(Finding.status.in_(["OPEN", "IN_REVIEW"]), Finding.severity == "CRITICAL")
        .order_by(Finding.created_at.desc())
        .limit(10)
        .all()
    )
    for f in criticals:
        ntype = NotificationType.SECRET_LEAK if (f.engine or "").lower() == "gitleaks" else NotificationType.CRITICAL_FINDING
        items.append(
            {
                "id": f"notif-finding-{f.id}",
                "type": ntype,
                "severity": SeverityLevel(f.severity),
                "title": f.title[:120],
                "message": (f.ai_summary or f.description)[:240],
                "repository_id": f.repository_id,
                "finding_id": f.id,
                "read": f"notif-finding-{f.id}" in _READ_NOTIFICATION_IDS,
                "created_at": f.created_at or _now(),
            }
        )

    highs = (
        db.query(Finding)
        .filter(Finding.status.in_(["OPEN", "IN_REVIEW"]), Finding.severity == "HIGH")
        .order_by(Finding.created_at.desc())
        .limit(5)
        .all()
    )
    for f in highs:
        items.append(
            {
                "id": f"notif-finding-{f.id}",
                "type": NotificationType.AI_TRIAGE if f.ai_triaged else NotificationType.CRITICAL_FINDING,
                "severity": SeverityLevel.HIGH,
                "title": f.title[:120],
                "message": (f.ai_summary or f.description)[:240],
                "repository_id": f.repository_id,
                "finding_id": f.id,
                "read": f"notif-finding-{f.id}" in _READ_NOTIFICATION_IDS,
                "created_at": f.created_at or _now(),
            }
        )

    recent_scans = db.query(Scan).order_by(Scan.created_at.desc()).limit(5).all()
    for s in recent_scans:
        repo = db.get(Repository, s.repository_id)
        name = repo.name if repo else s.repository_id
        if s.status == "COMPLETED":
            title = f"Escaneo completado · {name}"
            msg = f"{s.total_findings} hallazgos ({s.critical_count} critical, {s.high_count} high)."
        else:
            title = f"Escaneo en curso · {name}"
            msg = f"Workers ejecutando motores en rama {s.branch}."
        items.append(
            {
                "id": f"notif-scan-{s.id}",
                "type": NotificationType.SCAN_COMPLETED,
                "severity": SeverityLevel.CRITICAL if s.critical_count else SeverityLevel.INFO,
                "title": title,
                "message": msg,
                "repository_id": s.repository_id,
                "finding_id": None,
                "read": f"notif-scan-{s.id}" in _READ_NOTIFICATION_IDS,
                "created_at": s.completed_at or s.created_at or _now(),
            }
        )

    gate = _ensure_default_gate(db)
    open_crit = db.query(Finding).filter(Finding.status.in_(["OPEN", "IN_REVIEW"]), Finding.severity == "CRITICAL").count()
    if gate.enabled and open_crit > (gate.max_critical_allowed or 0):
        items.insert(
            0,
            {
                "id": "notif-gate-block",
                "type": NotificationType.GATE_BLOCK,
                "severity": SeverityLevel.CRITICAL,
                "title": "Security Gate: pipeline bloqueado",
                "message": f"Hay {open_crit} critical abiertos (máx. permitido: {gate.max_critical_allowed}).",
                "repository_id": None,
                "finding_id": None,
                "read": "notif-gate-block" in _READ_NOTIFICATION_IDS,
                "created_at": _now(),
            },
        )

    items.sort(key=lambda n: n["created_at"], reverse=True)
    # dedupe by id
    seen: set[str] = set()
    unique = []
    for n in items:
        if n["id"] in seen:
            continue
        seen.add(n["id"])
        unique.append(n)
    return unique


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


@app.get("/health", tags=["Health"])
async def health_check():
    db_ok = db_ping()
    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "SSPILLOWY Core API",
        "version": "0.3.0",
        "database": "postgresql (ok)" if db_ok else "unavailable",
        "data_source": "postgresql" if db_ok else "none",
        "semgrep": "available" if semgrep_available() else "missing",
        "gitleaks": "available" if gitleaks_available() else "missing",
        "trivy": "available" if trivy_available() else "missing",
        "redis_worker": "inline-background (semgrep+gitleaks+trivy)",
        "email_mailer": mailer_status(),
    }


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
    _require_db()
    db = SessionLocal()
    try:
        rows = db.query(Repository).order_by(Repository.created_at.desc()).all()
        return [_repo_out(r) for r in rows]
    finally:
        db.close()


@app.post(
    "/api/v1/repositories",
    response_model=RepositoryResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Repositories"],
)
async def create_repository(repo: RepositoryCreate):
    _require_db()
    db = SessionLocal()
    try:
        existing = db.query(Repository).filter(Repository.url == repo.url).first()
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe un repositorio con esa URL.")
        row = Repository(
            id=str(uuid.uuid4()),
            name=repo.name,
            url=repo.url,
            branch=repo.branch or "main",
            is_active=True,
            health_score=100,
            open_criticals=0,
            open_highs=0,
            total_findings=0,
            last_scan_at=None,
            created_at=_now(),
        )
        db.add(row)
        _append_audit(
            db,
            "web_hub",
            "REPO_REGISTERED",
            repo.name,
            f"Repositorio {repo.url} registrado en rama {repo.branch}.",
        )
        db.commit()
        db.refresh(row)
        return _repo_out(row)
    finally:
        db.close()


@app.get("/api/v1/findings", response_model=List[FindingResponse], tags=["Findings"])
async def list_findings(
    repository_id: Optional[str] = None,
    engine: Optional[EngineType] = None,
    severity: Optional[SeverityLevel] = None,
    finding_status: Optional[FindingStatus] = Query(default=None, alias="status"),
):
    _require_db()
    db = SessionLocal()
    try:
        q = db.query(Finding)
        if repository_id:
            q = q.filter(Finding.repository_id == repository_id)
        if engine:
            q = q.filter(Finding.engine == engine.value)
        if severity:
            q = q.filter(Finding.severity == severity.value)
        if finding_status:
            q = q.filter(Finding.status == finding_status.value)
        else:
            # Por defecto ocultar supersedidos (re-escaneos) para no inflar la matriz
            q = q.filter(Finding.status != "SUPERSEDED")
        rows = (
            q.options(joinedload(Finding.repository), joinedload(Finding.scan))
            .order_by(Finding.created_at.desc())
            .all()
        )
        return [_finding_out(f) for f in rows]
    finally:
        db.close()


@app.delete("/api/v1/findings", tags=["Findings"])
async def clear_findings(repository_id: Optional[str] = None):
    """Vacía la matriz (todos o por repo). Útil para demos / re-escanear limpio."""
    _require_db()
    db = SessionLocal()
    try:
        q = db.query(Finding)
        if repository_id:
            q = q.filter(Finding.repository_id == repository_id)
        deleted = q.delete(synchronize_session=False)
        repos = db.query(Repository).all()
        if repository_id:
            repos = [r for r in repos if r.id == repository_id]
        for repo in repos:
            repo.open_criticals = 0
            repo.open_highs = 0
            repo.total_findings = 0
            repo.health_score = 100
        _append_audit(
            db,
            "web_hub",
            "FINDINGS_CLEARED",
            repository_id or "all",
            f"Matriz vaciada ({deleted} hallazgos eliminados).",
        )
        db.commit()
        return {"deleted": deleted, "repository_id": repository_id}
    finally:
        db.close()


@app.delete("/api/v1/repositories/{repository_id}", tags=["Repositories"])
async def delete_repository(repository_id: str):
    _require_db()
    db = SessionLocal()
    try:
        repo = db.get(Repository, repository_id)
        if not repo:
            raise HTTPException(status_code=404, detail="Repositorio no encontrado")
        name = repo.name
        # Borrar hallazgos y scans primero por si cascade no está en DB remota
        db.query(Finding).filter(Finding.repository_id == repository_id).delete(synchronize_session=False)
        db.query(Scan).filter(Scan.repository_id == repository_id).delete(synchronize_session=False)
        db.delete(repo)
        _append_audit(
            db,
            "web_hub",
            "REPO_DELETED",
            name,
            f"Repositorio {repository_id} eliminado con sus scans/hallazgos.",
        )
        db.commit()
        return {"deleted": True, "id": repository_id, "name": name}
    finally:
        db.close()


@app.patch("/api/v1/findings/{finding_id}", response_model=FindingResponse, tags=["Findings"])
async def update_finding_status(finding_id: str, payload: FindingStatusUpdate):
    _require_db()
    db = SessionLocal()
    try:
        finding = db.get(Finding, finding_id)
        if not finding:
            raise HTTPException(status_code=404, detail="Hallazgo no encontrado")
        finding.status = payload.status.value
        note = payload.note or "Sin nota adicional"
        _append_audit(
            db,
            "auditor",
            f"FINDING_{payload.status.value}",
            finding_id,
            f"Estado actualizado a {payload.status.value} (HITL). {note}",
        )
        repo = db.get(Repository, finding.repository_id)
        if repo:
            _refresh_repo_counters(db, repo)
        db.commit()
        db.refresh(finding)
        return _finding_out(finding)
    finally:
        db.close()


@app.post(
    "/api/v1/scans",
    response_model=ScanResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Scans"],
)
async def trigger_scan(scan_in: ScanCreate, background_tasks: BackgroundTasks):
    _require_db()
    db = SessionLocal()
    try:
        repo = db.get(Repository, scan_in.repository_id)
        if not repo:
            raise HTTPException(status_code=404, detail="Repositorio no encontrado")
        allowed = {"semgrep", "gitleaks", "trivy"}
        engines = [e.lower().strip() for e in (scan_in.engines or []) if e]
        engines = [e for e in engines if e in allowed]
        if not engines:
            engines = ["semgrep", "gitleaks", "trivy"]
        row = Scan(
            id=str(uuid.uuid4()),
            repository_id=scan_in.repository_id,
            status="RUNNING",
            triggered_by=scan_in.triggered_by or "web_hub",
            branch=scan_in.branch or repo.branch or "main",
            total_findings=0,
            critical_count=0,
            high_count=0,
            medium_count=0,
            low_count=0,
            created_at=_now(),
            completed_at=None,
        )
        db.add(row)
        repo.last_scan_at = _now()
        engines_label = " + ".join(e.capitalize() for e in engines)
        _append_audit(
            db,
            scan_in.triggered_by or "web_hub",
            "SCAN_TRIGGERED",
            repo.name,
            f"Escaneo {row.id} encolado · {engines_label} (background).",
        )
        db.commit()
        db.refresh(row)
        scan_id = row.id
        background_tasks.add_task(run_repo_scan_job, scan_id, engines)
        return _scan_out(row)
    finally:
        db.close()


@app.get("/api/v1/scans", response_model=List[ScanResponse], tags=["Scans"])
async def list_scans():
    _require_db()
    db = SessionLocal()
    try:
        _expire_stale_running_scans(db)
        rows = db.query(Scan).order_by(Scan.created_at.desc()).all()
        return [_scan_out(s) for s in rows]
    finally:
        db.close()


@app.get("/api/v1/security-gates", response_model=SecurityGatePolicy, tags=["Security Gates"])
async def get_security_gate():
    _require_db()
    db = SessionLocal()
    try:
        return _gate_out(_ensure_default_gate(db))
    finally:
        db.close()


@app.post("/api/v1/security-gates", response_model=SecurityGatePolicy, tags=["Security Gates"])
async def update_security_gate(policy: SecurityGatePolicy):
    _require_db()
    db = SessionLocal()
    try:
        gate = _ensure_default_gate(db)
        gate.name = policy.name
        gate.max_critical_allowed = policy.max_critical_allowed
        gate.max_high_allowed = policy.max_high_allowed
        gate.block_on_secrets = policy.block_on_secrets
        gate.require_ciso_approval_for_bypass = policy.require_ciso_approval_for_bypass
        gate.enabled = policy.enabled
        _append_audit(
            db,
            "web_hub",
            "GATE_UPDATED",
            policy.name,
            f"Umbrales: critical≤{policy.max_critical_allowed}, high≤{policy.max_high_allowed}, "
            f"block_secrets={policy.block_on_secrets}.",
        )
        db.commit()
        db.refresh(gate)
        return _gate_out(gate)
    finally:
        db.close()


@app.get("/api/v1/notifications", response_model=List[NotificationResponse], tags=["Notifications"])
async def list_notifications(unread_only: bool = False):
    _require_db()
    db = SessionLocal()
    try:
        items = _build_notifications(db)
        if unread_only:
            items = [n for n in items if not n["read"]]
        return items
    finally:
        db.close()


@app.post("/api/v1/notifications/{notification_id}/read", response_model=NotificationResponse, tags=["Notifications"])
async def mark_notification_read(notification_id: str):
    _require_db()
    db = SessionLocal()
    try:
        items = _build_notifications(db)
        notification = next((n for n in items if n["id"] == notification_id), None)
        if not notification:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")
        _READ_NOTIFICATION_IDS.add(notification_id)
        notification["read"] = True
        return notification
    finally:
        db.close()


@app.post("/api/v1/notifications/read-all", tags=["Notifications"])
async def mark_all_notifications_read():
    _require_db()
    db = SessionLocal()
    try:
        items = _build_notifications(db)
        for n in items:
            _READ_NOTIFICATION_IDS.add(n["id"])
        return {"updated": len(items)}
    finally:
        db.close()


@app.get("/api/v1/compliance/iso27001", response_model=ComplianceReport, tags=["Compliance"])
async def get_iso_compliance():
    _require_db()
    db = SessionLocal()
    try:
        open_items = (
            db.query(Finding)
            .filter(Finding.status.in_(["OPEN", "IN_REVIEW"]))
            .all()
        )

        def count_for(*needles: str) -> int:
            return sum(1 for f in open_items if any(n in (f.iso_control or "") for n in needles))

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
        stats = compute_dashboard_stats(db)
        return ComplianceReport(
            standard="ISO/IEC 27001:2022",
            period="2026-Q3",
            health_score=stats["overall_health_score"],
            controls=controls,
            generated_at=_now(),
            evidence_pack_ready=True,
        )
    finally:
        db.close()


@app.post("/api/v1/admin/seed", tags=["Admin"])
async def run_seed(force: bool = False):
    """Carga/reaplica datos demo reales en Postgres (útil en Railway/Supabase)."""
    _require_db()
    try:
        from seed_data import seed

        stats = seed(force=force)
        return {"ok": True, "message": "Seed aplicado.", **stats}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Seed falló: {exc}") from exc
