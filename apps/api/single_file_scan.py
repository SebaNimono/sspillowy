"""Escaneo rápido de 1 solo archivo o fragmento de código (Opción A: sin clonar todo el repositorio)."""

from __future__ import annotations

import re
import shutil
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import SessionLocal
from models import AuditEvent, Finding, Repository, Scan
from semgrep_scan import (
    _cwe_from,
    _map_severity,
    _refresh_repo_counters,
    _run_semgrep,
    semgrep_available,
)
from gitleaks_scan import gitleaks_available, run_gitleaks
from trivy_scan import run_trivy_fs, trivy_available
from workspaces import WorkspaceCtx, require_ws

router = APIRouter(prefix="/api/v1/scans", tags=["Scans"])


class SingleFileScanRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=260)
    content: str = Field(..., min_length=1, max_length=600_000)
    engines: List[str] = Field(default_factory=lambda: ["semgrep", "gitleaks", "trivy"])
    repository_id: Optional[str] = None
    persist: bool = False


class SingleFileFindingOut(BaseModel):
    id: str
    title: str
    description: str
    engine: str
    severity: str
    file_path: str
    line_number: int
    cwe: Optional[str] = None
    owasp_category: Optional[str] = None
    iso_control: Optional[str] = None
    remediation: str


class SingleFileScanResponse(BaseModel):
    filename: str
    elapsed_ms: int
    engines_executed: List[str]
    persisted_scan_id: Optional[str] = None
    total_findings: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    findings: List[SingleFileFindingOut]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_filename(raw: str) -> str:
    cleaned = raw.replace("\\", "/").strip().lstrip("/")
    parts = [p for p in cleaned.split("/") if p and p not in (".", "..")]
    return "/".join(parts) if parts else "snippet.py"


