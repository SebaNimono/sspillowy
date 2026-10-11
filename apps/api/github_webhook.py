"""Webhook de GitHub: push / pull_request → encola escaneo SSPILLOWY."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status
from pydantic import BaseModel

from database import SessionLocal, db_ping
from models import AuditEvent, Repository, Scan
from workspaces import bind_session
from semgrep_scan import run_repo_scan_job

router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks"])

DEFAULT_ENGINES = ["semgrep", "gitleaks", "trivy"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_repo_url(url: str | None) -> str:
    if not url:
        return ""
    s = url.strip().lower()
    s = re.sub(r"^git\+", "", s)
    s = re.sub(r"^git@", "https://", s)
    s = s.replace("github.com:", "github.com/")
    s = re.sub(r"\.git$", "", s)
    s = s.rstrip("/")
    # Quedarse con host/owner/repo
    m = re.search(r"(github\.com[/:][^/\s]+/[^/\s]+)", s)
    if m:
        return m.group(1).replace(":", "/")
    return s


def _urls_match(stored: str, *candidates: str) -> bool:
    a = _normalize_repo_url(stored)
    if not a:
        return False
    for c in candidates:
        b = _normalize_repo_url(c)
        if b and (a == b or a.endswith("/" + b.split("github.com/", 1)[-1]) or b.endswith(a.split("github.com/", 1)[-1])):
            return True
        # full_name owner/repo
        if "/" in (c or "") and "github.com" not in (c or "").lower():
            if a.endswith("/" + c.strip().lower().strip("/")):
                return True
    return False


def _verify_signature(body: bytes, signature_header: str | None, secret: str) -> bool:
    if not secret or not signature_header:
        return False
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    expected = f"sha256={digest}"
    return hmac.compare_digest(expected, signature_header.strip())


def _branch_from_ref(ref: str | None) -> str | None:
    if not ref:
        return None
    if ref.startswith("refs/heads/"):
        return ref[len("refs/heads/") :]
    if ref.startswith("refs/tags/"):
        return None
    return ref


def _webhook_engines() -> list[str]:
    raw = os.getenv("WEBHOOK_SCAN_ENGINES", "semgrep,gitleaks,trivy")
    allowed = {"semgrep", "gitleaks", "trivy", "owasp_zap"}
    engines = [e.strip().lower() for e in raw.split(",") if e.strip()]
    engines = [e for e in engines if e in allowed]
    return engines or list(DEFAULT_ENGINES)


def _append_audit(db, actor: str, action: str, target: str, detail: str) -> None:
    db.add(
        AuditEvent(
            id=str(uuid.uuid4()),
            action=action,
            target=target,
            detail=detail[:2000],
            actor_email=actor,
            created_at=_now(),
        )
    )


def _find_repo(db, *, html_url: str | None, clone_url: str | None, full_name: str | None) -> Repository | None:
    rows = db.query(Repository).filter(Repository.is_active.is_(True)).all()
    for repo in rows:
        if _urls_match(repo.url, html_url or "", clone_url or "", full_name or ""):
            return repo
    return None


def _has_recent_running(db, repository_id: str) -> bool:
    minutes = int(os.getenv("WEBHOOK_DEBOUNCE_MINUTES", "3"))
    cutoff = _now() - timedelta(minutes=max(1, minutes))
    existing = (
        db.query(Scan)
        .filter(
            Scan.repository_id == repository_id,
            Scan.status == "RUNNING",
            Scan.created_at >= cutoff,
        )
        .first()
    )
    return existing is not None


class WebhookInfo(BaseModel):
    endpoint: str
    events: list[str]
    secret_configured: bool
    engines: list[str]
    instructions: str


@router.get("/github/info", response_model=WebhookInfo)
async def github_webhook_info():
    public = (os.getenv("API_PUBLIC_URL") or "https://api.sspillowy.com").rstrip("/")
    secret_ok = bool(os.getenv("GITHUB_WEBHOOK_SECRET", "").strip())
    return WebhookInfo(
        endpoint=f"{public}/api/v1/webhooks/github",
        events=["ping", "push", "pull_request"],
        secret_configured=secret_ok,
        engines=_webhook_engines(),
        instructions=(
            "En GitHub → Settings → Webhooks → Add webhook. "
            f"Payload URL: {public}/api/v1/webhooks/github · Content type: application/json · "
            "Secret = GITHUB_WEBHOOK_SECRET de Railway · Events: push + Pull requests. "
            "El repo debe estar registrado en SSPILLOWY con la misma URL."
        ),
    )


@router.post("/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
    x_github_event: str | None = Header(default=None, alias="X-GitHub-Event"),
    x_github_delivery: str | None = Header(default=None, alias="X-GitHub-Delivery"),
):
    secret = os.getenv("GITHUB_WEBHOOK_SECRET", "").strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GITHUB_WEBHOOK_SECRET no configurado en Railway.",
        )

    body = await request.body()
    if not _verify_signature(body, x_hub_signature_256, secret):
        raise HTTPException(status_code=401, detail="Firma webhook inválida.")

    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"JSON inválido: {exc}") from exc

    event = (x_github_event or "").strip().lower()

    if event == "ping":
        return {
            "ok": True,
            "event": "ping",
            "zen": payload.get("zen"),
            "delivery": x_github_delivery,
            "message": "Webhook SSPILLOWY activo.",
        }

    if event not in {"push", "pull_request"}:
        return {"ok": True, "ignored": True, "event": event, "reason": "evento no manejado"}

    # Extraer repo + rama
    gh_repo = payload.get("repository") or {}
    html_url = gh_repo.get("html_url")
    clone_url = gh_repo.get("clone_url") or gh_repo.get("git_url")
    full_name = gh_repo.get("full_name")
    branch: str | None = None
    triggered_by = "github_webhook"
    commit_sha: str | None = None
    commit_message: str | None = None
    commit_author: str | None = None

    if event == "push":
        if payload.get("deleted"):
            return {"ok": True, "ignored": True, "reason": "rama eliminada"}
        branch = _branch_from_ref(payload.get("ref"))
        if not branch:
            return {"ok": True, "ignored": True, "reason": "ref no es branch"}
        pusher = (payload.get("pusher") or {}).get("name") or "github"
        triggered_by = f"github_push:{pusher}"
        head = payload.get("head_commit") or {}
        commit_sha = head.get("id") or payload.get("after")
        commit_message = (head.get("message") or "").split("\n", 1)[0] or None
        commit_author = (head.get("author") or {}).get("name") or pusher
    else:
        action = (payload.get("action") or "").lower()
        if action not in {"opened", "reopened", "synchronize"}:
            return {"ok": True, "ignored": True, "reason": f"PR action={action}"}
        pr = payload.get("pull_request") or {}
        branch = (pr.get("head") or {}).get("ref")
        if not branch:
            return {"ok": True, "ignored": True, "reason": "PR sin head.ref"}
        user = ((pr.get("user") or {}).get("login")) or "github"
        triggered_by = f"github_pr:{user}"
        commit_sha = (pr.get("head") or {}).get("sha")
        commit_message = f"PR #{pr.get('number')}: {pr.get('title') or ''}".strip() if pr.get("number") else None
        commit_author = user

    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible")

    db = SessionLocal()
    try:
        repo = _find_repo(db, html_url=html_url, clone_url=clone_url, full_name=full_name)
        if not repo:
            _append_audit(
                db,
                "github_webhook",
                "WEBHOOK_REPO_UNKNOWN",
                full_name or html_url or "unknown",
                "Repo de GitHub no registrado en SSPILLOWY. Regístrelo en Repositorios.",
            )
            db.commit()
            return {
                "ok": True,
                "ignored": True,
                "reason": "repositorio no registrado",
                "github_repo": full_name,
            }
        bind_session(db, repo.workspace_id)

        # Opcional: solo la rama configurada del repo
        only_tracked = os.getenv("WEBHOOK_ONLY_TRACKED_BRANCH", "false").lower() in {
            "1",
            "true",
            "yes",
        }
        if only_tracked and repo.branch and branch != repo.branch:
            return {
                "ok": True,
                "ignored": True,
                "reason": f"rama {branch} distinta de {repo.branch}",
            }

        if _has_recent_running(db, repo.id):
            return {
                "ok": True,
                "ignored": True,
                "reason": "ya hay un escaneo RUNNING reciente (debounce)",
                "repository_id": repo.id,
            }

        engines = _webhook_engines()
        target_url = (getattr(repo, "dast_url", None) or "").strip() or None
        if "owasp_zap" in engines and not target_url:
            target_url = os.getenv("ZAP_DEFAULT_TARGET", "").strip() or None

        scan = Scan(
            id=str(uuid.uuid4()),
            repository_id=repo.id,
            status="RUNNING",
            triggered_by=triggered_by[:120],
            branch=branch or repo.branch or "main",
            total_findings=0,
            critical_count=0,
            high_count=0,
            medium_count=0,
            low_count=0,
            progress_stage="queued",
            progress_detail="Webhook encolado…",
            commit_sha=(commit_sha or None) and str(commit_sha)[:64],
            commit_message=(commit_message or None) and str(commit_message)[:500],
            commit_author=(commit_author or None) and str(commit_author)[:200],
            created_at=_now(),
            completed_at=None,
        )
        db.add(scan)
        repo.last_scan_at = _now()
        engines_label = " + ".join(engines)
        _append_audit(
            db,
            triggered_by[:120],
            "SCAN_TRIGGERED",
            repo.name,
            f"Webhook GitHub ({event}) · scan {scan.id} · {engines_label} · branch {scan.branch} · delivery {x_github_delivery or '-'}",
        )
        db.commit()
        scan_id = scan.id
        background_tasks.add_task(run_repo_scan_job, scan_id, engines, target_url)
        return {
            "ok": True,
            "queued": True,
            "event": event,
            "scan_id": scan_id,
            "repository_id": repo.id,
            "repository_name": repo.name,
            "branch": scan.branch,
            "engines": engines,
            "delivery": x_github_delivery,
        }
    finally:
        db.close()
