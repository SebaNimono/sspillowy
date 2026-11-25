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
    finding_q = db.query(Finding.severity, Finding.status, Finding.engine, Finding.created_at)
    if repo_ids:
        repo_q = repo_q.filter(Repository.id.in_(repo_ids))
        scan_q = scan_q.filter(Scan.repository_id.in_(repo_ids))
        finding_q = finding_q.filter(Finding.repository_id.in_(repo_ids))
    repos = repo_q.all()
    scans_count = scan_q.count()
    all_rows = finding_q.all()

    sev = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    engine_counts: dict[str, int] = defaultdict(int)
    by_day_open: dict[date, int] = defaultdict(int)
    open_count = 0
    secrets_prevented = 0

    for f_sev, f_status, f_engine, f_created in all_rows:
        st = (f_status or "").upper()
        eng = (f_engine or "unknown").lower()
        if eng == "gitleaks" and st in ("FIXED", "FALSE_POSITIVE", "ACCEPTED_RISK"):
            secrets_prevented += 1
        if st in OPEN_STATUSES:
            open_count += 1
            k = (f_sev or "").upper()
            if k in sev:
                sev[k] += 1
            engine_counts[eng] += 1
            if f_created:
                dt = f_created if f_created.tzinfo else f_created.replace(tzinfo=timezone.utc)
                by_day_open[dt.date()] += 1

    if repos:
        scores = [r.health_score for r in repos if r.health_score is not None]
        if scores:
            health_score = max(0, min(100, int(sum(scores) / len(scores))))
        elif open_count == 0:
            health_score = 100
        else:
            penalty = sev["CRITICAL"] * 18 + sev["HIGH"] * 8 + sev["MEDIUM"] * 3 + sev["LOW"]
            health_score = max(0, min(100, 100 - penalty))
    elif open_count == 0:
        health_score = 100
    else:
        penalty = sev["CRITICAL"] * 18 + sev["HIGH"] * 8 + sev["MEDIUM"] * 3 + sev["LOW"]
        health_score = max(0, min(100, 100 - penalty))

    today = datetime.now(timezone.utc).date()
    trend: list[int] = [by_day_open.get(today - timedelta(days=i), 0) for i in range(6, -1, -1)]

    return {
        "overall_health_score": health_score,
        "monitored_repos": len(repos),
        "total_scans_run": scans_count,
        "total_open_findings": open_count,
        "critical_findings": sev["CRITICAL"],
        "high_findings": sev["HIGH"],
        "medium_findings": sev["MEDIUM"],
        "low_findings": sev["LOW"],
        "secrets_leaked_prevented": secrets_prevented,
        "findings_by_engine": dict(engine_counts),
        "trend_7d": trend,
    }


def compute_heatmap(db: Session, weeks: int = 12, repo_ids: list[str] | None = None) -> dict:
    days = weeks * 7 - 1
    today = datetime.now(timezone.utc).date()
    q = db.query(Finding.created_at).filter(Finding.status.in_(list(OPEN_STATUSES)))
    if repo_ids:
        q = q.filter(Finding.repository_id.in_(repo_ids))
    by_day: dict[date, int] = defaultdict(int)
    for (created_at,) in q.all():
        if created_at:
            dt = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
            by_day[dt.date()] += 1

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


def list_audit_events(
    db: Session, limit: int = 40, repo_ids: list[str] | None = None, workspace_id: str | None = None
) -> list[dict]:
    q = db.query(AuditEvent)
    if workspace_id:
        q = q.filter(AuditEvent.workspace_id == workspace_id)
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