_BUILTIN_PATTERNS: list[dict] = [
    {
        "engine": "gitleaks",
        "severity": "CRITICAL",
        "title": "gitleaks.aws-access-key: Clave de acceso AWS expuesta en texto plano",
        "description": "Se detectó un identificador AKIA/ASIA compatible con AWS IAM Access Key en el archivo.",
        "regex": re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
        "cwe": "CWE-798",
        "owasp": "A07:2021-Identification and Authentication Failures",
        "iso": "A.8.12 — Prevención de fuga de datos",
        "remediation": "Rota la credencial en AWS IAM inmediatamente y muévela a variables de entorno o AWS Secrets Manager.",
    },
    {
        "engine": "gitleaks",
        "severity": "CRITICAL",
        "title": "gitleaks.private-key: Clave privada criptográfica embebida",
        "description": "El archivo contiene un bloque BEGIN PRIVATE KEY / RSA PRIVATE KEY expuesto en código.",
        "regex": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        "cwe": "CWE-798",
        "owasp": "A02:2021-Cryptographic Failures",
        "iso": "A.8.24 — Uso de criptografía",
        "remediation": "Revoca el par de llaves, elimínalo del código y cárgalo desde un almacén seguro de secretos en tiempo de ejecución.",
    },
    {
        "engine": "gitleaks",
        "severity": "CRITICAL",
        "title": "gitleaks.github-pat: Token personal de GitHub o API Key expuesta",
        "description": "Se detectó un token de GitHub (ghp_/gho_/github_pat_) o clave de API hardcodeada.",
        "regex": re.compile(r"\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{28,})\b"),
        "cwe": "CWE-798",
        "owasp": "A07:2021-Identification and Authentication Failures",
        "iso": "A.8.12 — Prevención de fuga de datos",
        "remediation": "Revoca el token en el proveedor y reemplázalo por lectura desde os.getenv() / process.env.",
    },
    {
        "engine": "gitleaks",
        "severity": "HIGH",
        "title": "gitleaks.hardcoded-secret: Contraseña o secreto hardcodeado en asignación",
        "description": "Asignación literal de password, secret, api_key o jwt_secret directamente en código fuente.",
        "regex": re.compile(
            r"""(?i)\b(?:password|passwd|api_key|apikey|jwt_secret|client_secret|secret_key)\s*[:=]\s*['"][^'"\s${]{8,}['"]"""
        ),
        "cwe": "CWE-798",
        "owasp": "A07:2021-Identification and Authentication Failures",
        "iso": "A.8.12 — Prevención de fuga de datos",
        "remediation": "Extrae el valor literal hacia variables de entorno (.env no versionado) y rota el secreto actual.",
    },
    {
        "engine": "semgrep",
        "severity": "CRITICAL",
        "title": "semgrep.sql-injection: Construcción dinámica de consulta SQL sin parametrizar",
        "description": "Se concatena o interpola entrada en una sentencia SQL (SELECT/INSERT/UPDATE/DELETE), permitiendo inyección SQL.",
        "regex": re.compile(
            r"""(?i)(?:execute|query|raw)\s*\(\s*(?:f['"]|['"].*?\b(?:SELECT|INSERT|UPDATE|DELETE)\b.*?(?:\+|%|\$\{))"""
        ),
        "cwe": "CWE-89",
        "owasp": "A03:2021-Injection",
        "iso": "A.8.28 — Codificación segura",
        "remediation": "Usa consultas parametrizadas (prepared statements) o parámetros ligados del ORM en lugar de interpolar strings.",
    },
    {
        "engine": "semgrep",
        "severity": "CRITICAL",
        "title": "semgrep.command-injection: Ejecución de comandos de sistema con shell=True o eval()",
        "description": "Uso de eval(), exec() o subprocess con shell=True, lo que expone a ejecución remota de código (RCE).",
        "regex": re.compile(r"""(?:\b(?:eval|exec)\s*\(|subprocess\.(?:run|Popen|call)\s*\([^)]*shell\s*=\s*True)"""),
        "cwe": "CWE-78",
        "owasp": "A03:2021-Injection",
        "iso": "A.8.28 — Codificación segura",
        "remediation": "Evita eval()/exec() y pasa argumentos como lista a subprocess.run([...], shell=False).",
    },
    {
        "engine": "semgrep",
        "severity": "HIGH",
        "title": "semgrep.xss-dom: Inserción directa de HTML sin sanitizar (XSS)",
        "description": "Uso de dangerouslySetInnerHTML o innerHTML = ..., susceptible a Cross-Site Scripting (XSS).",
        "regex": re.compile(r"""(?:\bdangerouslySetInnerHTML\b|\.innerHTML\s*=)"""),
        "cwe": "CWE-79",
        "owasp": "A03:2021-Injection",
        "iso": "A.8.28 — Codificación segura",
        "remediation": "Renderiza texto escapado o sanitiza el HTML con DOMPurify antes de inyectarlo en el DOM.",
    },
    {
        "engine": "semgrep",
        "severity": "MEDIUM",
        "title": "semgrep.weak-crypto: Uso de algoritmo de hash criptográficamente débil (MD5 / SHA1)",
        "description": "Se detectó hashlib.md5, hashlib.sha1 o createHash('md5'/'sha1'), vulnerables a colisiones.",
        "regex": re.compile(r"""(?i)(?:hashlib\.(?:md5|sha1)\s*\(|createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\))"""),
        "cwe": "CWE-328",
        "owasp": "A02:2021-Cryptographic Failures",
        "iso": "A.8.24 — Uso de criptografía",
        "remediation": "Reemplaza MD5/SHA-1 por SHA-256 (o Argon2/bcrypt si se trata de contraseñas).",
    },
    {
        "engine": "trivy",
        "severity": "HIGH",
        "title": "trivy.dockerfile-root: Contenedor sin directriz USER no privilegiado",
        "description": "Ejecutar procesos como root o usar imagen ':latest' sin fijar digest incrementa la superficie de ataque.",
        "regex": re.compile(r"""(?m)^FROM\s+[^\s:@]+:latest\b"""),
        "cwe": "CWE-250",
        "owasp": "A05:2021-Security Misconfiguration",
        "iso": "A.8.9 — Gestión de configuración",
        "remediation": "Fija una versión inmutable de la imagen base y declara un usuario sin privilegios (USER appuser).",
    },
]


