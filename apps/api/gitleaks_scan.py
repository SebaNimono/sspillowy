"""GitLeaks: detección de secretos en el árbol del repo (filesystem)."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from models import Finding
from semgrep_scan import relative_file_path

# Reglas típicas → severidad SSPILLOWY
_CRITICAL_RULES = {
    "aws-access-token",
    "aws-secret-key",
    "private-key",
    "pkcs8-private-key",
    "rsa-private-key",
    "ssh-private-key",
    "stripe-access-token",
    "github-pat",
    "github-fine-grained-pat",
    "gitlab-pat",
    "slack-bot-token",
    "slack-webhook-url",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def gitleaks_available() -> bool:
    return shutil.which("gitleaks") is not None


def _severity_for(rule_id: str | None) -> str:
    rid = (rule_id or "").strip().lower()
    if rid in _CRITICAL_RULES or "private-key" in rid or rid.endswith("-pat"):
        return "CRITICAL"
    if "aws" in rid or "stripe" in rid or "secret" in rid:
        return "HIGH"
    return "HIGH"


def run_gitleaks(target: Path, timeout: int = 180) -> list[dict]:
    """Ejecuta gitleaks detect --no-git. Exit 0=limpio, 1=hallazgos, otros=error."""
    if not gitleaks_available():
        raise RuntimeError("gitleaks no está instalado en el contenedor.")

    # Fuera del árbol del repo: si no, Trivy escanea este JSON y marca falsos positivos.
    out_file = Path(tempfile.gettempdir()) / f"gitleaks-{uuid.uuid4().hex}.json"
    try:
        cmd = [
            "gitleaks",
            "detect",
            "--source",
            str(target),
            "--report-path",
            str(out_file),
            "--report-format",
            "json",
            "--no-git",
            "--no-banner",
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)

        if proc.returncode not in (0, 1):
            err = (proc.stderr or proc.stdout or "gitleaks error").strip()[:500]
            raise RuntimeError(f"gitleaks falló (code={proc.returncode}): {err}")

        if not out_file.exists():
            return []

        raw = out_file.read_text(encoding="utf-8", errors="replace").strip()
        if not raw:
            return []
        data = json.loads(raw)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "Findings" in data:
            return data.get("Findings") or []
        return []
    finally:
        try:
            out_file.unlink(missing_ok=True)
        except Exception:
            pass


def persist_gitleaks_findings(
    db,
    *,
    scan,
    repo,
    results: list[dict],
    scan_root: Path | None = None,
) -> dict[str, int]:
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    max_findings = int(os.getenv("GITLEAKS_MAX_FINDINGS", "40"))

    for item in results[:max_findings]:
        rule_id = item.get("RuleID") or item.get("Rule") or "gitleaks.secret"
        severity = _severity_for(str(rule_id))
        counts[severity] = counts.get(severity, 0) + 1
        desc = (item.get("Description") or "Posible secreto en código").strip()
        file_raw = item.get("File") or item.get("Path") or ""
        path = relative_file_path(file_raw, scan_root) or file_raw
        line = item.get("StartLine") or item.get("Line")
        # No persistir el secreto en claro: solo un preview enmascarado
        match = str(item.get("Match") or item.get("Secret") or "")
        preview = (match[:4] + "…" + match[-4:]) if len(match) > 10 else "(redacted)"
        title = f"{rule_id}: {desc}"[:200]
        description = (
            f"{desc}\nArchivo: {path or 'n/a'}\nMatch (redactado): {preview}\n"
            "Remediación: rotar el secreto, quitarlo del historial y usar un secret manager / CI secrets."
        )[:2000]

        db.add(
            Finding(
                id=str(uuid.uuid4()),
                repository_id=repo.id,
                scan_id=scan.id,
                title=title,
                description=description,
                engine="gitleaks",
                severity=severity,
                file_path=(path[:500] if path else None),
                line_number=int(line) if line else None,
                cwe="CWE-798",
                owasp_category=None,
                iso_control="A.8.3 — Protección de la información",
                status="OPEN",
                ai_triaged=False,
                ai_confidence=None,
                ai_summary=None,
                ai_remediation=None,
                created_at=_now(),
            )
        )

    return counts
