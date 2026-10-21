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
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query, status
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
    RepositoryUpdate,
    ScanCreate,
    ScanResponse,
    SecurityGatePolicy,
    GateCheckResponse,
    DashboardStats,
    NotificationType,
    NotificationResponse,
    AuditEventResponse,
    HeatmapResponse,
    ComplianceReport,
    IsoControl,
)

from auth_deps import hub_auth_mode, resolve_session  # noqa: E402
from github_oauth import router as github_auth_router  # noqa: E402
from github_webhook import router as github_webhook_router  # noqa: E402
from gitlab_oauth import router as gitlab_auth_router  # noqa: E402
from google_oauth import router as google_auth_router  # noqa: E402
from microsoft_oauth import router as microsoft_auth_router  # noqa: E402
from oauth_common import router as auth_meta_router  # noqa: E402
from password_auth import router as password_auth_router  # noqa: E402
from email_verification import router as email_verification_router  # noqa: E402
from password_reset import router as password_reset_router  # noqa: E402
from pillow_agent import router as pillow_router  # noqa: E402
from gate_bypass import router as gate_bypass_router  # noqa: E402
from secret_management import router as secret_management_router  # noqa: E402
from sbom import router as sbom_router  # noqa: E402
from fix_intel import router as fix_intel_router  # noqa: E402
from dashboard_views import router as dashboard_views_router  # noqa: E402
from velocity import first_seen_map, fingerprint, router as velocity_router  # noqa: E402
from runbooks import router as runbooks_router  # noqa: E402
from compliance import current_period, iso_controls  # noqa: E402
from compliance import router as compliance_router  # noqa: E402
from executive import router as executive_router  # noqa: E402
from obs_metrics import MetricsMiddleware  # noqa: E402
from observability import metrics_router, start_flusher  # noqa: E402
from observability import router as observability_router  # noqa: E402
from traceability import router as traceability_router  # noqa: E402
from integrations import router as integrations_router, workspace_for_ci_key  # noqa: E402
from repo_access import access_message, clean_url, detect_provider, encrypt, probe_access  # noqa: E402
from repo_access import router as repo_access_router  # noqa: E402
from workspaces import (  # noqa: E402
    WorkspaceCtx,
    adopt_orphans,
    bootstrap as bootstrap_workspaces,
    invalidate_workspace_cache,
    platform_admins,
    require_ws,
    require_ws_write,
    resolve_workspace,
    router as workspaces_router,
)
from database import init_db, db_ping, SessionLocal  # noqa: E402
import database as _database  # noqa: E402
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
    SbomComponent,
    SbomSnapshot,
    Scan,
    SecretIncident,
    SecurityGate,
)
from gate_eval import evaluate_gate, gate_for  # noqa: E402
from semgrep_scan import run_repo_scan_job, semgrep_available  # noqa: E402
from gitleaks_scan import gitleaks_available  # noqa: E402
from trivy_scan import trivy_available  # noqa: E402
from zap_scan import zap_available, zap_binary  # noqa: E402
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
    start_flusher()
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
    try:
        bootstrap_workspaces()
    except Exception as exc:
        print(f"[sspillowy] workspace bootstrap failed: {exc}")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(MetricsMiddleware)

app.include_router(auth_meta_router)
app.include_router(password_auth_router)
app.include_router(email_verification_router)
app.include_router(password_reset_router)
app.include_router(pillow_router)
app.include_router(github_auth_router)
app.include_router(github_webhook_router)
app.include_router(gitlab_auth_router)
app.include_router(google_auth_router)
app.include_router(microsoft_auth_router)
app.include_router(gate_bypass_router)
app.include_router(secret_management_router)
app.include_router(sbom_router)
app.include_router(fix_intel_router)
app.include_router(dashboard_views_router)
app.include_router(velocity_router)
app.include_router(runbooks_router)
app.include_router(executive_router)
app.include_router(compliance_router)
app.include_router(observability_router)
app.include_router(traceability_router)
app.include_router(workspaces_router)
app.include_router(integrations_router)
app.include_router(repo_access_router)
app.include_router(metrics_router)

# Estado de lectura de notificaciones por usuario ("email:id"; efímero por instancia)
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
        repo = db.get(Repository, scan.repository_id)
        _append_audit(
            db,
            "scan-worker",
            "SCAN_STALE_EXPIRED",
            scan.id,
            f"Escaneo RUNNING expirado (> {minutes} min). Marcado FAILED.",
            workspace_id=repo.workspace_id if repo else None,
        )
    db.commit()
    return len(rows)