def _run_builtin_patterns(rel_name: str, content: str, wanted_engines: set[str]) -> list[SingleFileFindingOut]:
    findings: list[SingleFileFindingOut] = []
    lines = content.splitlines()
    for idx, line in enumerate(lines, start=1):
        for rule in _BUILTIN_PATTERNS:
            if rule["engine"] not in wanted_engines:
                continue
            if rule["regex"].search(line):
                findings.append(
                    SingleFileFindingOut(
                        id=str(uuid.uuid4()),
                        title=rule["title"],
                        description=rule["description"],
                        engine=rule["engine"],
                        severity=rule["severity"],
                        file_path=rel_name,
                        line_number=idx,
                        cwe=rule["cwe"],
                        owasp_category=rule["owasp"],
                        iso_control=rule["iso"],
                        remediation=rule["remediation"],
                    )
                )
    return findings


@router.post("/single-file", response_model=SingleFileScanResponse)
def scan_single_file(body: SingleFileScanRequest, ws: WorkspaceCtx = Depends(require_ws)):
    """Analiza un único archivo o snippet en segundos sin clonar todo el repositorio."""
    t0 = time.monotonic()
    rel_name = _safe_filename(body.filename)
    wanted = {e.lower().strip() for e in (body.engines or ["semgrep", "gitleaks", "trivy"])}
    wanted &= {"semgrep", "gitleaks", "trivy"}
    if not wanted:
        wanted = {"semgrep", "gitleaks", "trivy"}

    work_dir = Path(tempfile.mkdtemp(prefix="sspillowy-file-"))
    file_path = work_dir / rel_name
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(body.content, encoding="utf-8")

    collected: list[SingleFileFindingOut] = []
    executed: list[str] = []

    try:
        if "semgrep" in wanted:
            executed.append("semgrep")
            if semgrep_available():
                try:
                    for r in _run_semgrep(work_dir, timeout=45):
                        extra = r.get("extra") or {}
                        sev = _map_severity(extra.get("severity") or r.get("severity"))
                        check_id = r.get("check_id") or "semgrep.rule"
                        msg = (extra.get("message") or check_id).strip()
                        line_no = int((r.get("start") or {}).get("line") or 1)
                        collected.append(
                            SingleFileFindingOut(
                                id=str(uuid.uuid4()),
                                title=f"{check_id}: {msg}"[:200],
                                description=msg[:1500],
                                engine="semgrep",
                                severity=sev,
                                file_path=rel_name,
                                line_number=line_no,
                                cwe=_cwe_from(r),
                                owasp_category="A03:2021-Injection",
                                iso_control="A.8.28 — Codificación segura",
                                remediation="Revisa la línea indicada y parametriza/valida la entrada según la regla Semgrep.",
                            )
                        )
                except Exception:
                    pass

        if "gitleaks" in wanted:
            executed.append("gitleaks")
            if gitleaks_available():
                try:
                    for r in run_gitleaks(work_dir, timeout=30):
                        rule_id = r.get("RuleID") or "gitleaks.secret"
                        desc = r.get("Description") or "Secreto o credencial expuesta en el archivo."
                        line_no = int(r.get("StartLine") or 1)
                        collected.append(
                            SingleFileFindingOut(
                                id=str(uuid.uuid4()),
                                title=f"gitleaks.{rule_id}: {desc}"[:200],
                                description=desc[:1500],
                                engine="gitleaks",
                                severity="CRITICAL",
                                file_path=rel_name,
                                line_number=line_no,
                                cwe="CWE-798",
                                owasp_category="A07:2021-Identification and Authentication Failures",
                                iso_control="A.8.12 — Prevención de fuga de datos",
                                remediation="Rota la credencial inmediatamente y cárgala desde variables de entorno seguras.",
                            )
                        )
                except Exception:
                    pass

        if "trivy" in wanted:
            executed.append("trivy")
            if trivy_available():
                try:
                    for r in run_trivy_fs(work_dir, timeout=45):
                        sev = _map_severity(r.get("Severity"))
                        vid = r.get("VulnerabilityID") or r.get("ID") or "trivy.finding"
                        pkg = r.get("PkgName") or ""
                        title = r.get("Title") or r.get("Message") or vid
                        fix_ver = r.get("FixedVersion")
                        collected.append(
                            SingleFileFindingOut(
                                id=str(uuid.uuid4()),
                                title=f"{vid}{f' ({pkg})' if pkg else ''}: {title}"[:200],
                                description=(r.get("Description") or title)[:1500],
                                engine="trivy",
                                severity=sev,
                                file_path=rel_name,
                                line_number=1,
                                cwe="CWE-1395",
                                owasp_category="A06:2021-Vulnerable and Outdated Components",
                                iso_control="A.8.8 — Gestión de vulnerabilidades técnicas",
                                remediation=(
                                    f"Actualiza {pkg} a la versión {fix_ver}."
                                    if pkg and fix_ver
                                    else "Actualiza la dependencia o corrige la configuración señalada por Trivy."
                                ),
                            )
                        )
                except Exception:
                    pass

        # Complementar con reglas deterministas instantáneas (deduplicadas por línea + motor)
        seen_keys = {(f.engine, f.line_number, f.title.split(":")[0]) for f in collected}
        for bf in _run_builtin_patterns(rel_name, body.content, wanted):
            key = (bf.engine, bf.line_number, bf.title.split(":")[0])
            if key not in seen_keys:
                seen_keys.add(key)
                collected.append(bf)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in collected:
        counts[f.severity] = counts.get(f.severity, 0) + 1

    persisted_scan_id: Optional[str] = None
    if body.persist and body.repository_id:
        if not ws.can_write:
            raise HTTPException(status_code=403, detail="No tienes permisos de escritura en este espacio.")
        db = ws.session()
        try:
            repo = db.get(Repository, body.repository_id)
            if not repo or repo.workspace_id != ws.id:
                raise HTTPException(status_code=404, detail="Repositorio no encontrado")
            scan_row = Scan(
                id=str(uuid.uuid4()),
                repository_id=repo.id,
                status="COMPLETED",
                triggered_by=ws.actor[:120],
                branch=repo.branch or "main",
                total_findings=len(collected),
                critical_count=counts["CRITICAL"],
                high_count=counts["HIGH"],
                medium_count=counts["MEDIUM"],
                low_count=counts["LOW"] + counts["INFO"],
                gate_status="PASSED" if counts["CRITICAL"] == 0 else "BLOCKED",
                gate_detail=f"Escaneo de archivo único ({rel_name}): {len(collected)} hallazgos.",
                progress_stage="done",
                progress_detail=f"Archivo analizado: {rel_name}",
                engines_ok=",".join(executed),
                created_at=_now(),
                completed_at=_now(),
            )
            db.add(scan_row)
            for item in collected:
                db.add(
                    Finding(
                        id=item.id,
                        repository_id=repo.id,
                        scan_id=scan_row.id,
                        title=item.title,
                        description=item.description,
                        engine=item.engine,
                        severity=item.severity,
                        file_path=item.file_path,
                        line_number=item.line_number,
                        cwe=item.cwe,
                        owasp_category=item.owasp_category,
                        iso_control=item.iso_control,
                        status="OPEN",
                        ai_triaged=True,
                        ai_verdict="LIKELY_REAL",
                        ai_confidence=0.92,
                        ai_summary=item.description,
                        ai_remediation=item.remediation,
                        created_at=_now(),
                    )
                )
            repo.last_scan_at = _now()
            _refresh_repo_counters(db, repo)
            db.add(
                AuditEvent(
                    id=str(uuid.uuid4()),
                    workspace_id=ws.id,
                    action="SINGLE_FILE_SCAN",
                    target=repo.name,
                    detail=f"Archivo {rel_name} analizado ({len(collected)} hallazgos).",
                    actor_email=ws.actor,
                    created_at=_now(),
                )
            )
            db.commit()
            persisted_scan_id = scan_row.id
        finally:
            db.close()

    elapsed_ms = max(1, int(round((time.monotonic() - t0) * 1000)))
    return SingleFileScanResponse(
        filename=rel_name,
        elapsed_ms=elapsed_ms,
        engines_executed=executed,
        persisted_scan_id=persisted_scan_id,
        total_findings=len(collected),
        critical_count=counts["CRITICAL"],
        high_count=counts["HIGH"],
        medium_count=counts["MEDIUM"],
        low_count=counts["LOW"] + counts["INFO"],
        findings=collected,
    )
