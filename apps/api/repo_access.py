"""Acceso a repositorios: plataforma de origen, URL válida, token de lectura cifrado y prueba de acceso."""

from __future__ import annotations

import base64
import hashlib
import os
import re
import subprocess
from dataclasses import dataclass
from typing import Literal, Optional
from urllib.parse import quote, urlparse, urlunparse

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from workspaces import WorkspaceCtx, require_ws_write

router = APIRouter(prefix="/api/v1/repositories", tags=["Repositories"])

Provider = Literal["github", "gitlab", "bitbucket", "azure", "other"]

PROVIDER_NAME = {
    "github": "GitHub",
    "gitlab": "GitLab",
    "bitbucket": "Bitbucket",
    "azure": "Azure DevOps",
    "other": "tu servidor Git",
}
# Usuario con el que cada plataforma acepta un token por HTTPS.
_TOKEN_USER = {
    "github": "x-access-token",
    "gitlab": "oauth2",
    "bitbucket": "x-token-auth",
    "azure": "pat",
    "other": "oauth2",
}


def detect_provider(url: str) -> Provider:
    host = (urlparse(url).hostname or "").lower()
    if host == "github.com":
        return "github"
    if host == "bitbucket.org":
        return "bitbucket"
    if host == "dev.azure.com" or host.endswith(".visualstudio.com"):
        return "azure"
    if "gitlab" in host:
        return "gitlab"
    return "other"


def _host_allowed(provider: str, host: str) -> bool:
    if provider == "github":
        return host == "github.com"
    if provider == "bitbucket":
        return host == "bitbucket.org"
    if provider == "azure":
        return host == "dev.azure.com" or host.endswith(".visualstudio.com")
    from observability import _public_host

    return _public_host(host)


def clean_url(raw: str, provider: Optional[str] = None) -> tuple[str, Provider]:
    """URL https sin credenciales ni barra final. Lanza 422 si no corresponde a la plataforma elegida."""
    u = (raw or "").strip()
    if u.startswith("git@") and ":" in u:
        host, path = u[4:].split(":", 1)
        u = f"https://{host}/{path}"
    if not re.match(r"^https?://", u, re.I):
        u = "https://" + u
    p = urlparse(u)
    host = (p.hostname or "").lower()
    path = re.sub(r"/+$", "", p.path or "")
    if p.scheme.lower() != "https" or not host or path.count("/") < 2:
        raise HTTPException(status_code=422, detail="Escribe la dirección completa del repositorio, por ejemplo https://github.com/mi-org/mi-repo")
    prov: Provider = provider if provider in PROVIDER_NAME else detect_provider(u)  # type: ignore[assignment]
    if not _host_allowed(prov, host):
        if prov == "other" or prov == "gitlab":
            raise HTTPException(status_code=422, detail="Esa dirección no es pública. Solo podemos analizar repositorios accesibles desde internet.")
        raise HTTPException(status_code=422, detail=f"Esa dirección no es de {PROVIDER_NAME[prov]}. Revisa la URL o elige otra plataforma.")
    netloc = host if not p.port else f"{host}:{p.port}"
    return urlunparse(("https", netloc, path, "", "", "")), prov


# ---------------------------------------------------------------------------
# Cifrado del token
# ---------------------------------------------------------------------------


def _fernet() -> Fernet:
    seed = os.getenv("DATA_ENCRYPTION_KEY", "").strip() or os.getenv("SECRET_KEY", "").strip() or "sspillowy-local"
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(seed.encode()).digest()))


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode()).decode()
    except (InvalidToken, ValueError):
        return None


# ---------------------------------------------------------------------------
# Git
# ---------------------------------------------------------------------------


def authed_url(url: str, token: Optional[str], provider: Optional[str] = None) -> str:
    if not token:
        return url
    prov = provider if provider in _TOKEN_USER else detect_provider(url)
    p = urlparse(url)
    if p.username:
        return url
    netloc = f"{_TOKEN_USER[prov]}:{quote(token, safe='')}@{p.netloc}"
    return urlunparse((p.scheme, netloc, p.path, "", "", ""))


def git_env() -> dict:
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GCM_INTERACTIVE"] = "never"
    env.pop("GIT_ASKPASS", None)
    env.pop("SSH_ASKPASS", None)
    return env


GIT_SAFE = ["-c", "credential.helper=", "-c", "http.followRedirects=initial",
            "-c", "protocol.allow=never", "-c", "protocol.https.allow=always"]


def _owner_prefix(url: str) -> str:
    p = urlparse(url or "")
    parts = [seg for seg in (p.path or "").strip("/").split("/") if seg]
    if p.hostname and parts:
        return f"{p.hostname.lower()}/{parts[0].lower()}"
    return ""


