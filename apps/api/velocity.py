"""Security Velocity: qué tan rápido se detecta, se corrige y se libera.

Cada re-escaneo crea filas nuevas de hallazgos, así que el ciclo de vida se reconstruye por fingerprint
(motor + regla + archivo): un hallazgo "nace" en el primer escaneo en que aparece y se considera
corregido en el primer escaneo posterior que ejecutó su motor y ya no lo encontró. Si vuelve a aparecer
después, cuenta como regresión.
"""

from __future__ import annotations

import math
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func

from auth_deps import require_hub_read
from database import SessionLocal, db_ping
from models import Finding, GateBypassRequest, Repository, Scan

router = APIRouter(prefix="/api/v1/velocity", tags=["Security Velocity"])

SLA_DAYS = {"CRITICAL": 7, "HIGH": 30, "MEDIUM": 90, "LOW": 180, "INFO": 365}
SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")
DECIDED = ("FALSE_POSITIVE", "ACCEPTED_RISK")
DAY = 86400.0


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def fingerprint(engine: str | None, title: str | None, path: str | None) -> str:
    clean = (path or "").replace("\\", "/").lstrip("./")
    return f"{(engine or '').lower()}|{title or ''}|{clean}"


def first_seen_map(db, repo_ids: list[str] | None = None) -> dict[tuple[str, str], datetime]:
    """(repo_id, fingerprint) → primera vez que se detectó (para calcular antigüedad y SLA reales)."""
    q = db.query(
        Finding.repository_id,
        Finding.engine,
        Finding.title,
        Finding.file_path,
        func.min(Finding.created_at),
    ).group_by(Finding.repository_id, Finding.engine, Finding.title, Finding.file_path)
    if repo_ids:
        q = q.filter(Finding.repository_id.in_(repo_ids))
    out: dict[tuple[str, str], datetime] = {}
    for repo_id, engine, title, path, first in q.all():
        key = (repo_id, fingerprint(engine, title, path))
        first = _aware(first)
        if key not in out or (first and first < out[key]):
            out[key] = first
    return out


@dataclass
class Run:
    repo_id: str
    severity: str
    engine: str
    title: str
    opened: datetime
    closed: Optional[datetime] = None
    regression: bool = False


@dataclass
class _Track:
    engine: str
    title: str
    severity: str = "INFO"
    scans: set = field(default_factory=set)
    superseded_in: set = field(default_factory=set)
    status: str = "OPEN"
    last_seen: Optional[datetime] = None


def build_runs(db, repo_ids: list[str] | None = None) -> tuple[list[Run], int]:
    """Reconstruye los periodos abiertos de cada hallazgo. Devuelve (runs, nº de hallazgos decididos)."""
    scan_q = db.query(Scan).filter(Scan.status == "COMPLETED")
    if repo_ids:
        scan_q = scan_q.filter(Scan.repository_id.in_(repo_ids))
    scans_by_repo: dict[str, list[Scan]] = defaultdict(list)
    for s in scan_q.order_by(Scan.created_at.asc()).all():
        scans_by_repo[s.repository_id].append(s)

    f_q = db.query(
        Finding.repository_id,
        Finding.scan_id,
        Finding.engine,
        Finding.title,
        Finding.file_path,
        Finding.severity,
        Finding.status,
        Finding.created_at,
    )
    if repo_ids:
        f_q = f_q.filter(Finding.repository_id.in_(repo_ids))

    tracks: dict[str, dict[str, _Track]] = defaultdict(dict)
    engines_seen: dict[str, set] = defaultdict(set)
    for repo_id, scan_id, engine, title, path, sev, status, created in f_q.all():
        fp = fingerprint(engine, title, path)
        t = tracks[repo_id].get(fp)
        if t is None:
            t = tracks[repo_id][fp] = _Track(engine=(engine or "").lower(), title=title or "")
        t.scans.add(scan_id)
        if status == "SUPERSEDED":
            t.superseded_in.add(scan_id)
        created = _aware(created)
        if t.last_seen is None or (created and created >= t.last_seen):
            t.last_seen = created
            t.severity = (sev or "INFO").upper()
            t.status = status or "OPEN"
        engines_seen[scan_id].add((engine or "").lower())

    runs: list[Run] = []
    decided = 0
    for repo_id, fps in tracks.items():
        scans = scans_by_repo.get(repo_id, [])
        if not scans:
            continue
        for t in fps.values():
            if t.status in DECIDED:
                decided += 1
                continue
            current: Optional[Run] = None
            had_fix = False
            prev_superseded = False
            for s in scans:
                when = _aware(s.completed_at) or _aware(s.created_at)
                if s.id in t.scans:
                    if current is None:
                        current = Run(repo_id, t.severity, t.engine, t.title, when, regression=had_fix)
                    prev_superseded = s.id in t.superseded_in
                    continue
                if current is None:
                    continue
                if s.engines_ok is not None:
                    ran = t.engine in s.engines_ok.split(",")
                else:
                    ran = t.engine in engines_seen.get(s.id, set()) or prev_superseded
                if ran:
                    current.closed = when
                    runs.append(current)
                    current = None
                    had_fix = True
                    prev_superseded = False
            if current is not None:
                if t.status == "FIXED":
                    current.closed = t.last_seen
                runs.append(current)
    return runs, decided


