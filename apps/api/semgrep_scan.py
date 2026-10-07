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
    # Sin TTY en Railway: git no debe pedir usuario/contraseña interactivo
    # (error típico: "could not read Username for 'https://github.com': No such device")
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GCM_INTERACTIVE"] = "never"
    env.pop("GIT_ASKPASS", None)
    env.pop("SSH_ASKPASS", None)

    # Auth opcional para repos privados o anti rate-limit de GitHub
    if token and "github.com" in clone_url and "://" in clone_url:
        # Evitar doble inyección si la URL ya trae credenciales
        if "@github.com" not in clone_url.split("://", 1)[-1]:
            clone_url = clone_url.replace("https://", f"https://x-access-token:{token}@", 1)
            clone_url = clone_url.replace("http://", f"http://x-access-token:{token}@", 1)

    def _run(branch_name: str) -> subprocess.CompletedProcess[str]:
        cmd = [
            "git",
            "-c",
            "credential.helper=",
            "-c",
            "advice.detachedHead=false",
            "clone",
            "--depth",
            "1",
            "--single-branch",
            "--branch",
            branch_name or "main",
            clone_url,
            str(dest),
        ]
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)

    if dest.exists():
        shutil.rmtree(dest, ignore_errors=True)

    proc = _run(branch or "main")
    if proc.returncode != 0 and branch and branch != "main":
        if dest.exists():
            shutil.rmtree(dest, ignore_errors=True)
        proc = _run("main")

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "clone failed").strip()[:500]
        hint = ""
        low = err.lower()
        if "could not read username" in low or "authentication failed" in low or "auth" in low:
            hint = (
                " GitHub pidió autenticación (repo privado o rate-limit anónimo). "
                "En Railway configura GITHUB_TOKEN (classic con repo read, o fine-grained Contents: Read)."
            )
        raise RuntimeError(f"git clone falló: {err}.{hint}")


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

    raw_config = os.getenv("SEMGREP_CONFIG", "p/ci,p/owasp-top-ten").strip() or "p/ci"
    configs = [c.strip() for c in raw_config.split(",") if c.strip()]
    out_file = target / "semgrep-out.json"
    excludes = [
        "fixtures",
        "node_modules",
        "defectdojo",
        "mockup_movil",
        "ppt",
        "dist",
        "build",
        ".git",
    ]
    cmd = ["semgrep", "scan"]
    for cfg in configs:
        cmd.extend(["--config", cfg])
    cmd += [
        "--json",
        "--quiet",
        "--metrics",
        "off",
        "-o",
        str(out_file),
    ]
    for ex in excludes:
        cmd.extend(["--exclude", ex])
    cmd.append(str(target))
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
    max_findings = int(os.getenv("SEMGREP_MAX_FINDINGS", "200"))
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
    from email_service import send_security_alert
    from gate_eval import evaluate_gate
    from models import SecurityGate

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

    # Evaluar Security Gate con hallazgos abiertos del repo (incluye este escaneo)
    gate = db.get(SecurityGate, "default-policy")
    if not gate:
        gate = SecurityGate(id="default-policy")
        db.add(gate)
        db.flush()

    _set_progress(db, scan, "gate", "Evaluando Security Gate…")
    ev = evaluate_gate(db, gate, repository_id=repo.id)
    scan.gate_status = ev.decision if ev.decision != "DISABLED" else "SKIPPED"
    scan.gate_detail = ev.summary()[:2000]
    _append_audit(
        db,
        "security-gate",
        "GATE_PASSED" if ev.allowed else "GATE_BLOCK",
        repo.name,
        scan.gate_detail,
    )

    # Alerta email: gate bloqueado o secretos con política estricta
    should_alert = (not ev.allowed) or (bool(gate.block_on_secrets) and ev.open_secrets > 0 and not ev.allowed)
    if should_alert:
        try:
            sent = send_security_alert(
                repo_name=repo.name,
                decision=ev.decision,
                summary=ev.summary(),
                reasons=list(ev.reasons),
                open_secrets=ev.open_secrets,
            )
            if sent:
                _append_audit(
                    db,
                    "mailer",
                    "SECURITY_ALERT_SENT",
                    repo.name,
                    f"{sent} correo(s) · {ev.decision}",
                )
        except Exception as exc:
            print(f"[sspillowy] security alert email failed: {exc}")

    scan.progress_stage = "done"
    scan.progress_detail = scan.gate_detail


def _set_progress(db, scan: Scan, stage: str, detail: str = "") -> None:
    """Persiste etapa visible para polling de la consola."""
    try:
        scan.progress_stage = stage
        scan.progress_detail = (detail or "")[:500] or None
        db.commit()
    except Exception as exc:
        print(f"[sspillowy] progress update failed ({stage}): {exc}")
        try:
            db.rollback()
        except Exception:
            pass


def run_semgrep_scan_job(
    scan_id: str, engines: list[str] | None = None, target_url: str | None = None
) -> None:
    """Alias histórico → job multi-motor."""
    run_repo_scan_job(scan_id, engines, target_url)


