"""Evaluación real del Security Gate contra hallazgos abiertos."""

from __future__ import annotations

from dataclasses import dataclass, field

from models import Finding, SecurityGate


OPEN_STATUSES = ("OPEN", "IN_REVIEW")


@dataclass
class GateEvaluation:
    decision: str  # PASSED | BLOCKED | DISABLED
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

    def summary(self) -> str:
        if self.decision == "DISABLED":
            return "Gate deshabilitado · se permite continuar."
        if self.allowed:
            return (
                f"PASSED · crit={self.open_critical}/{self.max_critical_allowed} · "
                f"high={self.open_high}/{self.max_high_allowed} · secrets={self.open_secrets}"
            )
        return "BLOCKED · " + "; ".join(self.reasons)


def evaluate_gate(
    db,
    gate: SecurityGate,
    *,
    repository_id: str | None = None,
) -> GateEvaluation:
    """Evalúa la política activa sobre hallazgos OPEN/IN_REVIEW (repo o org)."""
    q = db.query(Finding).filter(Finding.status.in_(OPEN_STATUSES))
    if repository_id:
        q = q.filter(Finding.repository_id == repository_id)

    findings = q.all()
    open_critical = sum(1 for f in findings if (f.severity or "").upper() == "CRITICAL")
    open_high = sum(1 for f in findings if (f.severity or "").upper() == "HIGH")
    open_secrets = sum(1 for f in findings if (f.engine or "").lower() == "gitleaks")

    max_c = int(gate.max_critical_allowed or 0)
    max_h = int(gate.max_high_allowed or 0)
    block_secrets = bool(gate.block_on_secrets)
    ciso = bool(gate.require_ciso_approval_for_bypass)

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
        result.reasons = ["Política deshabilitada."]
        return result

    reasons: list[str] = []
    if open_critical > max_c:
        reasons.append(f"Críticas abiertas {open_critical} > máximo {max_c}")
    if open_high > max_h:
        reasons.append(f"High abiertas {open_high} > máximo {max_h}")
    if block_secrets and open_secrets > 0:
        reasons.append(f"Secretos GitLeaks abiertos: {open_secrets} (bloqueo estricto)")

    if reasons:
        result.decision = "BLOCKED"
        result.allowed = False
        result.reasons = reasons
        if ciso:
            result.reasons.append("Bypass requiere aprobación CISO (Pulse).")
    else:
        result.decision = "PASSED"
        result.allowed = True
        result.reasons = ["Umbrales dentro de política."]

    return result