def _days(a: datetime, b: datetime) -> float:
    return max(0.0, (b - a).total_seconds() / DAY)


def _round(v: float | None, nd: int = 1) -> float | None:
    return None if v is None else round(v, nd)


def _flow(runs: list[Run], start: datetime, end: datetime) -> dict:
    introduced = [r for r in runs if start <= r.opened < end]
    fixed = [r for r in runs if r.closed and start <= r.closed < end]
    durations = [_days(r.opened, r.closed) for r in fixed]
    in_sla = [r for r in fixed if _days(r.opened, r.closed) <= SLA_DAYS.get(r.severity, 90)]
    return {
        "introduced": len(introduced),
        "fixed": len(fixed),
        "regressions": sum(1 for r in introduced if r.regression),
        "mttr_days": _round(statistics.fmean(durations)) if durations else None,
        "median_days": _round(statistics.median(durations)) if durations else None,
        "sla_met_pct": round(100 * len(in_sla) / len(fixed)) if fixed else None,
    }


def _open_at(runs: list[Run], t: datetime) -> list[Run]:
    return [r for r in runs if r.opened <= t and (r.closed is None or r.closed > t)]


def _gate_stats(scans: list[Scan]) -> dict:
    counts = {"PASSED": 0, "BLOCKED": 0, "BYPASSED": 0, "SKIPPED": 0}
    for s in scans:
        if s.gate_status in counts:
            counts[s.gate_status] += 1
    evaluated = counts["PASSED"] + counts["BLOCKED"] + counts["BYPASSED"]
    return {
        **{k.lower(): v for k, v in counts.items()},
        "pass_rate": round(100 * counts["PASSED"] / evaluated) if evaluated else None,
    }


