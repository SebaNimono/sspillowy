"""Trivy filesystem scan: vulnerabilidades SCA / misconfig / secretos en el árbol."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

from models import Finding
from semgrep_scan import relative_file_path


def _now() -> datetime:
    return datetime.now(timezone.utc)


def trivy_available() -> bool:
    return shutil.which("trivy") is not None


def _map_severity(raw: str | None) -> str:
    s = (raw or "UNKNOWN").strip().upper()
    mapping = {
        "CRITICAL": "CRITICAL",
        "HIGH": "HIGH",
        "MEDIUM": "MEDIUM",
        "LOW": "LOW",
        "UNKNOWN": "INFO",
        "INFO": "INFO",
    }
    return mapping.get(s, "MEDIUM")


def run_trivy_fs(target: Path, timeout: int = 300) -> list[dict]:
    """
    Devuelve lista plana de hallazgos normalizados:
    {kind, severity, title, description, file_path, cwe, vuln_id}
    """
    if not trivy_available():
        raise RuntimeError("trivy no está instalado en el contenedor.")

    out_file = target / "trivy-report.json"
    if out_file.exists():
        out_file.unlink()

    # Cache en /tmp para no llenar el FS de la app
    cache_dir = os.getenv("TRIVY_CACHE_DIR", "/tmp/trivy-cache")
    cmd = [
        "trivy",
        "fs",
        "--format",
        "json",
        "--output",
        str(out_file),
        "--scanners",
        os.getenv("TRIVY_SCANNERS", "vuln,misconfig,secret"),
        "--quiet",
        "--cache-dir",
        cache_dir,
        str(target),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env={**os.environ, "TRIVY_CACHE_DIR": cache_dir})
    # Trivy: 0 ok, 1 hallazgos con --exit-code (default 0 siempre si no se setea)
    if proc.returncode not in (0, 1) and not out_file.exists():
        err = (proc.stderr or proc.stdout or "trivy error").strip()[:500]
        raise RuntimeError(f"trivy falló (code={proc.returncode}): {err}")

    if not out_file.exists():
        return []

    raw = out_file.read_text(encoding="utf-8", errors="replace").strip()
    if not raw:
        return []
    data = json.loads(raw)
    results = data.get("Results") or []
    flat: list[dict] = []

    for block in results:
        target_name = block.get("Target") or ""
        for vuln in block.get("Vulnerabilities") or []:
            vid = vuln.get("VulnerabilityID") or "CVE"
            pkg = vuln.get("PkgName") or ""
            title = vuln.get("Title") or f"{vid} in {pkg}".strip()
            desc = (vuln.get("Description") or title).strip()
            installed = vuln.get("InstalledVersion") or ""
            fixed = vuln.get("FixedVersion") or ""
            detail = f"{desc}\nPaquete: {pkg}@{installed}"
            if fixed:
                detail += f" → fix {fixed}"
            cwe = None
            for ref in vuln.get("CweIDs") or []:
                cwe = str(ref)[:80]
                break
            flat.append(
                {
                    "kind": "vuln",
                    "severity": _map_severity(vuln.get("Severity")),
                    "title": f"{vid}: {title}"[:200],
                    "description": detail[:2000],
                    "file_path": target_name,
                    "cwe": cwe,
                    "line_number": None,
                }
            )

        for mis in block.get("Misconfigurations") or []:
            mid = mis.get("ID") or mis.get("AVDID") or "misconfig"
            title = mis.get("Title") or mid
            msg = (mis.get("Message") or mis.get("Description") or title).strip()
            flat.append(
                {
                    "kind": "misconfig",
                    "severity": _map_severity(mis.get("Severity")),
                    "title": f"{mid}: {title}"[:200],
                    "description": msg[:2000],
                    "file_path": target_name or (mis.get("CauseMetadata") or {}).get("Resource"),
                    "cwe": None,
                    "line_number": (mis.get("CauseMetadata") or {}).get("StartLine"),
                }
            )

        for secret in block.get("Secrets") or []:
            sid = secret.get("RuleID") or "secret"
            title = secret.get("Title") or sid
            flat.append(
                {
                    "kind": "secret",
                    "severity": _map_severity(secret.get("Severity") or "HIGH"),
                    "title": f"{sid}: {title}"[:200],
                    "description": (secret.get("Category") or title)[:2000],
                    "file_path": target_name,
                    "cwe": "CWE-798",
                    "line_number": secret.get("StartLine"),
                }
            )

    return flat


def persist_trivy_findings(
    db,
    *,
    scan,
    repo,
    results: list[dict],
    scan_root: Path | None = None,
) -> dict[str, int]:
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    max_findings = int(os.getenv("TRIVY_MAX_FINDINGS", "40"))

    for item in results[:max_findings]:
        severity = _map_severity(item.get("severity"))
        counts[severity] = counts.get(severity, 0) + 1
        path = relative_file_path(item.get("file_path") or "", scan_root) or item.get("file_path")
        line = item.get("line_number")
        db.add(
            Finding(
                id=str(uuid.uuid4()),
                repository_id=repo.id,
                scan_id=scan.id,
                title=(item.get("title") or "trivy finding")[:200],
                description=(item.get("description") or "")[:2000],
                engine="trivy",
                severity=severity,
                file_path=(str(path)[:500] if path else None),
                line_number=int(line) if line else None,
                cwe=item.get("cwe"),
                owasp_category=None,
                iso_control="A.8.8 — Gestión de vulnerabilidades técnicas",
                status="OPEN",
                ai_triaged=False,
                ai_confidence=None,
                ai_summary=None,
                ai_remediation=None,
                created_at=_now(),
            )
        )

    return counts
