"""Escaneo Semgrep real: clone (o fixture) → semgrep --json → findings en Postgres."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from database import SessionLocal
from models import AuditEvent, Finding, Repository, Scan

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "vuln_sample"
OPEN_STATUSES = ("OPEN", "IN_REVIEW")
ACTIVE_STATUSES = ("OPEN", "IN_REVIEW")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _env_true(name: str, default: str = "true") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def semgrep_available() -> bool:
    return shutil.which("semgrep") is not None


def _normalize_clone_url(url: str) -> str:
    u = (url or "").strip()
    if u.startswith("git@"):
        return u
    if u.startswith("http://") or u.startswith("https://"):
        return u
    if u.startswith("github.com/") or u.startswith("gitlab.com/"):
        return f"https://{u}"
    return u


def _clone_repo(url: str, branch: str, dest: Path, timeout: int = 180) -> None:
    clone_url = _normalize_clone_url(url)
    token = os.getenv("GITHUB_TOKEN", "").strip() or os.getenv("GH_TOKEN", "").strip()
    env = os.environ.copy()
    # Auth opcional para repos privados GitHub
    if token and "github.com" in clone_url and "://" in clone_url:
        clone_url = clone_url.replace("https://", f"https://x-access-token:{token}@")
        clone_url = clone_url.replace("http://", f"http://x-access-token:{token}@")

    cmd = [
        "git",
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--branch",
        branch or "main",
        clone_url,
        str(dest),
    ]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )
    if proc.returncode != 0:
        # reintento en default branch si la rama no existe
        if branch and branch != "main":
            cmd[cmd.index("--branch") + 1] = "main"
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "clone failed").strip()[:500]
            raise RuntimeError(f"git clone falló: {err}")


def _map_severity(raw: str | None) -> str:
    s = (raw or "WARNING").strip().upper()
    mapping = {
        "CRITICAL": "CRITICAL",
        "ERROR": "HIGH",
        "HIGH": "HIGH",
        "MEDIUM": "MEDIUM",
        "WARNING": "MEDIUM",
        "LOW": "LOW",
        "INFO": "INFO",
    }
    return mapping.get(s, "MEDIUM")


def _run_semgrep(target: Path, timeout: int = 300) -> list[dict]:
    if not semgrep_available():
        raise RuntimeError(
            "semgrep no está instalado en el contenedor. Revisa el Dockerfile (pip install semgrep)."
        )

    config = os.getenv("SEMGREP_CONFIG", "p/ci").strip() or "p/ci"
    out_file = target / "semgrep-out.json"
    cmd = [
        "semgrep",
        "scan",
        "--config",
        config,
        "--json",
        "--quiet",
        "--metrics",
        "off",
        "-o",
        str(out_file),
        str(target),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    # Semgrep puede devolver 0 (ok) o 1 (hallazgos); ambos son válidos si hay JSON
    payload = ""
    if out_file.exists():
        payload = out_file.read_text(encoding="utf-8", errors="replace")
    elif proc.stdout.strip().startswith("{"):
        payload = proc.stdout
    if not payload:
        err = (proc.stderr or proc.stdout or "sin salida").strip()[:500]
        raise RuntimeError(f"semgrep no produjo JSON: {err}")

    data = json.loads(payload)
    return data.get("results") or []


def _cwe_from(result: dict) -> str | None:
    meta = (result.get("extra") or {}).get("metadata") or {}
    cwe = meta.get("cwe")
    if isinstance(cwe, list) and cwe:
        return str(cwe[0])[:80]
    if isinstance(cwe, str):
        return cwe[:80]
    return None


def relative_file_path(raw: str | None, scan_root: Path | None = None) -> str | None:
    """Devuelve ruta relativa al repo (sin /tmp/.../repo/)."""
    if not raw:
        return None
    s = str(raw).replace("\\", "/").strip()
    if not s:
        return None

    if scan_root is not None:
        try:
            root = str(scan_root.resolve()).replace("\\", "/")
            abs_s = str(Path(s).resolve()).replace("\\", "/") if Path(s).is_absolute() else s
            if abs_s.startswith(root.rstrip("/") + "/"):
                return abs_s[len(root.rstrip("/")) + 1 :]
            rel = Path(s)
            if not rel.is_absolute():
                return s.lstrip("./")
            return str(Path(s).resolve().relative_to(scan_root.resolve())).replace("\\", "/")
        except Exception:
            pass

    # Hallazgos ya guardados con path absoluto del clone temporal
    for marker in ("/repo/", "/vuln_sample/"):
        if marker in s:
            return s.split(marker, 1)[1]
    if "sspillowy-scan-" in s:
        parts = s.split("/")
        if "repo" in parts:
            idx = parts.index("repo")
            return "/".join(parts[idx + 1 :])
    return s.lstrip("./")


def _refresh_repo_counters(db, repo: Repository) -> None:
    findings = db.query(Finding).filter(Finding.repository_id == repo.id).all()
    opens = [f for f in findings if (f.status or "") in ACTIVE_STATUSES]
    repo.open_criticals = sum(1 for f in opens if (f.severity or "").upper() == "CRITICAL")
    repo.open_highs = sum(1 for f in opens if (f.severity or "").upper() == "HIGH")
    # Total = hallazgos activos (no acumulados de escaneos viejos)
    repo.total_findings = len(opens)
    sev = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in opens:
        k = (f.severity or "").upper()
        if k in sev:
            sev[k] += 1
    penalty = sev["CRITICAL"] * 18 + sev["HIGH"] * 8 + sev["MEDIUM"] * 3 + sev["LOW"]
    repo.health_score = max(0, min(100, 100 - penalty))


def _supersede_previous_findings(db, *, repo_id: str, engines: list[str], keep_scan_id: str) -> int:
    """Cierra hallazgos abiertos de escaneos anteriores para no acumular al re-escanear."""
    if not engines:
        return 0
    rows = (
        db.query(Finding)
        .filter(
            Finding.repository_id == repo_id,
            Finding.status.in_(list(ACTIVE_STATUSES)),
            Finding.engine.in_(engines),
            Finding.scan_id != keep_scan_id,
        )
        .all()
    )
    for f in rows:
        f.status = "SUPERSEDED"
    return len(rows)


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


def persist_semgrep_results(
    db,
    *,
    scan: Scan,
    repo: Repository,
    results: list[dict],
    scan_root: Path | None = None,
) -> dict[str, int]:
    """Persiste findings Semgrep. No cierra el Scan (el job multi-motor lo hace)."""
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    max_findings = int(os.getenv("SEMGREP_MAX_FINDINGS", "40"))
    for result in results[:max_findings]:
        extra = result.get("extra") or {}
        severity = _map_severity(extra.get("severity") or result.get("severity"))
        counts[severity] = counts.get(severity, 0) + 1
        check_id = result.get("check_id") or "semgrep.rule"
        path = relative_file_path(result.get("path") or "", scan_root) or ""
        start = (result.get("start") or {}).get("line")
        message = (extra.get("message") or check_id).strip()
        title = f"{check_id}: {message}"[:200]
        finding = Finding(
            id=str(uuid.uuid4()),
            repository_id=repo.id,
            scan_id=scan.id,
            title=title,
            description=message[:2000],
            engine="semgrep",
            severity=severity,
            file_path=path[:500] if path else None,
            line_number=int(start) if start else None,
            cwe=_cwe_from(result),
            owasp_category=None,
            iso_control="A.8.28 — Codificación segura",
            status="OPEN",
            ai_triaged=False,
            ai_confidence=None,
            ai_summary=None,
            ai_remediation=None,
            created_at=_now(),
        )
        db.add(finding)
    return counts


def _merge_counts(*parts: dict[str, int]) -> dict[str, int]:
    out = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for part in parts:
        for k, v in part.items():
            out[k] = out.get(k, 0) + int(v or 0)
    return out


def finalize_scan(
    db,
    *,
    scan: Scan,
    repo: Repository,
    counts: dict[str, int],
    source_note: str,
    engines_note: str,
) -> None:
    total = sum(counts.values())
    scan.status = "COMPLETED"
    scan.completed_at = _now()
    scan.total_findings = total
    scan.critical_count = counts.get("CRITICAL", 0)
    scan.high_count = counts.get("HIGH", 0)
    scan.medium_count = counts.get("MEDIUM", 0)
    scan.low_count = counts.get("LOW", 0) + counts.get("INFO", 0)
    repo.last_scan_at = _now()
    _refresh_repo_counters(db, repo)
    _append_audit(
        db,
        "scan-worker",
        "SCAN_COMPLETED",
        repo.name,
        f"{engines_note} · {total} hallazgos · {source_note}",
    )


def run_semgrep_scan_job(scan_id: str, engines: list[str] | None = None) -> None:
    """Alias histórico → job multi-motor."""
    run_repo_scan_job(scan_id, engines)


def run_repo_scan_job(scan_id: str, engines: list[str] | None = None) -> None:
    """Job en background: clone (o fixture) → motores seleccionados → Postgres."""
    from gitleaks_scan import gitleaks_available, persist_gitleaks_findings, run_gitleaks
    from trivy_scan import persist_trivy_findings, run_trivy_fs, trivy_available

    wanted = {e.lower().strip() for e in (engines or ["semgrep", "gitleaks", "trivy"])}
    wanted &= {"semgrep", "gitleaks", "trivy"}
    if not wanted:
        wanted = {"semgrep", "gitleaks", "trivy"}

    db = SessionLocal()
    work_parent: Path | None = None
    try:
        scan = db.get(Scan, scan_id)
        if not scan:
            return
        repo = db.get(Repository, scan.repository_id)
        if not repo:
            scan.status = "FAILED"
            scan.completed_at = _now()
            db.commit()
            return

        work_parent = Path(tempfile.mkdtemp(prefix="sspillowy-scan-"))
        clone_dir = work_parent / "repo"
        source_note = ""
        target: Path

        fallback_ok = _env_true("SEMGREP_FALLBACK_FIXTURE", "true") or _env_true(
            "SCAN_FALLBACK_FIXTURE", "true"
        )

        try:
            _clone_repo(repo.url, scan.branch or repo.branch or "main", clone_dir)
            target = clone_dir
            source_note = f"clone {repo.url}@{scan.branch}"
        except Exception as clone_exc:
            if fallback_ok and FIXTURE_DIR.exists():
                target = FIXTURE_DIR
                source_note = f"fixture local (clone falló: {clone_exc})"
                _append_audit(
                    db,
                    "scan-worker",
                    "SCAN_CLONE_FALLBACK",
                    repo.name,
                    f"No se pudo clonar {repo.url}. Escaneando fixture vuln_sample. Detalle: {str(clone_exc)[:300]}",
                )
                db.commit()
            else:
                scan.status = "FAILED"
                scan.completed_at = _now()
                _append_audit(
                    db,
                    "scan-worker",
                    "SCAN_FAILED",
                    repo.name,
                    f"Clone falló: {str(clone_exc)[:400]}",
                )
                db.commit()
                return

        engine_notes: list[str] = []
        count_parts: list[dict[str, int]] = []
        errors: list[str] = []
        engines_ok: list[str] = []

        if "semgrep" in wanted:
            if semgrep_available():
                try:
                    sg_results = _run_semgrep(target)
                    sg_counts = persist_semgrep_results(
                        db, scan=scan, repo=repo, results=sg_results, scan_root=target
                    )
                    count_parts.append(sg_counts)
                    engine_notes.append(f"Semgrep {sum(sg_counts.values())}")
                    engines_ok.append("semgrep")
                except Exception as exc:
                    errors.append(f"semgrep: {exc}")
                    _append_audit(
                        db,
                        "scan-worker",
                        "ENGINE_FAILED",
                        repo.name,
                        f"Semgrep: {str(exc)[:400]}",
                    )
            else:
                errors.append("semgrep missing")

        if "gitleaks" in wanted:
            if gitleaks_available():
                try:
                    gl_results = run_gitleaks(target)
                    gl_counts = persist_gitleaks_findings(
                        db, scan=scan, repo=repo, results=gl_results, scan_root=target
                    )
                    count_parts.append(gl_counts)
                    engine_notes.append(f"GitLeaks {sum(gl_counts.values())}")
                    engines_ok.append("gitleaks")
                except Exception as exc:
                    errors.append(f"gitleaks: {exc}")
                    _append_audit(
                        db,
                        "scan-worker",
                        "ENGINE_FAILED",
                        repo.name,
                        f"GitLeaks: {str(exc)[:400]}",
                    )
            else:
                errors.append("gitleaks missing")

        if "trivy" in wanted:
            if trivy_available():
                try:
                    tv_results = run_trivy_fs(target)
                    tv_counts = persist_trivy_findings(
                        db, scan=scan, repo=repo, results=tv_results, scan_root=target
                    )
                    count_parts.append(tv_counts)
                    engine_notes.append(f"Trivy {sum(tv_counts.values())}")
                    engines_ok.append("trivy")
                except Exception as exc:
                    errors.append(f"trivy: {exc}")
                    _append_audit(
                        db,
                        "scan-worker",
                        "ENGINE_FAILED",
                        repo.name,
                        f"Trivy: {str(exc)[:400]}",
                    )
            else:
                errors.append("trivy missing")

        if not count_parts:
            scan.status = "FAILED"
            scan.completed_at = _now()
            _append_audit(
                db,
                "scan-worker",
                "SCAN_FAILED",
                repo.name,
                f"Ningún motor produjo resultados. {'; '.join(errors)[:400]}",
            )
            db.commit()
            return

        superseded = _supersede_previous_findings(
            db, repo_id=repo.id, engines=engines_ok, keep_scan_id=scan.id
        )
        if superseded:
            _append_audit(
                db,
                "scan-worker",
                "FINDINGS_SUPERSEDED",
                repo.name,
                f"{superseded} hallazgos previos marcados SUPERSEDED tras nuevo escaneo.",
            )

        merged = _merge_counts(*count_parts)
        note = " + ".join(engine_notes) if engine_notes else "scan"
        if errors:
            note += f" (parcial: {'; '.join(errors)[:160]})"
        finalize_scan(
            db,
            scan=scan,
            repo=repo,
            counts=merged,
            source_note=source_note,
            engines_note=note,
        )
        db.commit()
    except Exception as exc:
        try:
            scan = db.get(Scan, scan_id)
            if scan:
                scan.status = "FAILED"
                scan.completed_at = _now()
                _append_audit(db, "scan-worker", "SCAN_FAILED", scan_id, str(exc)[:400])
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()
        if work_parent and work_parent.exists():
            shutil.rmtree(work_parent, ignore_errors=True)