def credentials_for(repo) -> tuple[Optional[str], Optional[str]]:
    """(token, plataforma) para clonar un repositorio."""
    token = decrypt(getattr(repo, "access_token_enc", None))
    provider = getattr(repo, "provider", None) or detect_provider(repo.url or "")
    if token:
        return token, provider

    # Reutilizar token de otro repo del mismo propietario Git o del mismo espacio
    try:
        from database import SessionLocal
        from models import Repository

        db = SessionLocal()
        try:
            owner_pref = _owner_prefix(getattr(repo, "url", "") or "")
            candidates = (
                db.query(Repository)
                .filter(Repository.access_token_enc.isnot(None))
                .all()
            )
            for cand in candidates:
                if cand.id == getattr(repo, "id", None):
                    continue
                if owner_pref and _owner_prefix(cand.url or "") == owner_pref:
                    tok = decrypt(cand.access_token_enc)
                    if tok:
                        return tok, provider
                if getattr(repo, "workspace_id", None) and cand.workspace_id == repo.workspace_id:
                    cand_prov = cand.provider or detect_provider(cand.url or "")
                    if cand_prov == provider:
                        tok = decrypt(cand.access_token_enc)
                        if tok:
                            return tok, provider
        finally:
            db.close()
    except Exception:
        pass

    if provider == "github":
        env_token = os.getenv("GITHUB_TOKEN", "").strip() or os.getenv("GH_TOKEN", "").strip()
        if env_token:
            return env_token, provider
    return None, provider


_platform_ws: Optional[str] = None


def _platform_workspace_id() -> Optional[str]:
    global _platform_ws
    if _platform_ws is None:
        from database import SessionLocal
        from workspaces import legacy_workspace_id

        db = SessionLocal()
        try:
            _platform_ws = legacy_workspace_id(db)
        except Exception:
            return None
        finally:
            db.close()
    return _platform_ws


@dataclass
class AccessResult:
    ok: bool
    reason: Literal["ok", "needs_token", "bad_token", "not_found", "unreachable"]
    default_branch: Optional[str] = None


def probe_access(url: str, token: Optional[str], provider: Optional[str]) -> AccessResult:
    prov = provider or detect_provider(url)
    target = authed_url(url, token, prov)
    try:
        proc = subprocess.run(
            ["git", *GIT_SAFE, "ls-remote", "--symref", target, "HEAD"],
            capture_output=True, text=True, timeout=25, env=git_env(),
        )
    except subprocess.TimeoutExpired:
        return AccessResult(False, "unreachable")
    except FileNotFoundError:
        return AccessResult(False, "unreachable")
    if proc.returncode == 0:
        m = re.search(r"ref:\s*refs/heads/(\S+)\s+HEAD", proc.stdout or "")
        return AccessResult(True, "ok", m.group(1) if m else None)
    if not token and prov == "github":
        env_token = os.getenv("GITHUB_TOKEN", "").strip() or os.getenv("GH_TOKEN", "").strip()
        if env_token:
            fallback_res = probe_access(url, env_token, prov)
            if fallback_res.ok:
                return fallback_res
    err = (proc.stderr or "").lower()
    denied = any(s in err for s in ("could not read username", "authentication failed", "403", "401",
                                    "repository not found", "not found", "access denied", "terminal prompts disabled"))
    if denied:
        return AccessResult(False, "bad_token" if token else "needs_token")
    if "could not resolve host" in err or "failed to connect" in err:
        return AccessResult(False, "unreachable")
    return AccessResult(False, "bad_token" if token else "not_found")


def access_message(res: AccessResult, provider: str) -> str:
    name = PROVIDER_NAME.get(provider, "la plataforma")
    return {
        "ok": "Tenemos acceso de lectura al repositorio.",
        "needs_token": f"No pudimos leerlo sin permiso: es privado o la URL no existe. Si es privado, crea un token de lectura en {name} y pégalo abajo.",
        "bad_token": "Con ese token no pudimos leer el repositorio. Revisa que tenga permiso de lectura sobre este repositorio y que no haya expirado.",
        "not_found": "No encontramos el repositorio. Revisa la URL.",
        "unreachable": f"No pudimos contactar con {name}. Revisa la URL o inténtalo de nuevo en un momento.",
    }[res.reason]


class AccessCheck(BaseModel):
    url: str
    provider: Optional[Provider] = None
    access_token: Optional[str] = None


@router.post("/check-access")
def check_access(body: AccessCheck, ws: WorkspaceCtx = Depends(require_ws_write)):
    url, provider = clean_url(body.url, body.provider)
    token = (body.access_token or "").strip() or None
    res = probe_access(url, token, provider)
    return {
        "ok": res.ok,
        "reason": res.reason,
        "message": access_message(res, provider),
        "url": url,
        "provider": provider,
        "default_branch": res.default_branch,
        "suggested_name": url.rstrip("/").split("/")[-1].removesuffix(".git"),
    }
