"""Resumen ejecutivo: la postura de seguridad en una página y en lenguaje de negocio.

Reutiliza la reconstrucción de hallazgos de Security Velocity para calcular la postura en cualquier
momento pasado y así comparar el inicio y el final del periodo.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from compliance import current_period, evaluate
from database import db_ping
from models import Finding, GateBypassRequest, Repository, RunbookExecution, Scan, SecretIncident
from velocity import SLA_DAYS, Run, build_runs, compute_velocity, first_seen_map, fingerprint
from workspaces import WorkspaceCtx, require_ws

router = APIRouter(prefix="/api/v1/executive", tags=["Resumen ejecutivo"])

RANGES = (30, 90, 180, 365)
WEIGHTS = {"CRITICAL": 18, "HIGH": 8, "MEDIUM": 3, "LOW": 1, "INFO": 0}
SEV_RANK = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
OPEN = ("OPEN", "IN_REVIEW")
DEP_PREFIXES = ("CVE-", "GHSA-", "GO-", "PYSEC-", "RUSTSEC-", "OSV-", "NSWG-")

CATEGORY = {
    "secret": {
        "label": "Credenciales expuestas",
        "impact": "Quien tenga acceso al código puede usarlas para entrar a sistemas o servicios de la empresa.",
        "action": "Rotar y revocar las credenciales",
        "tab": "secrets",
    },
    "dependency": {
        "label": "Librerías con vulnerabilidades conocidas",
        "impact": "Son fallas públicas: existen herramientas automáticas que las buscan y las explotan.",
        "action": "Actualizar las librerías afectadas",
        "tab": "sbom",
    },
    "code": {
        "label": "Fallas de seguridad en el código propio",
        "impact": "Podrían permitir robar datos o tomar el control de la aplicación.",
        "action": "Corregir el código",
        "tab": "fixIntel",
    },
    "web": {
        "label": "Aplicación publicada con configuración insegura",
        "impact": "Facilita ataques a los usuarios, como el robo de sesiones o la suplantación.",
        "action": "Ajustar la configuración del servidor",
        "tab": "findings",
    },
    "infra": {
        "label": "Infraestructura mal configurada",
        "impact": "Servicios o permisos más expuestos de lo necesario.",
        "action": "Corregir los archivos de despliegue",
        "tab": "findings",
    },
}


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _days(a: datetime, b: datetime) -> float:
    return max(0.0, (b - a).total_seconds() / 86400)


def _open_at(runs: list[Run], t: datetime) -> list[Run]:
    return [r for r in runs if r.opened <= t and (r.closed is None or r.closed > t)]


def _score(open_runs: list[Run]) -> int:
    return max(0, 100 - sum(WEIGHTS.get(r.severity, 0) for r in open_runs))


def _org_score(runs_by_repo: dict[str, list[Run]], repos: list[Repository], t: datetime) -> Optional[int]:
    scores = []
    for repo in repos:
        created = _aware(repo.created_at)
        if created and created > t:
            continue
        scores.append(_score(_open_at(runs_by_repo.get(repo.id, []), t)))
    return round(sum(scores) / len(scores)) if scores else None


def grade(score: Optional[int]) -> dict:
    if score is None:
        return {"letter": "—", "label": "Sin datos", "tone": "neutral"}
    for floor, letter, label, tone in (
        (90, "A", "Sólida", "good"),
        (75, "B", "Buena", "good"),
        (60, "C", "Mejorable", "warn"),
        (40, "D", "Débil", "bad"),
    ):
        if score >= floor:
            return {"letter": letter, "label": label, "tone": tone}
    return {"letter": "F", "label": "Crítica", "tone": "bad"}


def _category(f: Finding) -> str:
    engine = (f.engine or "").lower()
    if engine == "gitleaks" or (f.cwe or "").upper() == "CWE-798":
        return "secret"
    if engine == "trivy":
        return "dependency" if (f.title or "").upper().startswith(DEP_PREFIXES) else "infra"
    if engine == "owasp_zap":
        return "web"
    return "code"


def _overdue(runs: list[Run], t: datetime) -> int:
    return sum(1 for r in runs if _days(r.opened, t) > SLA_DAYS.get(r.severity, 90))


def _plural(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def compute_executive(
    db,
    *,
    workspace_id: str,
    range_days: int = 30,
    repo_ids: list[str] | None = None,
    now: datetime | None = None,
) -> dict:
    now = now or datetime.now(timezone.utc)
    start = now - timedelta(days=range_days)

    repo_q = db.query(Repository).filter(Repository.is_active.is_(True), Repository.workspace_id == workspace_id)
    if repo_ids:
        repo_q = repo_q.filter(Repository.id.in_(repo_ids))
    repos = repo_q.all()
    ids = [r.id for r in repos]
    names = {r.id: r.name for r in repos}

    prebuilt = build_runs(db, ids) if ids else ([], 0)
    runs = prebuilt[0]
    velocity = compute_velocity(db, range_days=range_days, repo_ids=ids or ["__none__"], now=now, prebuilt=prebuilt)
    k, prev = velocity["kpis"], velocity["previous"]

    runs_by_repo: dict[str, list[Run]] = defaultdict(list)
    for r in runs:
        runs_by_repo[r.repo_id].append(r)

    score_now = _org_score(runs_by_repo, repos, now)
    score_start = _org_score(runs_by_repo, repos, start)
    open_now, open_start = _open_at(runs, now), _open_at(runs, start)

    def severe(rs: list[Run]) -> int:
        return sum(1 for r in rs if r.severity in ("CRITICAL", "HIGH"))

    crit_now = sum(1 for r in open_now if r.severity == "CRITICAL")
    high_now = sum(1 for r in open_now if r.severity == "HIGH")
    overdue_now, overdue_start = _overdue(open_now, now), _overdue(open_start, start)
    crit_overdue = sum(1 for r in open_now if r.severity == "CRITICAL" and _days(r.opened, now) > SLA_DAYS["CRITICAL"])

    step = 7 if range_days <= 90 else 14 if range_days <= 180 else 30
    series = []
    t = start
    while t < now:
        series.append({"date": t.date().isoformat(), "label": t.strftime("%d/%m"), "score": _org_score(runs_by_repo, repos, t)})
        t += timedelta(days=step)
    series.append({"date": now.date().isoformat(), "label": now.strftime("%d/%m"), "score": score_now})

    # Riesgos principales: hallazgos abiertos agrupados por repositorio y tipo de problema
    first_seen = first_seen_map(db, ids) if ids else {}
    open_rows = db.query(Finding).filter(Finding.status.in_(OPEN), Finding.repository_id.in_(ids or ["__none__"])).all()
    groups: dict[tuple[str, str], dict] = {}
    for f in open_rows:
        cat = _category(f)
        sev = (f.severity or "INFO").upper()
        g = groups.setdefault(
            (f.repository_id, cat),
            {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0, "overdue": 0, "oldest": 0.0},
        )
        g[sev] = g.get(sev, 0) + 1
        seen = first_seen.get((f.repository_id, fingerprint(f.engine, f.title, f.file_path))) or _aware(f.created_at) or now
        age = _days(seen, now)
        g["oldest"] = max(g["oldest"], age)
        if age > SLA_DAYS.get(sev, 90):
            g["overdue"] += 1

    def rank(item):
        (_, _), g = item
        return (g["CRITICAL"], g["HIGH"], g["overdue"], g["MEDIUM"], g["LOW"])

    top_risks = []
    for (repo_id, cat), g in sorted(groups.items(), key=rank, reverse=True)[:5]:
        total = sum(g[s] for s in SEV_RANK)
        if not total:
            continue
        worst = next(s for s in SEV_RANK if g[s])
        meta = CATEGORY[cat]
        top_risks.append(
            {
                "category": cat,
                "title": meta["label"],
                "repository": names.get(repo_id, "—"),
                "severity": worst,
                "count": total,
                "critical": g["CRITICAL"],
                "high": g["HIGH"],
                "overdue": g["overdue"],
                "oldest_days": round(g["oldest"]),
                "impact": meta["impact"],
                "action": meta["action"],
                "tab": meta["tab"],
            }
        )

    # Decisiones que necesitan a alguien con autoridad
    decisions = []
    pending = [
        b
        for b in db.query(GateBypassRequest)
        .filter(GateBypassRequest.status == "PENDING", GateBypassRequest.workspace_id == workspace_id)
        .all()
        if not repo_ids or b.repository_id is None or b.repository_id in ids
    ]
    if pending:
        decisions.append(
            {
                "kind": "bypass",
                "tone": "warn",
                "title": f"{_plural(len(pending), 'excepción', 'excepciones')} al Security Gate esperando aprobación",
                "detail": "Un equipo pidió desplegar a pesar de los riesgos detectados. Hay que aprobarla o rechazarla.",
                "tab": "gates",
            }
        )
    if crit_overdue:
        decisions.append(
            {
                "kind": "overdue",
                "tone": "bad",
                "title": f"{_plural(crit_overdue, 'problema crítico superó', 'problemas críticos superaron')} su plazo de {SLA_DAYS['CRITICAL']} días",
                "detail": "Hay que asignarle tiempo del equipo o aceptar el riesgo de manera formal.",
                "tab": "fixIntel",
            }
        )
    orphan_secrets = (
        db.query(SecretIncident)
        .filter(
            SecretIncident.status.in_(["OPEN", "IN_PROGRESS"]),
            SecretIncident.owner_email.is_(None),
            SecretIncident.repository_id.in_(ids or ["__none__"]),
        )
        .count()
    )
    if orphan_secrets:
        decisions.append(
            {
                "kind": "secret_owner",
                "tone": "bad",
                "title": f"{_plural(orphan_secrets, 'credencial expuesta', 'credenciales expuestas')} sin responsable",
                "detail": "Nadie está a cargo de cambiarlas. Mientras sigan activas, pueden usarse.",
                "tab": "secrets",
            }
        )
    month_ago = now - timedelta(days=30)
    stale = [r for r in repos if not r.last_scan_at or _aware(r.last_scan_at) < month_ago]
    if stale:
        decisions.append(
            {
                "kind": "stale",
                "tone": "warn",
                "title": f"{_plural(len(stale), 'repositorio', 'repositorios')} sin analizar hace más de 30 días",
                "detail": "No se conoce su estado actual: " + ", ".join(r.name for r in stale[:4]) + ("…" if len(stale) > 4 else "."),
                "tab": "scans",
            }
        )
    accepted = {
        (f.repository_id, fingerprint(f.engine, f.title, f.file_path))
        for f in db.query(Finding).filter(Finding.status == "ACCEPTED_RISK", Finding.repository_id.in_(ids or ["__none__"])).all()
    }
    if accepted:
        decisions.append(
            {
                "kind": "accepted",
                "tone": "info",
                "title": f"{_plural(len(accepted), 'riesgo aceptado', 'riesgos aceptados')} formalmente",
                "detail": "Siguen existiendo. Conviene revisarlos de forma periódica por si cambió el contexto.",
                "tab": "findings",
            }
        )

    # Logros del periodo
    secrets_resolved = (
        db.query(SecretIncident)
        .filter(
            SecretIncident.status == "RESOLVED",
            SecretIncident.resolved_at >= start,
            SecretIncident.repository_id.in_(ids or ["__none__"]),
        )
        .count()
    )
    automations = (
        db.query(RunbookExecution)
        .filter(
            RunbookExecution.created_at >= start,
            RunbookExecution.status != "SIMULATED",
            RunbookExecution.workspace_id == workspace_id,
        )
        .all()
    )
    automations = [a for a in automations if not repo_ids or a.repository_id in ids]
    mttr = k["mttr_days"]
    wins = [
        {
            "value": k["fixed"],
            "label": "problemas corregidos",
            "detail": None if mttr is None else "en menos de un día" if mttr < 1 else f"en {_plural(round(mttr), 'día', 'días')} de media",
        },
        {"value": k["scans"], "label": "análisis de seguridad", "detail": f"{k['scans_per_week']} por semana"},
    ]
    if k["gate"]["blocked"]:
        wins.append({"value": k["gate"]["blocked"], "label": "despliegues con riesgo detenidos", "detail": "por el Security Gate"})
    if secrets_resolved:
        wins.append({"value": secrets_resolved, "label": "credenciales expuestas resueltas", "detail": "rotadas, revocadas y verificadas"})
    if automations:
        wins.append({"value": len(automations), "label": "respuestas automáticas", "detail": "ejecutadas por Automatizaciones"})

    # Mensajes principales en lenguaje de negocio
    highlights = []
    if score_now is not None and score_start is not None:
        diff = score_now - score_start
        if diff >= 3:
            highlights.append({"tone": "good", "text": f"La postura de seguridad mejoró de {score_start} a {score_now} puntos en los últimos {range_days} días."})
        elif diff <= -3:
            highlights.append({"tone": "bad", "text": f"La postura de seguridad empeoró de {score_start} a {score_now} puntos en los últimos {range_days} días."})
        else:
            highlights.append({"tone": "neutral", "text": f"La postura de seguridad se mantuvo estable en {score_now} puntos."})
    if k["fixed"] or k["introduced"]:
        highlights.append(
            {
                "tone": "good" if k["fixed"] >= k["introduced"] else "warn",
                "text": f"Se {'corrigió' if k['fixed'] == 1 else 'corrigieron'} {_plural(k['fixed'], 'problema', 'problemas')} y "
                f"{'apareció' if k['introduced'] == 1 else 'aparecieron'} {k['introduced']} {'nuevo' if k['introduced'] == 1 else 'nuevos'}.",
            }
        )
    if crit_now:
        extra = f", {crit_overdue} fuera de plazo" if crit_overdue else ""
        highlights.append({"tone": "bad", "text": f"Hay {_plural(crit_now, 'problema crítico abierto', 'problemas críticos abiertos')}{extra}."})
    elif high_now:
        highlights.append({"tone": "warn", "text": f"No hay problemas críticos abiertos; quedan {high_now} de severidad alta."})
    elif repos:
        highlights.append({"tone": "good", "text": "No hay problemas críticos ni altos abiertos."})
    if k["sla_met_pct"] is not None:
        highlights.append(
            {
                "tone": "good" if k["sla_met_pct"] >= 80 else "warn" if k["sla_met_pct"] >= 50 else "bad",
                "text": f"El {k['sla_met_pct']}% de las correcciones se hizo dentro del plazo acordado.",
            }
        )

    g = grade(score_now)
    status = g["tone"]
    if crit_overdue and status == "good":
        status = "warn"

    repo_rows = []
    for repo in repos:
        rr = runs_by_repo.get(repo.id, [])
        r_open = _open_at(rr, now)
        created = _aware(repo.created_at)
        r_start = None if created and created > start else _score(_open_at(rr, start))
        r_now = _score(r_open)
        repo_rows.append(
            {
                "id": repo.id,
                "name": repo.name,
                "score": r_now,
                "score_start": r_start,
                "grade": grade(r_now),
                "critical": sum(1 for r in r_open if r.severity == "CRITICAL"),
                "high": sum(1 for r in r_open if r.severity == "HIGH"),
                "overdue": _overdue(r_open, now),
                "last_scan_at": _aware(repo.last_scan_at).isoformat() if repo.last_scan_at else None,
            }
        )
    repo_rows.sort(key=lambda r: (r["score"], -r["critical"]))

    ev = evaluate(db, workspace_id, now)
    active = [f for f in ev["frameworks"] if f["enabled"]]
    blocking = []
    for ctl in ev["controls"]:
        if ctl["status"] not in ("GAP", "PENDING"):
            continue
        fws = [m["short"] for m in ctl["mappings"] if m["enabled"]]
        if fws:
            blocking.append({"id": ctl["id"], "name": ctl["name"], "status": ctl["status"], "reason": ctl["reason"], "frameworks": fws})
    blocking.sort(key=lambda c: (c["status"] != "GAP", -len(c["frameworks"])))
    compliance = {
        "period": current_period(now),
        "frameworks": [
            {
                "id": f["id"],
                "short": f["short"],
                "name": f["name"],
                "score": f["score"],
                "compliant": f["counts"]["COMPLIANT"],
                "total": f["total"] - f["counts"]["NOT_APPLICABLE"],
            }
            for f in active
        ],
        "gaps": blocking[:4],
    }

    return {
        "range_days": range_days,
        "generated_at": now.isoformat(),
        "period_start": start.date().isoformat(),
        "period_end": now.date().isoformat(),
        "scope": {"repositories": len(repos), "filtered": bool(repo_ids)},
        "status": status,
        "posture": {"score": score_now, "score_start": score_start, "grade": g},
        "highlights": highlights,
        "kpis": {
            "exposure": {"now": severe(open_now), "before": severe(open_start), "critical": crit_now, "high": high_now},
            "overdue": {"now": overdue_now, "before": overdue_start},
            "mttr_days": {"now": k["mttr_days"], "before": prev["mttr_days"]},
            "sla_met_pct": {"now": k["sla_met_pct"], "before": prev["sla_met_pct"]},
            "gate_pass_rate": {"now": k["gate"]["pass_rate"], "before": prev["gate_pass_rate"]},
        },
        "series": series,
        "top_risks": top_risks,
        "decisions": decisions,
        "wins": wins,
        "repositories": repo_rows,
        "compliance": compliance,
    }


@router.get("")
def executive_summary(
    range_days: int = Query(default=30),
    repository_ids: Optional[str] = Query(default=None),
    ws: WorkspaceCtx = Depends(require_ws),
):
    if range_days not in RANGES:
        raise HTTPException(status_code=400, detail="El periodo debe ser 30, 90, 180 o 365 días.")
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    ids = [x.strip() for x in (repository_ids or "").split(",") if x.strip()] or None
    db = ws.session()
    try:
        return compute_executive(db, workspace_id=ws.id, range_days=range_days, repo_ids=ids)
    finally:
        db.close()
