"""Métricas del dashboard desde Postgres (sin datos demo en memoria)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from models import AuditEvent, Finding, Repository, Scan

OPEN_STATUSES = ("OPEN", "IN_REVIEW")


def _severity_counts(findings: list[Finding]) -> dict[str, int]:
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in findings:
        key = (f.severity or "").upper()
        if key in counts:
            counts[key] += 1
    return counts


def _health_score(open_findings: list[Finding], repos: list[Repository]) -> int:
    if repos:
        scores = [r.health_score for r in repos if r.health_score is not None]
        if scores:
            return max(0, min(100, int(sum(scores) / len(scores))))
    if not open_findings:
        return 100
    sev = _severity_counts(open_findings)
    penalty = sev["CRITICAL"] * 18 + sev["HIGH"] * 8 + sev["MEDIUM"] * 3 + sev["LOW"]
    return max(0, min(100, 100 - penalty))


def _secrets_prevented(findings: list[Finding]) -> int:
    return sum(
        1
        for f in findings
        if (f.engine or "").lower() == "gitleaks"
        and (f.status or "").upper() in ("FIXED", "FALSE_POSITIVE", "ACCEPTED_RISK")
    )


def _finding_day(f: Finding) -> date | None:
    if not f.created_at:
        return None
    dt = f.created_at
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.date()


def compute_dashboard_stats(db: Session, repo_ids: list[str] | None = None) -> dict:
    repo_q = db.query(Repository).filter(Repository.is_active.is_(True))
    scan_q = db.query(Scan).filter(Scan.status == "COMPLETED")
    finding_q = db.query(Finding)
    if repo_ids:
        repo_q = repo_q.filter(Repository.id.in_(repo_ids))
        scan_q = scan_q.filter(Scan.repository_id.in_(repo_ids))
        finding_q = finding_q.filter(Finding.repository_id.in_(repo_ids))
    repos = repo_q.all()
    scans_count = scan_q.count()
    all_findings = finding_q.all()
    # Dashboard = hallazgos activos (OPEN/IN_REVIEW); supersedidos no cuentan
    open_findings = [f for f in all_findings if (f.status or "") in OPEN_STATUSES]
    visible = [f for f in all_findings if (f.status or "") != "SUPERSEDED"]
    sev = _severity_counts(open_findings)

    engine_counts: dict[str, int] = defaultdict(int)
    for f in open_findings:
        engine_counts[(f.engine or "unknown").lower()] += 1

    today = datetime.now(timezone.utc).date()
    trend: list[int] = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        trend.append(sum(1 for f in visible if _finding_day(f) == day and (f.status or "") in OPEN_STATUSES))

    return {
        "overall_health_score": _health_score(open_findings, repos),
        "monitored_repos": len(repos),
        "total_scans_run": scans_count,
        "total_open_findings": len(open_findings),
        "critical_findings": sev["CRITICAL"],
        "high_findings": sev["HIGH"],
        "medium_findings": sev["MEDIUM"],
        "low_findings": sev["LOW"],
        "secrets_leaked_prevented": _secrets_prevented(all_findings),
        "findings_by_engine": dict(engine_counts),
        "trend_7d": trend,
    }


def compute_heatmap(db: Session, weeks: int = 12, repo_ids: list[str] | None = None) -> dict:
    days = weeks * 7 - 1
    today = datetime.now(timezone.utc).date()
    q = db.query(Finding).filter(Finding.status.in_(list(OPEN_STATUSES)))
    if repo_ids:
        q = q.filter(Finding.repository_id.in_(repo_ids))
    findings = q.all()
    by_day: dict[date, int] = defaultdict(int)
    for f in findings:
        d = _finding_day(f)
        if d:
            by_day[d] += 1

    cells = []
    for i in range(days, -1, -1):
        day = today - timedelta(days=i)
        count = by_day.get(day, 0)
        level = 0 if count == 0 else min(4, 1 + count // 3)
        cells.append({"date": day.isoformat(), "count": count, "level": level})

    total = sum(c["count"] for c in cells)
    max_count = max((c["count"] for c in cells), default=0)
    return {
        "cells": cells,
        "max_count": max_count,
        "total_findings_period": total,
        "weeks": weeks,
    }


def list_audit_events(db: Session, limit: int = 40, repo_ids: list[str] | None = None) -> list[dict]:
    q = db.query(AuditEvent)
    if repo_ids:
        # Los eventos guardan el nombre del repositorio como target
        names = [n for (n,) in db.query(Repository.name).filter(Repository.id.in_(repo_ids)).all()]
        q = q.filter(AuditEvent.target.in_(names or ["__none__"]))
    rows = q.order_by(AuditEvent.created_at.desc()).limit(limit).all()
    return [
        {
            "id": row.id,
            "actor": row.actor_email or "system",
            "action": row.action,
            "target": row.target or "",
            "detail": row.detail or "",
            "created_at": row.created_at or datetime.now(timezone.utc),
        }
        for row in rows
    ]


def dashboard_has_data(db: Session) -> bool:
    if db.query(Repository).count() > 0:
        return True
    if db.query(Scan).count() > 0:
        return True
    if db.query(Finding).count() > 0:
        return True
    if db.query(AuditEvent).count() > 0:
        return True
    return False