def run_repo_scan_job(
    scan_id: str, engines: list[str] | None = None, target_url: str | None = None
) -> None:
    """Job en background: clone (o fixture) → motores SAST/SCA + DAST ZAP → Postgres."""
    from gitleaks_scan import gitleaks_available, persist_gitleaks_findings, run_gitleaks
    from trivy_scan import persist_trivy_findings, run_trivy_fs, trivy_available
    from zap_scan import persist_zap_findings, run_zap_scan

    wanted = {e.lower().strip() for e in (engines or ["semgrep", "gitleaks", "trivy"])}
    wanted &= {"semgrep", "gitleaks", "trivy", "owasp_zap"}
    if not wanted:
        wanted = {"semgrep", "gitleaks", "trivy"}

    needs_clone = bool(wanted & {"semgrep", "gitleaks", "trivy"})

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

        source_note = ""
        target: Path | None = None

        if needs_clone:
            work_parent = Path(tempfile.mkdtemp(prefix="sspillowy-scan-"))
            clone_dir = work_parent / "repo"
            # Por defecto NO usar fixture en prod: inventa hallazgos y rompe el Security Gate.
            fallback_ok = _env_true("SEMGREP_FALLBACK_FIXTURE", "false") or _env_true(
                "SCAN_FALLBACK_FIXTURE", "false"
            )
            _set_progress(db, scan, "cloning", f"Clonando {repo.url}…")
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
                    scan.progress_stage = "failed"
                    scan.progress_detail = f"Clone falló: {str(clone_exc)[:400]}"
                    _append_audit(
                        db,
                        "scan-worker",
                        "SCAN_FAILED",
                        repo.name,
                        f"Clone falló: {str(clone_exc)[:400]}",
                    )
                    db.commit()
                    return
        else:
            source_note = "dast-only (sin clone)"

        engine_notes: list[str] = []
        count_parts: list[dict[str, int]] = []
        errors: list[str] = []
        engines_ok: list[str] = []

        if "semgrep" in wanted and target is not None:
            _set_progress(db, scan, "semgrep", "Ejecutando Semgrep…")
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

        if "gitleaks" in wanted and target is not None:
            _set_progress(db, scan, "gitleaks", "Ejecutando GitLeaks…")
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

        if "trivy" in wanted and target is not None:
            _set_progress(db, scan, "trivy", "Ejecutando Trivy…")
            if trivy_available():
                try:
                    tv_packages: list[dict] = []
                    tv_results = run_trivy_fs(target, packages_out=tv_packages)
                    tv_counts = persist_trivy_findings(
                        db, scan=scan, repo=repo, results=tv_results, scan_root=target
                    )
                    try:
                        from sbom import persist_sbom

                        n_pkgs = persist_sbom(
                            db, scan=scan, repo=repo, packages=tv_packages, scan_root=target
                        )
                        engine_notes.append(f"SBOM {n_pkgs} paquetes")
                    except Exception as exc:
                        _append_audit(db, "scan-worker", "SBOM_FAILED", repo.name, str(exc)[:400])
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

        if "owasp_zap" in wanted:
            dast = (
                (target_url or "").strip()
                or (getattr(repo, "dast_url", None) or "").strip()
                or os.getenv("ZAP_DEFAULT_TARGET", "https://sspillowy.com").strip()
            )
            _set_progress(db, scan, "owasp_zap", f"DAST ZAP → {dast}")
            try:
                zap_results = run_zap_scan(dast)
                zap_counts = persist_zap_findings(
                    db, scan=scan, repo=repo, results=zap_results
                )
                count_parts.append(zap_counts)
                engine_notes.append(f"ZAP {sum(zap_counts.values())}@{dast}")
                engines_ok.append("owasp_zap")
                if not source_note or source_note.startswith("dast"):
                    source_note = f"DAST {dast}"
            except Exception as exc:
                errors.append(f"owasp_zap: {exc}")
                _append_audit(
                    db,
                    "scan-worker",
                    "ENGINE_FAILED",
                    repo.name,
                    f"OWASP ZAP: {str(exc)[:400]}",
                )

        if not count_parts:
            scan.status = "FAILED"
            scan.completed_at = _now()
            scan.progress_stage = "failed"
            scan.progress_detail = f"Ningún motor produjo resultados. {'; '.join(errors)[:400]}"
            _append_audit(
                db,
                "scan-worker",
                "SCAN_FAILED",
                repo.name,
                f"Ningún motor produjo resultados. {'; '.join(errors)[:400]}",
            )
            db.commit()
            return

        scan.engines_ok = ",".join(engines_ok)
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

        try:
            from fix_intel import carry_forward_triage

            carry_forward_triage(db, repo_id=repo.id, scan_id=scan.id)
        except Exception as exc:
            _append_audit(db, "scan-worker", "TRIAGE_CARRY_FAILED", repo.name, str(exc)[:400])

        if "gitleaks" in engines_ok:
            try:
                from secret_management import sync_secret_incidents

                sync_secret_incidents(db, repo.id)
            except Exception as exc:
                _append_audit(db, "scan-worker", "SECRET_SYNC_FAILED", repo.name, str(exc)[:400])

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
                scan.progress_stage = "failed"
                scan.progress_detail = str(exc)[:400]
                _append_audit(db, "scan-worker", "SCAN_FAILED", scan_id, str(exc)[:400])
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()
        if work_parent and work_parent.exists():
            shutil.rmtree(work_parent, ignore_errors=True)
