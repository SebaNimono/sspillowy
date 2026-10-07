"""Estado de los controles ISO/IEC 27001:2022 calculado con los datos reales de la plataforma."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from models import AuditEvent, Finding, GateBypassRequest, Repository, Scan, SecurityGate

OPEN = ("OPEN", "IN_REVIEW")
ENGINE_NAME = {"semgrep": "Semgrep", "trivy": "Trivy", "gitleaks": "Gitleaks", "owasp_zap": "OWASP ZAP"}

ENGINE_CONTROLS = [
    ("A.8.8", "Gestión de vulnerabilidades técnicas", "trivy"),
    ("A.8.9", "Gestión de configuración", "owasp_zap"),
    ("A.8.28", "Codificación segura", "semgrep"),
    ("A.8.5", "Autenticación segura", "gitleaks"),
    ("A.8.3", "Protección de la información", "gitleaks"),
]


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _n(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def current_period(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    return f"{now.year}-Q{(now.month - 1) // 3 + 1}"


def iso_controls(db, repo_ids: list[str] | None = None, now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(timezone.utc)
    recent = now - timedelta(days=90)
    month = now - timedelta(days=30)

    repo_q = db.query(Repository).filter(Repository.is_active.is_(True))
    if repo_ids:
        repo_q = repo_q.filter(Repository.id.in_(repo_ids))
    repos = repo_q.all()
    ids = [r.id for r in repos]

    open_q = db.query(Finding.engine, Finding.severity, Finding.iso_control).filter(Finding.status.in_(OPEN))
    scan_q = db.query(Scan).filter(Scan.status == "COMPLETED", Scan.created_at >= recent)
    if repo_ids:
        open_q = open_q.filter(Finding.repository_id.in_(ids or ["__none__"]))
        scan_q = scan_q.filter(Scan.repository_id.in_(ids or ["__none__"]))
    open_items = open_q.all()
    scans = scan_q.all()

    engines_ran: set[str] = set()
    for s in scans:
        if s.engines_ok:
            engines_ran.update(e.strip() for e in s.engines_ok.split(",") if e.strip())
    if scans:
        found = db.query(Finding.engine).filter(Finding.scan_id.in_([s.id for s in scans])).distinct().all()
        engines_ran.update((e or "").lower() for (e,) in found)

    controls: list[dict] = []
    for code, title, engine in ENGINE_CONTROLS:
        items = [f for f in open_items if (f.iso_control or "").split(" ")[0] == code]
        severe = sum(1 for f in items if (f.severity or "").upper() in ("CRITICAL", "HIGH"))
        if severe:
            status, reason = "GAP", f"{_n(severe, 'hallazgo crítico o alto abierto', 'hallazgos críticos o altos abiertos')}."
        elif items:
            status, reason = "PARTIAL", f"{_n(len(items), 'hallazgo de severidad media o baja abierto', 'hallazgos de severidad media o baja abiertos')}."
        elif engine not in engines_ran:
            status, reason = "PARTIAL", f"Sin análisis de {ENGINE_NAME[engine]} en los últimos 90 días: falta evidencia del periodo."
        else:
            status, reason = "COMPLIANT", "Sin hallazgos abiertos en los análisis recientes."
        controls.append(
            {"code": code, "title": title, "status": status, "related_engine": engine, "open_findings": len(items), "reason": reason}
        )

    scanned = {s.repository_id for s in scans if _aware(s.created_at) >= month}
    total = len(repos)
    covered = sum(1 for r in repos if r.id in scanned)
    if total and covered == total:
        sdlc = ("COMPLIANT", f"Los {total} repositorios se analizaron en los últimos 30 días.")
    elif covered:
        sdlc = ("PARTIAL", f"{covered} de {total} repositorios analizados en los últimos 30 días.")
    else:
        sdlc = ("GAP", "Ningún repositorio se analizó en los últimos 30 días.")
    controls.append({"code": "A.8.25", "title": "Seguridad en el ciclo de desarrollo", "status": sdlc[0], "related_engine": None, "open_findings": 0, "reason": sdlc[1]})

    gate = db.query(SecurityGate).first()
    gate_on = gate is None or bool(gate.enabled)
    if gate_on:
        limits = f"máximo {gate.max_critical_allowed} críticos y {gate.max_high_allowed} altos" if gate else "valores por defecto"
        req = ("COMPLIANT", f"Política del Security Gate activa ({limits}).")
    else:
        req = ("GAP", "El Security Gate está desactivado: no hay requisitos de seguridad exigidos.")
    controls.append({"code": "A.8.26", "title": "Requisitos de seguridad de las aplicaciones", "status": req[0], "related_engine": None, "open_findings": 0, "reason": req[1]})

    evaluated = sum(1 for s in scans if _aware(s.created_at) >= month and s.gate_status in ("PASSED", "BLOCKED", "BYPASSED"))
    bypass_q = db.query(GateBypassRequest).filter(GateBypassRequest.created_at >= month, GateBypassRequest.status.in_(["APPROVED", "EXPIRED"]))
    bypasses = [b for b in bypass_q.all() if not repo_ids or b.repository_id is None or b.repository_id in ids]
    if not gate_on:
        change = ("GAP", "Los cambios no pasan por el Security Gate.")
    elif evaluated:
        change = (
            "COMPLIANT",
            f"{_n(evaluated, 'cambio evaluado', 'cambios evaluados')} por el gate en 30 días; "
            f"{_n(len(bypasses), 'excepción aprobada y registrada', 'excepciones aprobadas y registradas')}.",
        )
    else:
        change = ("PARTIAL", "El gate no evaluó cambios en los últimos 30 días.")
    controls.append({"code": "A.8.32", "title": "Gestión del cambio", "status": change[0], "related_engine": None, "open_findings": 0, "reason": change[1]})

    events = db.query(AuditEvent).filter(AuditEvent.created_at >= recent).count()
    logs = ("COMPLIANT", f"{_n(events, 'acción registrada', 'acciones registradas')} en la bitácora en 90 días.") if events else ("PARTIAL", "Sin acciones registradas en la bitácora en 90 días.")
    controls.append({"code": "A.5.33", "title": "Protección de registros / evidencia", "status": logs[0], "related_engine": None, "open_findings": 0, "reason": logs[1]})
    return controls