def _require_db():
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible.")


def _append_audit(
    db,
    actor: str,
    action: str,
    target: str,
    detail: str,
    finding_id: str | None = None,
    workspace_id: str | None = None,
) -> None:
    db.add(
        AuditEvent(
            id=str(uuid.uuid4()),
            action=action,
            target=target,
            detail=detail,
            actor_email=actor,
            finding_id=finding_id,
            workspace_id=workspace_id,
            created_at=_now(),
        )
    )


def _refresh_repo_counters(db, repo: Repository) -> None:
    findings = db.query(Finding).filter(Finding.repository_id == repo.id).all()
    opens = [f for f in findings if (f.status or "") in ("OPEN", "IN_REVIEW")]
    repo.open_criticals = sum(1 for f in opens if (f.severity or "").upper() == "CRITICAL")
    repo.open_highs = sum(1 for f in opens if (f.severity or "").upper() == "HIGH")
    repo.total_findings = len(opens)
    sev = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in opens:
        k = (f.severity or "").upper()
        if k in sev:
            sev[k] += 1
    penalty = sev["CRITICAL"] * 18 + sev["HIGH"] * 8 + sev["MEDIUM"] * 3 + sev["LOW"]
    repo.health_score = max(0, min(100, 100 - penalty))


def _repo_out(repo: Repository) -> RepositoryResponse:
    out = RepositoryResponse.model_validate(repo)
    if not out.provider:
        out = out.model_copy(update={"provider": detect_provider(repo.url or "")})
    return out


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


def _finding_out(finding: Finding, first_seen: dict | None = None) -> FindingResponse:
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
            "first_seen_at": (first_seen or {}).get(
                (finding.repository_id, fingerprint(finding.engine, finding.title, finding.file_path))
            )
            or out.created_at,
        }
    )


def _scan_out(scan: Scan) -> ScanResponse:
    return ScanResponse.model_validate(scan)


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


