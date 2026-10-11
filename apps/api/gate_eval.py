"""Evaluación real del Security Gate contra hallazgos abiertos."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import func

from models import Finding, SecurityGate


OPEN_STATUSES = ("OPEN", "IN_REVIEW")


@dataclass
class GateEvaluation:
    decision: str  # PASSED | BLOCKED | DISABLED | BYPASSED
    allowed: bool
    reasons: list[str] = field(default_factory=list)
    open_critical: int = 0
    open_high: int = 0
    open_secrets: int = 0
    max_critical_allowed: int = 0
    max_high_allowed: int = 0
    block_on_secrets: bool = True
    require_ciso_approval_for_bypass: bool = True
    policy_name: str = ""
    repository_id: str | None = None
    bypass_id: str | None = None

    def summary(self) -> str:
        if self.decision == "DISABLED":
            return "Gate deshabilitado · se permite continuar."
        if self.decision == "BYPASSED":
            return "BYPASSED · excepción activa · " + "; ".join(self.reasons[:2])
        if self.allowed:
            return (
                f"PASSED · crit={self.open_critical}/{self.max_critical_allowed} · "
                f"high={self.open_high}/{self.max_high_allowed} · secrets={self.open_secrets}"
            )
        return "BLOCKED · " + "; ".join(self.reasons)


def gate_for(db, workspace_id: str | None) -> SecurityGate:
    """Política del espacio (una por espacio, con el id del espacio)."""
    gate_id = workspace_id or "default-policy"
    gate = db.get(SecurityGate, gate_id)
    if gate:
        return gate
    gate = SecurityGate(id=gate_id)
    db.add(gate)
    db.commit()
    db.refresh(gate)
    return gate


def _count_open(
    db,
    *,
    severity: str | None = None,
    engine: str | None = None,
    repository_id: str | None = None,
    repo_ids: list[str] | None = None,
) -> int:
    q = db.query(func.count(Finding.id)).filter(Finding.status.in_(OPEN_STATUSES))
    if repository_id:
        q = q.filter(Finding.repository_id == repository_id)
    elif repo_ids is not None:
        q = q.filter(Finding.repository_id.in_(repo_ids or ["__none__"]))
    if severity:
        q = q.filter(func.upper(Finding.severity) == severity.upper())
    if engine:
        q = q.filter(func.lower(Finding.engine) == engine.lower())
    return int(q.scalar() or 0)


def open_counts_by_repo(db, repo_ids: list[str]) -> dict[str, dict[str, int]]:
    """{repo_id: {critical, high, secrets}} con una sola consulta agrupada."""
    out: dict[str, dict[str, int]] = {rid: {"critical": 0, "high": 0, "secrets": 0} for rid in repo_ids}
    if not repo_ids:
        return out
    rows = (
        db.query(Finding.repository_id, func.upper(Finding.severity), func.lower(Finding.engine), func.count(Finding.id))
        .filter(Finding.status.in_(OPEN_STATUSES), Finding.repository_id.in_(repo_ids))
        .group_by(Finding.repository_id, func.upper(Finding.severity), func.lower(Finding.engine))
        .all()
    )
    for rid, sev, engine, n in rows:
        c = out.setdefault(rid, {"critical": 0, "high": 0, "secrets": 0})
        if sev == "CRITICAL":
            c["critical"] += n
        elif sev == "HIGH":
            c["high"] += n
        if engine == "gitleaks":
            c["secrets"] += n
    return out


def repo_decision(gate: SecurityGate, counts: dict[str, int], bypassed: bool) -> str:
    if not gate.enabled:
        return "DISABLED"
    blocked = (
        counts["critical"] > int(gate.max_critical_allowed or 0)
        or counts["high"] > int(gate.max_high_allowed or 0)
        or (bool(gate.block_on_secrets) and counts["secrets"] > 0)
    )
    if not blocked:
        return "PASSED"
    return "BYPASSED" if bypassed else "BLOCKED"


def evaluate_gate(
    db,
    gate: SecurityGate,
    *,
    repository_id: str | None = None,
    repo_ids: list[str] | None = None,
    workspace_id: str | None = None,
) -> GateEvaluation:
    """Evalúa la política sobre hallazgos OPEN/IN_REVIEW de un repo o de los repos del espacio (repo_ids)."""
    max_c = int(gate.max_critical_allowed or 0)
    max_h = int(gate.max_high_allowed or 0)
    block_secrets = bool(gate.block_on_secrets)
    ciso = bool(gate.require_ciso_approval_for_bypass)

    # Conteos SQL (rápido) — no cargar todos los hallazgos a memoria
    scope = {"repository_id": repository_id, "repo_ids": repo_ids}
    open_critical = _count_open(db, severity="CRITICAL", **scope)
    open_high = _count_open(db, severity="HIGH", **scope)
    open_secrets = _count_open(db, engine="gitleaks", **scope)

    result = GateEvaluation(
        decision="DISABLED",
        allowed=True,
        open_critical=open_critical,
        open_high=open_high,
        open_secrets=open_secrets,
        max_critical_allowed=max_c,
        max_high_allowed=max_h,
        block_on_secrets=block_secrets,
        require_ciso_approval_for_bypass=ciso,
        policy_name=gate.name or "Default Organization Security Gate",
        repository_id=repository_id,
    )

    if not gate.enabled:
        result.reasons = ["El gate está apagado: no se bloquea ningún despliegue."]
        return result

    reasons: list[str] = []
    if open_critical > max_c:
        reasons.append(f"Hay {open_critical} vulnerabilidades críticas abiertas y el máximo permitido es {max_c}.")
    if open_high > max_h:
        reasons.append(f"Hay {open_high} vulnerabilidades altas abiertas y el máximo permitido es {max_h}.")
    if block_secrets and open_secrets > 0:
        reasons.append(f"Hay {open_secrets} secretos expuestos sin resolver.")

    if reasons:
        # ¿Hay bypass CISO aprobado y vigente?
        try:
            from gate_bypass import find_active_bypass

            active = find_active_bypass(db, repository_id, workspace_id or gate.id)
        except Exception:
            active = None

        if active:
            exp = active.expires_at.isoformat() if active.expires_at else "sin fecha"
            result.decision = "BYPASSED"
            result.allowed = True
            result.bypass_id = active.id
            result.reasons = [
                f"Excepción activa hasta {exp}",
                f"Solicitado por {active.requested_by}",
                f"Motivo: {active.reason[:240]}",
                *reasons,
            ]
            return result

        result.decision = "BLOCKED"
        result.allowed = False
        result.reasons = reasons
        result.reasons.append(
            "Para continuar: corrige los hallazgos o pide una excepción temporal en Security Gates."
        )
    else:
        result.decision = "PASSED"
        result.allowed = True
        result.reasons = ["Todo está dentro de las reglas del gate."]

    return result
