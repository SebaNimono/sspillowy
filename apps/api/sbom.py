"""Supply Chain & SBOM: inventario de dependencias por repositorio, diferencias entre análisis,
cruce con vulnerabilidades activas y exportación CycloneDX."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from auth_deps import require_hub_read
from database import SessionLocal, db_ping
from models import Finding, Repository, SbomComponent, SbomSnapshot
from semgrep_scan import ACTIVE_STATUSES, relative_file_path

router = APIRouter(prefix="/api/v1/sbom", tags=["Supply Chain & SBOM"])

_PKG_RE = re.compile(r"Paquete:\s*(\S+)@([^\s@]+)(?:\s*→\s*fix\s*(.+))?$", re.MULTILINE)
_SEV_RANK = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
_DIFF_CAP = 300


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _require_db() -> None:
    if not db_ping():
        raise HTTPException(status_code=503, detail="Base de datos no disponible")


def _version_key(v: str) -> tuple:
    return tuple(int(p) if p.isdigit() else p for p in re.findall(r"\d+|[A-Za-z]+", v or ""))


def _safe_ge(a: str, b: str) -> bool:
    try:
        return _version_key(a) >= _version_key(b)
    except TypeError:
        return a >= b


def _safe_max(values: list[str]) -> Optional[str]:
    best: Optional[str] = None
    for v in values:
        if best is None or not _safe_ge(best, v):
            best = v
    return best


def _comp_key(c: dict | SbomComponent) -> tuple[str, str]:
    get = c.get if isinstance(c, dict) else lambda k: getattr(c, k)
    return (get("ecosystem") or "", get("name"))


def persist_sbom(db, *, scan, repo, packages: list[dict], scan_root: Path | None = None) -> int:
    """Reemplaza el inventario vigente del repo y guarda la diferencia con el anterior."""
    merged: dict[tuple[str, str, str], dict] = {}
    for p in packages:
        manifest = relative_file_path(p.get("manifest") or "", scan_root) or p.get("manifest")
        key = (p.get("ecosystem") or "", p["name"], p.get("version") or "")
        if key in merged:
            item = merged[key]
            if manifest and manifest not in (item["manifest"] or ""):
                item["manifest"] = f"{item['manifest']}, {manifest}"[:500] if item["manifest"] else manifest
            if p.get("licenses") and not item.get("licenses"):
                item["licenses"] = p["licenses"]
            if p.get("direct"):
                item["direct"] = True
        else:
            merged[key] = {**p, "manifest": (str(manifest)[:500] if manifest else None)}

    previous = db.query(SbomComponent).filter(SbomComponent.repository_id == repo.id).all()
    old_versions: dict[tuple[str, str], set[str]] = {}
    for c in previous:
        old_versions.setdefault(_comp_key(c), set()).add(c.version or "")
    new_versions: dict[tuple[str, str], set[str]] = {}
    for (eco, name, ver) in merged:
        new_versions.setdefault((eco, name), set()).add(ver)

    added, removed, updated = [], [], []
    if previous:
        for key, vers in new_versions.items():
            if key not in old_versions:
                added.append({"ecosystem": key[0], "name": key[1], "version": ", ".join(sorted(vers))})
            elif vers != old_versions[key]:
                updated.append(
                    {
                        "ecosystem": key[0],
                        "name": key[1],
                        "from": ", ".join(sorted(old_versions[key])),
                        "to": ", ".join(sorted(vers)),
                    }
                )
        for key, vers in old_versions.items():
            if key not in new_versions:
                removed.append({"ecosystem": key[0], "name": key[1], "version": ", ".join(sorted(vers))})

    db.query(SbomComponent).filter(SbomComponent.repository_id == repo.id).delete(synchronize_session=False)
    now = _now()
    for item in merged.values():
        db.add(
            SbomComponent(
                id=str(uuid.uuid4()),
                repository_id=repo.id,
                scan_id=scan.id,
                name=item["name"],
                version=item.get("version"),
                ecosystem=item.get("ecosystem"),
                purl=item.get("purl"),
                licenses=item.get("licenses"),
                manifest=item.get("manifest"),
                direct=item.get("direct"),
                created_at=now,
            )
        )
    db.add(
        SbomSnapshot(
            id=str(uuid.uuid4()),
            repository_id=repo.id,
            scan_id=scan.id,
            component_count=len(merged),
            added=json.dumps(added[:_DIFF_CAP]),
            removed=json.dumps(removed[:_DIFF_CAP]),
            updated=json.dumps(updated[:_DIFF_CAP]),
            created_at=now,
        )
    )
    return len(merged)


def _vuln_index(db, repository_id: Optional[str]) -> dict[tuple[str, str, str], dict]:
    """(repo, paquete, versión) -> resumen de vulnerabilidades activas de Trivy."""
    q = db.query(Finding).filter(Finding.engine == "trivy", Finding.status.in_(ACTIVE_STATUSES))
    if repository_id:
        q = q.filter(Finding.repository_id == repository_id)
    index: dict[tuple[str, str, str], dict] = {}
    for f in q.all():
        m = _PKG_RE.search(f.description or "")
        if not m:
            continue
        pkg, installed, fixed = m.group(1).strip(), m.group(2).strip(), (m.group(3) or "").strip()
        entry = index.setdefault(
            (f.repository_id, pkg, installed),
            {"count": 0, "max_severity": "INFO", "cves": [], "_fixes": []},
        )
        entry["count"] += 1
        if _SEV_RANK.get(f.severity, 9) < _SEV_RANK.get(entry["max_severity"], 9):
            entry["max_severity"] = f.severity
        cve = (f.title or "").split(":", 1)[0].strip()
        if cve and cve not in entry["cves"]:
            entry["cves"].append(cve)
        candidates = [c.strip() for c in fixed.split(",") if c.strip()]
        valid = [c for c in candidates if _safe_ge(c, installed)] or candidates
        if valid:
            smallest = valid[0]
            for c in valid[1:]:
                if not _safe_ge(c, smallest):
                    smallest = c
            entry["_fixes"].append(smallest)
    for entry in index.values():
        entry["fix_version"] = _safe_max(entry.pop("_fixes"))
        entry["cves"] = entry["cves"][:8]
    return index


def _loads(raw: Optional[str]) -> list:
    try:
        return json.loads(raw) if raw else []
    except ValueError:
        return []


@router.get("")
async def get_sbom(
    repository_id: Optional[str] = Query(default=None),
    _auth=Depends(require_hub_read),
):
    _require_db()
    db = SessionLocal()
    try:
        repos = {r.id: r for r in db.query(Repository).all()}
        q = db.query(SbomComponent)
        if repository_id:
            q = q.filter(SbomComponent.repository_id == repository_id)
        components = q.order_by(SbomComponent.name.asc()).all()
        vulns = _vuln_index(db, repository_id)

        latest: dict[str, SbomSnapshot] = {}
        for snap in db.query(SbomSnapshot).order_by(SbomSnapshot.created_at.desc()).all():
            latest.setdefault(snap.repository_id, snap)

        out_components = []
        per_repo: dict[str, dict] = {}
        for c in components:
            v = vulns.get((c.repository_id, c.name, c.version or ""))
            out_components.append(
                {
                    "id": c.id,
                    "repository_id": c.repository_id,
                    "repository_name": repos[c.repository_id].name if c.repository_id in repos else None,
                    "name": c.name,
                    "version": c.version,
                    "ecosystem": c.ecosystem,
                    "purl": c.purl,
                    "licenses": c.licenses,
                    "manifest": c.manifest,
                    "direct": c.direct,
                    "vulnerabilities": v,
                }
            )
            stats = per_repo.setdefault(c.repository_id, {"components": 0, "vulnerable": 0, "ecosystems": {}})
            stats["components"] += 1
            if v:
                stats["vulnerable"] += 1
            eco = c.ecosystem or "otro"
            stats["ecosystems"][eco] = stats["ecosystems"].get(eco, 0) + 1

        repositories = []
        for repo_id, repo in repos.items():
            if repository_id and repo_id != repository_id:
                continue
            snap = latest.get(repo_id)
            stats = per_repo.get(repo_id, {"components": 0, "vulnerable": 0, "ecosystems": {}})
            repositories.append(
                {
                    "id": repo_id,
                    "name": repo.name,
                    "component_count": stats["components"],
                    "vulnerable_count": stats["vulnerable"],
                    "ecosystems": stats["ecosystems"],
                    "generated_at": snap.created_at if snap else None,
                    "changes": {
                        "added": _loads(snap.added) if snap else [],
                        "removed": _loads(snap.removed) if snap else [],
                        "updated": _loads(snap.updated) if snap else [],
                    },
                }
            )
        repositories.sort(key=lambda r: (r["generated_at"] is None, r["name"].lower()))
        return {"repositories": repositories, "components": out_components}
    finally:
        db.close()


@router.get("/{repository_id}/cyclonedx")
async def export_cyclonedx(repository_id: str, _auth=Depends(require_hub_read)):
    _require_db()
    db = SessionLocal()
    try:
        repo = db.get(Repository, repository_id)
        if not repo:
            raise HTTPException(status_code=404, detail="Repositorio no encontrado")
        components = (
            db.query(SbomComponent)
            .filter(SbomComponent.repository_id == repository_id)
            .order_by(SbomComponent.name.asc())
            .all()
        )
        if not components:
            raise HTTPException(status_code=404, detail="Este repositorio aún no tiene SBOM. Lanza un análisis de dependencias.")
        vulns = _vuln_index(db, repository_id)

        bom_components, bom_vulns = [], {}
        for c in components:
            ref = c.purl or f"{c.ecosystem or 'pkg'}:{c.name}@{c.version or ''}"
            comp = {"type": "library", "bom-ref": ref, "name": c.name}
            if c.version:
                comp["version"] = c.version
            if c.purl:
                comp["purl"] = c.purl
            if c.licenses:
                comp["licenses"] = [{"license": {"name": lic.strip()}} for lic in c.licenses.split(",") if lic.strip()]
            bom_components.append(comp)
            v = vulns.get((repository_id, c.name, c.version or ""))
            if v:
                for cve in v["cves"]:
                    entry = bom_vulns.setdefault(
                        cve, {"id": cve, "ratings": [{"severity": v["max_severity"].lower()}], "affects": []}
                    )
                    entry["affects"].append({"ref": ref})

        bom = {
            "bomFormat": "CycloneDX",
            "specVersion": "1.5",
            "serialNumber": f"urn:uuid:{uuid.uuid4()}",
            "version": 1,
            "metadata": {
                "timestamp": _now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "tools": {"components": [{"type": "application", "name": "SSPILLOWY"}]},
                "component": {"type": "application", "bom-ref": f"repo:{repo.id}", "name": repo.name},
            },
            "components": bom_components,
            "vulnerabilities": list(bom_vulns.values()),
        }
        filename = re.sub(r"[^A-Za-z0-9._-]+", "_", repo.name) + ".cdx.json"
        return JSONResponse(bom, headers={"Content-Disposition": f'attachment; filename="{filename}"'})
    finally:
        db.close()