def _build_notifications(db, ws: WorkspaceCtx) -> list[dict]:
    """Notificaciones derivadas de findings abiertos + scans recientes del espacio."""
    items: list[dict] = []
    in_scope = ws.scope_ids

    def is_read(nid: str) -> bool:
        return f"{ws.email}:{nid}" in _READ_NOTIFICATION_IDS

    criticals = (
        db.query(Finding)
        .filter(Finding.repository_id.in_(in_scope))
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
                "read": is_read(f"notif-finding-{f.id}"),
                "created_at": f.created_at or _now(),
            }
        )

    highs = (
        db.query(Finding)
        .filter(Finding.repository_id.in_(in_scope))
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
                "read": is_read(f"notif-finding-{f.id}"),
                "created_at": f.created_at or _now(),
            }
        )

    recent_scans = (
        db.query(Scan).filter(Scan.repository_id.in_(in_scope)).order_by(Scan.created_at.desc()).limit(5).all()
    )
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
                "read": is_read(f"notif-scan-{s.id}"),
                "created_at": s.completed_at or s.created_at or _now(),
            }
        )

    gate = gate_for(db, ws.id)
    # Notificación GATE_BLOCK si el espacio entero falla el gate
    org_ev = evaluate_gate(db, gate, repo_ids=ws.repo_ids, workspace_id=ws.id)
    if ws.repo_ids and org_ev.decision == "BLOCKED":
        items.insert(
            0,
            {
                "id": "notif-gate-block",
                "type": NotificationType.GATE_BLOCK,
                "severity": SeverityLevel.CRITICAL,
                "title": "Security Gate: pipeline bloqueado",
                "message": org_ev.summary()[:240],
                "repository_id": None,
                "finding_id": None,
                "read": is_read("notif-gate-block"),
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
def health_check():
    db_ok = db_ping()
    backend = "sqlite" if _database.USING_SQLITE else "postgresql"
    return {
        "status": "healthy" if db_ok and backend == "postgresql" else "degraded",
        "service": "SSPILLOWY Core API",
        "version": "0.3.0",
        "database": f"{backend} (ok)" if db_ok else "unavailable",
        "data_source": backend if db_ok else "none",
        "semgrep": "available" if semgrep_available() else "missing",
        "gitleaks": "available" if gitleaks_available() else "missing",
        "trivy": "available" if trivy_available() else "missing",
        "owasp_zap": "full" if zap_binary() else ("baseline-lite" if zap_available() else "missing"),
        "redis_worker": "inline-background (semgrep+gitleaks+trivy+zap)",
        "email_mailer": mailer_status(),
        "hub_auth_mode": hub_auth_mode(),
    }


def _repo_ids_param(raw: Optional[str], ws: WorkspaceCtx) -> list[str]:
    """Repos pedidos dentro del espacio; sin filtro = todos los del espacio (nunca vacío)."""
    ids = [p.strip() for p in (raw or "").split(",") if p.strip()]
    if ids:
        ids = [i for i in ids if ws.has_repo(i)]
        return ids or ["__none__"]
    return ws.scope_ids


@app.get("/api/v1/stats", response_model=DashboardStats, tags=["Dashboard"])
def get_dashboard_stats(
    repository_ids: Optional[str] = Query(default=None), ws: WorkspaceCtx = Depends(require_ws)
):
    db = SessionLocal()
    try:
        if not db_ping() or not ws.repo_ids:
            return _empty_dashboard_stats()
        return DashboardStats(**compute_dashboard_stats(db, _repo_ids_param(repository_ids, ws)))
    except Exception as exc:
        print(f"[sspillowy] dashboard stats error: {exc}")
        return _empty_dashboard_stats()
    finally:
        db.close()


@app.get("/api/v1/heatmap", response_model=HeatmapResponse, tags=["Dashboard"])
def get_heatmap(
    weeks: int = Query(default=12, ge=4, le=52),
    repository_ids: Optional[str] = Query(default=None),
    ws: WorkspaceCtx = Depends(require_ws),
):
    db = SessionLocal()
    try:
        if not db_ping() or not ws.repo_ids:
            return _empty_heatmap(weeks)
        return HeatmapResponse(**compute_heatmap(db, weeks=weeks, repo_ids=_repo_ids_param(repository_ids, ws)))
    except Exception as exc:
        print(f"[sspillowy] heatmap error: {exc}")
        return _empty_heatmap(weeks)
    finally:
        db.close()


@app.get("/api/v1/audit-log", response_model=List[AuditEventResponse], tags=["Audit"])
def list_audit_log(
    limit: int = Query(default=40, ge=1, le=200),
    repository_ids: Optional[str] = Query(default=None),
    ws: WorkspaceCtx = Depends(require_ws),
):
    db = SessionLocal()
    try:
        if not db_ping():
            return []
        explicit = _repo_ids_param(repository_ids, ws) if repository_ids else None
        return list_audit_events(db, limit=limit, repo_ids=explicit, workspace_id=ws.id)
    except Exception as exc:
        print(f"[sspillowy] audit log error: {exc}")
        return []
    finally:
        db.close()


@app.get("/api/v1/repositories", response_model=List[RepositoryResponse], tags=["Repositories"])
def list_repositories(ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    db = SessionLocal()
    try:
        rows = (
            db.query(Repository)
            .filter(Repository.workspace_id == ws.id)
            .order_by(Repository.created_at.desc())
            .all()
        )
        return [_repo_out(r) for r in rows]
    finally:
        db.close()


@app.post(
    "/api/v1/repositories",
    response_model=RepositoryResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Repositories"],
)
def create_repository(repo: RepositoryCreate, ws: WorkspaceCtx = Depends(require_ws_write)):
    _require_db()
    url, provider = clean_url(repo.url, repo.provider)
    token = (repo.access_token or "").strip() or None
    if token:
        res = probe_access(url, token, provider)
        if not res.ok:
            raise HTTPException(status_code=422, detail=access_message(res, provider))
    db = ws.session()
    try:
        existing = db.query(Repository).filter(Repository.url.in_([url, f"{url}.git", repo.url.strip()])).first()
        if existing:
            if existing.workspace_id == ws.id:
                raise HTTPException(status_code=409, detail="Ya existe un repositorio con esa URL.")
            raise HTTPException(
                status_code=409,
                detail="Ese repositorio ya está conectado en otro espacio. Pide a su administrador que te invite.",
            )
        row = Repository(
            id=str(uuid.uuid4()),
            workspace_id=ws.id,
            name=repo.name.strip(),
            url=url,
            branch=(repo.branch or "").strip() or "main",
            dast_url=(repo.dast_url or "").strip() or None,
            provider=provider,
            access_token_enc=encrypt(token) if token else None,
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
            ws.actor,
            "REPO_REGISTERED",
            row.name,
            f"Repositorio {url} registrado en rama {row.branch}" + (" con token de lectura." if token else "."),
        )
        db.commit()
        invalidate_workspace_cache()
        db.refresh(row)
        return _repo_out(row)
    finally:
        db.close()


@app.patch("/api/v1/repositories/{repository_id}", response_model=RepositoryResponse, tags=["Repositories"])
def update_repository(repository_id: str, body: RepositoryUpdate, ws: WorkspaceCtx = Depends(require_ws_write)):
    _require_db()
    db = ws.session()
    try:
        repo = db.get(Repository, repository_id)
        if not repo or repo.workspace_id != ws.id:
            raise HTTPException(status_code=404, detail="Repositorio no encontrado")
        changes = []
        if body.name is not None and body.name.strip() and body.name.strip() != repo.name:
            repo.name = body.name.strip()
            changes.append("nombre")
        if body.branch is not None and body.branch.strip() and body.branch.strip() != repo.branch:
            repo.branch = body.branch.strip()
            changes.append("rama")
        if body.dast_url is not None and (body.dast_url.strip() or None) != repo.dast_url:
            repo.dast_url = body.dast_url.strip() or None
            changes.append("URL de la aplicación")
        if body.access_token is not None:
            token = body.access_token.strip()
            if token:
                provider = repo.provider or detect_provider(repo.url)
                res = probe_access(repo.url, token, provider)
                if not res.ok:
                    raise HTTPException(status_code=422, detail=access_message(res, provider))
                repo.access_token_enc = encrypt(token)
                changes.append("token de lectura")
            elif repo.access_token_enc:
                repo.access_token_enc = None
                changes.append("token de lectura retirado")
        if changes:
            _append_audit(db, ws.actor, "REPO_UPDATED", repo.name, "Cambios: " + ", ".join(changes) + ".")
        db.commit()
        db.refresh(repo)
        return _repo_out(repo)
    finally:
        db.close()


@app.get("/api/v1/findings", response_model=List[FindingResponse], tags=["Findings"])
def list_findings(
    repository_id: Optional[str] = None,
    engine: Optional[EngineType] = None,
    severity: Optional[SeverityLevel] = None,
    finding_status: Optional[FindingStatus] = Query(default=None, alias="status"),
    ws: WorkspaceCtx = Depends(require_ws),
):
    _require_db()
    db = SessionLocal()
    try:
        q = db.query(Finding)
        if repository_id:
            ws.require_repo(repository_id)
            q = q.filter(Finding.repository_id == repository_id)
        else:
            q = q.filter(Finding.repository_id.in_(ws.scope_ids))
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
        first_seen = first_seen_map(db, [repository_id] if repository_id else ws.scope_ids)
        return [_finding_out(f, first_seen) for f in rows]
    finally:
        db.close()


@app.delete("/api/v1/findings", tags=["Findings"])
def clear_findings(repository_id: Optional[str] = None, ws: WorkspaceCtx = Depends(require_ws_write)):
    """Vacía la matriz (todos o por repo). Útil para demos / re-escanear limpio."""
    _require_db()
    db = ws.session()
    try:
        q = db.query(Finding)
        if repository_id:
            ws.require_repo(repository_id)
            q = q.filter(Finding.repository_id == repository_id)
        else:
            q = q.filter(Finding.repository_id.in_(ws.scope_ids))
        deleted = q.delete(synchronize_session=False)
        repos = db.query(Repository).filter(Repository.workspace_id == ws.id).all()
        if repository_id:
            repos = [r for r in repos if r.id == repository_id]
        for repo in repos:
            repo.open_criticals = 0
            repo.open_highs = 0
            repo.total_findings = 0
            repo.health_score = 100
        repo_label = repos[0].name if repository_id and repos else (repository_id or "all")
        _append_audit(
            db,
            ws.actor,
            "FINDINGS_CLEARED",
            repo_label,
            f"Matriz vaciada ({deleted} hallazgos eliminados).",
        )
        db.commit()
        return {"deleted": deleted, "repository_id": repository_id}
    finally:
        db.close()


@app.delete("/api/v1/repositories/{repository_id}", tags=["Repositories"])
def delete_repository(repository_id: str, ws: WorkspaceCtx = Depends(require_ws_write)):
    _require_db()
    db = ws.session()
    try:
        repo = db.get(Repository, repository_id)
        if not repo or repo.workspace_id != ws.id:
            raise HTTPException(status_code=404, detail="Repositorio no encontrado")
        name = repo.name
        # Borrar hallazgos y scans primero por si cascade no está en DB remota
        db.query(Finding).filter(Finding.repository_id == repository_id).delete(synchronize_session=False)
        for model in (SecretIncident, SbomComponent, SbomSnapshot):
            db.query(model).filter(model.repository_id == repository_id).delete(synchronize_session=False)
        db.query(Scan).filter(Scan.repository_id == repository_id).delete(synchronize_session=False)
        db.delete(repo)
        _append_audit(
            db,
            ws.actor,
            "REPO_DELETED",
            name,
            f"Repositorio {repository_id} eliminado con sus scans/hallazgos.",
        )
        db.commit()
        invalidate_workspace_cache()
        return {"deleted": True, "id": repository_id, "name": name}
    finally:
        db.close()


@app.patch("/api/v1/findings/{finding_id}", response_model=FindingResponse, tags=["Findings"])
def update_finding_status(
    finding_id: str, payload: FindingStatusUpdate, ws: WorkspaceCtx = Depends(require_ws_write)
):
    _require_db()
    db = ws.session()
    try:
        finding = db.get(Finding, finding_id)
        if not finding or not ws.has_repo(finding.repository_id):
            raise HTTPException(status_code=404, detail="Hallazgo no encontrado")
        previous = finding.status
        finding.status = payload.status.value
        note = (payload.note or "").strip()
        repo = db.get(Repository, finding.repository_id)
        _append_audit(
            db,
            ws.actor,
            f"FINDING_{payload.status.value}",
            repo.name if repo else finding.repository_id,
            f"{finding.title} ({previous} → {payload.status.value})" + (f". {note}" if note else ""),
            finding_id=finding_id,
        )
        if repo:
            _refresh_repo_counters(db, repo)
        db.commit()
        db.refresh(finding)
        return _finding_out(finding, first_seen_map(db, [finding.repository_id]))
    finally:
        db.close()


@app.post(
    "/api/v1/scans",
    response_model=ScanResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Scans"],
)
def trigger_scan(
    scan_in: ScanCreate, background_tasks: BackgroundTasks, ws: WorkspaceCtx = Depends(require_ws_write)
):
    _require_db()
    db = ws.session()
    try:
        repo = db.get(Repository, scan_in.repository_id)
        if not repo or repo.workspace_id != ws.id:
            raise HTTPException(status_code=404, detail="Repositorio no encontrado")
        allowed = {"semgrep", "gitleaks", "trivy", "owasp_zap"}
        engines = [e.lower().strip() for e in (scan_in.engines or []) if e]
        engines = [e for e in engines if e in allowed]
        if not engines:
            engines = ["semgrep", "gitleaks", "trivy"]
        target_url = (scan_in.target_url or getattr(repo, "dast_url", None) or "").strip() or None
        if "owasp_zap" in engines and not target_url:
            # Fallback global; el job también lo usa
            target_url = os.getenv("ZAP_DEFAULT_TARGET", "https://sspillowy.com").strip() or None
        triggered_by = (scan_in.triggered_by or "").strip()
        if triggered_by in ("", "web_hub", "manual_web"):
            triggered_by = ws.actor
        row = Scan(
            id=str(uuid.uuid4()),
            repository_id=scan_in.repository_id,
            status="RUNNING",
            triggered_by=triggered_by[:120],
            branch=scan_in.branch or repo.branch or "main",
            total_findings=0,
            critical_count=0,
            high_count=0,
            medium_count=0,
            low_count=0,
            progress_stage="queued",
            progress_detail="En cola…",
            created_at=_now(),
            completed_at=None,
        )
        db.add(row)
        repo.last_scan_at = _now()
        engines_label = " + ".join(e.replace("owasp_zap", "OWASP-ZAP") for e in engines)
        _append_audit(
            db,
            triggered_by[:120],
            "SCAN_TRIGGERED",
            repo.name,
            f"Escaneo {row.id} encolado · {engines_label}"
            + (f" · DAST {target_url}" if target_url and "owasp_zap" in engines else "")
            + " (background).",
        )
        db.commit()
        db.refresh(row)
        scan_id = row.id
        background_tasks.add_task(run_repo_scan_job, scan_id, engines, target_url)
        return _scan_out(row)
    finally:
        db.close()


@app.get("/api/v1/scans", response_model=List[ScanResponse], tags=["Scans"])
def list_scans(ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    db = SessionLocal()
    try:
        _expire_stale_running_scans(db)
        rows = (
            db.query(Scan)
            .filter(Scan.repository_id.in_(ws.scope_ids))
            .order_by(Scan.created_at.desc())
            .all()
        )
        return [_scan_out(s) for s in rows]
    finally:
        db.close()


@app.get("/api/v1/security-gates", response_model=SecurityGatePolicy, tags=["Security Gates"])
def get_security_gate(ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    db = SessionLocal()
    try:
        return _gate_out(gate_for(db, ws.id))
    finally:
        db.close()


def _resolve_repository_id(
    db, repository_id: Optional[str], repository_url: Optional[str], workspace_id: Optional[str] = None
) -> Optional[str]:
    if repository_id:
        return repository_id
    if not repository_url:
        return None
    from github_webhook import _find_repo

    repo = _find_repo(
        db,
        html_url=repository_url,
        clone_url=repository_url if repository_url.endswith(".git") else f"{repository_url.rstrip('/')}.git",
        full_name=None,
        workspace_id=workspace_id,
    )
    # También probar full_name owner/repo
    if not repo and "github.com/" in repository_url.lower():
        full = repository_url.lower().split("github.com/", 1)[-1].strip("/")
        if full.endswith(".git"):
            full = full[: -len(".git")]
        repo = _find_repo(db, html_url=None, clone_url=None, full_name=full, workspace_id=workspace_id)
    if not repo:
        raise HTTPException(
            status_code=404,
            detail=f"Repositorio no registrado en SSPILLOWY: {repository_url}",
        )
    return repo.id


def _gate_check_response(
    db, *, repository_id: str | None, ws: WorkspaceCtx | None = None, workspace_id: str | None = None
) -> GateCheckResponse:
    """Con repositorio: política del espacio de ese repo. Sin repositorio: todo el espacio."""
    scope = ws.id if ws is not None else workspace_id
    repo_name = None
    if repository_id:
        repo = db.get(Repository, repository_id)
        if not repo or (scope is not None and repo.workspace_id != scope):
            raise HTTPException(status_code=404, detail="Repositorio no encontrado")
        repo_name = repo.name
        gate = gate_for(db, repo.workspace_id)
        ev = evaluate_gate(db, gate, repository_id=repository_id, workspace_id=repo.workspace_id)
    elif scope is not None:
        repo_ids = ws.repo_ids if ws is not None else [
            rid for (rid,) in db.query(Repository.id).filter(Repository.workspace_id == scope).all()
        ]
        gate = gate_for(db, scope)
        ev = evaluate_gate(db, gate, repo_ids=repo_ids, workspace_id=scope)
    else:
        raise HTTPException(
            status_code=400,
            detail="Indica repository_url o repository_id, o inicia sesión para evaluar tu espacio.",
        )
    return GateCheckResponse(
        allowed=ev.allowed,
        decision=ev.decision,
        reasons=ev.reasons,
        summary=ev.summary(),
        open_critical=ev.open_critical,
        open_high=ev.open_high,
        open_secrets=ev.open_secrets,
        max_critical_allowed=ev.max_critical_allowed,
        max_high_allowed=ev.max_high_allowed,
        block_on_secrets=ev.block_on_secrets,
        require_ciso_approval_for_bypass=ev.require_ciso_approval_for_bypass,
        policy_name=ev.policy_name,
        policy_id=gate.id,
        repository_id=repository_id,
        repository_name=repo_name,
    )


@app.get(
    "/api/v1/security-gates/check",
    response_model=GateCheckResponse,
    tags=["Security Gates"],
)
def check_security_gate(
    repository_id: Optional[str] = None,
    repository_url: Optional[str] = None,
    session=Depends(resolve_session),
    x_workspace_id: Optional[str] = Header(default=None, alias="X-Workspace-Id"),
    x_sspillowy_key: Optional[str] = Header(default=None, alias="X-SSPILLOWY-Key"),
):
    """Evalúa la política ahora (espacio o un repo). Para consola y CI: mirar `allowed`.

    Desde un pipeline se identifica el espacio con su clave (cabecera X-SSPILLOWY-Key).
    """
    _require_db()
    ws = None
    key_ws: Optional[str] = None
    if x_sspillowy_key:
        key_ws = workspace_for_ci_key(x_sspillowy_key)
        if not key_ws:
            raise HTTPException(status_code=401, detail="La clave del pipeline no es válida o fue renovada.")
    elif session:
        ws = resolve_workspace(session, (x_workspace_id or "").strip() or None)
    db = SessionLocal()
    try:
        if ws is None and key_ws is None:
            # Sin sesión ni clave: solo el espacio de la plataforma, para no romper su pipeline existente.
            from workspaces import legacy_workspace_id

            if not repository_url and not repository_id:
                raise HTTPException(status_code=401, detail="Falta la clave del pipeline (cabecera X-SSPILLOWY-Key).")
            key_ws = legacy_workspace_id(db)
            try:
                rid = _resolve_repository_id(db, repository_id, repository_url, workspace_id=key_ws)
            except HTTPException:
                raise HTTPException(
                    status_code=401,
                    detail="Falta la clave del pipeline (cabecera X-SSPILLOWY-Key). Créala en Integraciones → CI/CD.",
                )
            return _gate_check_response(db, repository_id=rid, workspace_id=key_ws)
        scope = ws.id if ws is not None else key_ws
        rid = _resolve_repository_id(db, repository_id, repository_url, workspace_id=scope)
        return _gate_check_response(db, repository_id=rid, ws=ws, workspace_id=key_ws)
    finally:
        db.close()


@app.get("/api/v1/security-gates/overview", tags=["Security Gates"])
def security_gate_overview(ws: WorkspaceCtx = Depends(require_ws)):
    """Todo lo que necesita la pantalla del gate en una sola llamada."""
    from gate_bypass import _out as bypass_out, expire_stale_bypasses
    from gate_eval import open_counts_by_repo, repo_decision
    from models import GateBypassRequest

    _require_db()
    db = ws.session()
    try:
        expire_stale_bypasses(db)
        db.commit()
        gate = gate_for(db, ws.id)
        check = _gate_check_response(db, repository_id=None, ws=ws)
        repos = (
            db.query(Repository.id, Repository.name)
            .filter(Repository.workspace_id == ws.id)
            .order_by(Repository.name.asc())
            .all()
        )
        names = {rid: name for rid, name in repos}
        rows = (
            db.query(GateBypassRequest)
            .filter(GateBypassRequest.workspace_id == ws.id)
            .order_by(GateBypassRequest.created_at.desc())
            .limit(50)
            .all()
        )
        now = _now()

        def _active(b) -> bool:
            if b.status != "APPROVED":
                return False
            exp = b.expires_at
            if exp is not None and exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            return exp is None or exp >= now

        active = [b for b in rows if _active(b)]
        org_bypass = any(b.repository_id is None for b in active)
        bypassed_repos = {b.repository_id for b in active if b.repository_id}
        counts = open_counts_by_repo(db, list(names))
        per_repo = [
            {
                "id": rid,
                "name": names[rid],
                "open_critical": counts[rid]["critical"],
                "open_high": counts[rid]["high"],
                "open_secrets": counts[rid]["secrets"],
                "decision": repo_decision(gate, counts[rid], org_bypass or rid in bypassed_repos),
            }
            for rid in names
        ]
        order = {"BLOCKED": 0, "BYPASSED": 1, "PASSED": 2, "DISABLED": 3}
        per_repo.sort(key=lambda r: (order.get(r["decision"], 9), r["name"].lower()))
        return {
            "policy": _gate_out(gate),
            "check": check,
            "repos": per_repo,
            "bypasses": [bypass_out(b, names.get(b.repository_id)) for b in rows],
            "can_manage": ws.can_manage,
            "can_write": ws.can_write,
        }
    finally:
        db.close()


@app.post(
    "/api/v1/security-gates/evaluate",
    response_model=GateCheckResponse,
    tags=["Security Gates"],
)
def evaluate_security_gate(
    repository_id: Optional[str] = None,
    repository_url: Optional[str] = None,
    ws: WorkspaceCtx = Depends(require_ws_write),
):
    """Igual que check; deja auditoría GATE_EVALUATED."""
    _require_db()
    db = ws.session()
    try:
        rid = _resolve_repository_id(db, repository_id, repository_url, workspace_id=ws.id)
        out = _gate_check_response(db, repository_id=rid, ws=ws)
        target = out.repository_name or "organization"
        _append_audit(
            db,
            ws.actor,
            "GATE_PASSED" if out.allowed else "GATE_BLOCK",
            target,
            out.summary,
        )
        db.commit()
        return out
    finally:
        db.close()


@app.post("/api/v1/security-gates", response_model=SecurityGatePolicy, tags=["Security Gates"])
def update_security_gate(policy: SecurityGatePolicy, ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    if not ws.can_manage:
        raise HTTPException(
            status_code=403, detail="Solo el propietario o un administrador del espacio puede cambiar la política."
        )
    db = ws.session()
    try:
        gate = gate_for(db, ws.id)
        gate.name = policy.name
        gate.max_critical_allowed = policy.max_critical_allowed
        gate.max_high_allowed = policy.max_high_allowed
        gate.block_on_secrets = policy.block_on_secrets
        gate.require_ciso_approval_for_bypass = policy.require_ciso_approval_for_bypass
        gate.enabled = policy.enabled
        _append_audit(
            db,
            ws.actor,
            "GATE_UPDATED",
            policy.name,
            f"Umbrales: critical≤{policy.max_critical_allowed}, high≤{policy.max_high_allowed}, "
            f"block_secrets={policy.block_on_secrets}, enabled={policy.enabled}.",
        )
        db.commit()
        db.refresh(gate)
        return _gate_out(gate)
    finally:
        db.close()


@app.get("/api/v1/notifications", response_model=List[NotificationResponse], tags=["Notifications"])
def list_notifications(unread_only: bool = False, ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    db = SessionLocal()
    try:
        items = _build_notifications(db, ws)
        if unread_only:
            items = [n for n in items if not n["read"]]
        return items
    finally:
        db.close()


@app.post("/api/v1/notifications/{notification_id}/read", response_model=NotificationResponse, tags=["Notifications"])
def mark_notification_read(notification_id: str, ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    db = SessionLocal()
    try:
        items = _build_notifications(db, ws)
        notification = next((n for n in items if n["id"] == notification_id), None)
        if not notification:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")
        _READ_NOTIFICATION_IDS.add(f"{ws.email}:{notification_id}")
        notification["read"] = True
        return notification
    finally:
        db.close()


@app.post("/api/v1/notifications/read-all", tags=["Notifications"])
def mark_all_notifications_read(ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    db = SessionLocal()
    try:
        items = _build_notifications(db, ws)
        for n in items:
            _READ_NOTIFICATION_IDS.add(f"{ws.email}:{n['id']}")
        return {"updated": len(items)}
    finally:
        db.close()


@app.get("/api/v1/compliance/iso27001", response_model=ComplianceReport, tags=["Compliance"])
def get_iso_compliance(ws: WorkspaceCtx = Depends(require_ws)):
    _require_db()
    db = ws.session()
    try:
        controls = [IsoControl(**c) for c in iso_controls(db, workspace_id=ws.id)]
        stats = compute_dashboard_stats(db, ws.scope_ids)
        return ComplianceReport(
            standard="ISO/IEC 27001:2022",
            period=current_period(),
            health_score=stats["overall_health_score"] if ws.repo_ids else 0,
            controls=controls,
            generated_at=_now(),
            evidence_pack_ready=True,
        )
    finally:
        db.close()


@app.post("/api/v1/admin/seed", tags=["Admin"])
def run_seed(force: bool = False, ws: WorkspaceCtx = Depends(require_ws)):
    """Carga/reaplica datos demo en el espacio activo (solo administradores de la plataforma)."""
    _require_db()
    if ws.email not in platform_admins():
        raise HTTPException(status_code=403, detail="Solo los administradores de la plataforma pueden cargar datos demo.")
    try:
        from seed_data import seed

        stats = seed(force=force)
        db = SessionLocal()
        try:
            adopt_orphans(db, ws.id)
        finally:
            db.close()
        return {"ok": True, "message": "Seed aplicado.", **stats}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Seed falló: {exc}") from exc