def compute_velocity(db, *, range_days: int = 30, repo_ids: list[str] | None = None, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    start = now - timedelta(days=range_days)
    prev_start = start - timedelta(days=range_days)

    repo_q = db.query(Repository)
    if repo_ids:
        repo_q = repo_q.filter(Repository.id.in_(repo_ids))
    repos = repo_q.all()
    ids = [r.id for r in repos]
    runs, decided = build_runs(db, ids) if ids else ([], 0)

    scan_q = db.query(Scan).filter(Scan.repository_id.in_(ids), Scan.created_at >= prev_start) if ids else None
    all_scans = scan_q.all() if scan_q is not None else []
    cur_scans = [s for s in all_scans if _aware(s.created_at) >= start]
    prev_scans = [s for s in all_scans if _aware(s.created_at) < start]

    cur = _flow(runs, start, now)
    prev = _flow(runs, prev_start, start)
    open_now = _open_at(runs, now)
    ages = [_days(r.opened, now) for r in open_now]
    overdue = [r for r in open_now if _days(r.opened, now) > SLA_DAYS.get(r.severity, 90)]

    def scan_minutes(rows: list[Scan]) -> float | None:
        mins = [
            (_aware(s.completed_at) - _aware(s.created_at)).total_seconds() / 60
            for s in rows
            if s.status == "COMPLETED" and s.completed_at and s.created_at
        ]
        return _round(statistics.median(mins)) if mins else None

    bypass_q = db.query(GateBypassRequest).filter(GateBypassRequest.created_at >= start)
    bypasses = [b for b in bypass_q.all() if not ids or b.repository_id is None or b.repository_id in ids]

    weeks = max(4, math.ceil(range_days / 7))
    series = []
    for i in range(weeks - 1, -1, -1):
        w_end = now - timedelta(days=7 * i)
        w_start = w_end - timedelta(days=7)
        f = _flow(runs, w_start, w_end)
        series.append(
            {
                "week_start": w_start.date().isoformat(),
                "label": w_start.strftime("%d/%m"),
                "introduced": f["introduced"],
                "fixed": f["fixed"],
                "backlog": len(_open_at(runs, w_end)),
                "mttr_days": f["mttr_days"],
            }
        )

    by_severity = []
    for sev in SEVERITIES:
        sev_runs = [r for r in runs if r.severity == sev]
        f = _flow(sev_runs, start, now)
        sev_open = [r for r in open_now if r.severity == sev]
        by_severity.append(
            {
                "severity": sev,
                "sla_days": SLA_DAYS[sev],
                "mttr_days": f["mttr_days"],
                "fixed": f["fixed"],
                "sla_met_pct": f["sla_met_pct"],
                "open": len(sev_open),
                "overdue": sum(1 for r in sev_open if _days(r.opened, now) > SLA_DAYS[sev]),
            }
        )

    by_engine = []
    for engine in sorted({r.engine for r in runs}):
        e_runs = [r for r in runs if r.engine == engine]
        f = _flow(e_runs, start, now)
        by_engine.append(
            {
                "engine": engine,
                "introduced": f["introduced"],
                "fixed": f["fixed"],
                "mttr_days": f["mttr_days"],
                "open": sum(1 for r in open_now if r.engine == engine),
            }
        )

    runs_by_repo: dict[str, list[Run]] = defaultdict(list)
    for r in runs:
        runs_by_repo[r.repo_id].append(r)
    scans_by_repo: dict[str, list[Scan]] = defaultdict(list)
    for s in cur_scans:
        scans_by_repo[s.repository_id].append(s)
    repo_rows = []
    for repo in sorted(repos, key=lambda r: r.name.lower()):
        rr = runs_by_repo.get(repo.id, [])
        f = _flow(rr, start, now)
        r_open = _open_at(rr, now)
        g = _gate_stats(scans_by_repo.get(repo.id, []))
        repo_rows.append(
            {
                "id": repo.id,
                "name": repo.name,
                "open": len(r_open),
                "overdue": sum(1 for r in r_open if _days(r.opened, now) > SLA_DAYS.get(r.severity, 90)),
                "introduced": f["introduced"],
                "fixed": f["fixed"],
                "net": f["fixed"] - f["introduced"],
                "mttr_days": f["mttr_days"],
                "sla_met_pct": f["sla_met_pct"],
                "scans": len(scans_by_repo.get(repo.id, [])),
                "gate_pass_rate": g["pass_rate"],
                "last_scan_at": _aware(repo.last_scan_at).isoformat() if repo.last_scan_at else None,
            }
        )

    slowest = sorted(
        (r for r in open_now if r.severity in ("CRITICAL", "HIGH")),
        key=lambda r: r.opened,
    )[:6]
    repo_names = {r.id: r.name for r in repos}

    cur_gate = _gate_stats(cur_scans)
    prev_gate = _gate_stats(prev_scans)
    return {
        "range_days": range_days,
        "generated_at": now.isoformat(),
        "has_history": any(len([s for s in all_scans if s.repository_id == rid]) > 1 for rid in ids)
        or any(r.closed for r in runs),
        "kpis": {
            **cur,
            "open": len(open_now),
            "overdue": len(overdue),
            "median_open_age_days": _round(statistics.median(ages)) if ages else None,
            "decided": decided,
            "scans": len(cur_scans),
            "scans_per_week": _round(len(cur_scans) / (range_days / 7)),
            "scan_minutes": scan_minutes(cur_scans),
            "gate": cur_gate,
            "bypass_requests": len(bypasses),
            "bypass_approved": sum(1 for b in bypasses if b.status in ("APPROVED", "EXPIRED")),
        },
        "previous": {
            **prev,
            "scans": len(prev_scans),
            "gate_pass_rate": prev_gate["pass_rate"],
        },
        "series": series,
        "by_severity": by_severity,
        "by_engine": by_engine,
        "repositories": repo_rows,
        "oldest_open": [
            {
                "title": r.title,
                "severity": r.severity,
                "engine": r.engine,
                "repository": repo_names.get(r.repo_id, "—"),
                "age_days": _round(_days(r.opened, now)),
                "sla_days": SLA_DAYS.get(r.severity, 90),
            }
            for r in slowest
        ],
    }


@router.get("")
def velocity(
    range_days: int = Query(default=30),
    repository_ids: Optional[str] = Query(default=None),
    _auth=Depends(require_hub_read),
):
    if range_days not in (7, 30, 90, 180):
        raise HTTPException(status_code=400, detail="El periodo debe ser 7, 30, 90 o 180 días.")
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    ids = [x.strip() for x in (repository_ids or "").split(",") if x.strip()] or None
    db = SessionLocal()
    try:
        return compute_velocity(db, range_days=range_days, repo_ids=ids)
    finally:
        db.close()
