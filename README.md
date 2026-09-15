# SSPILLOWY

**Software Security Platform for Intelligent, Low-latency Oversight & Warning Yield**

Hub web DevSecOps: escaneo multi-motor, hallazgos, Security Gate y CI. Pulse (móvil) es un producto aparte.

## Monorepo

| Ruta | Rol |
|------|-----|
| `apps/api` | FastAPI · Semgrep, GitLeaks, Trivy, ZAP baseline · gates · webhooks |
| `apps/web` | Consola React (Vite) en Vercel |
| `packages/core_models` | Esquemas Pydantic compartidos |
| `.github/workflows/security-gate.yml` | Check CI que consulta el gate |

## URLs de producción

- Consola: `https://sspillowy.com`
- API: `https://api.sspillowy.com`
- Health: `https://api.sspillowy.com/health`

## Arranque local (resumen)

```bash
# API
cd apps/api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Web
cd apps/web
npm install
npm run dev
```

Copia `.env.example` → `.env` en la raíz del monorepo.

---

## Operación del hub

### 1. Variables clave (Railway / API)

| Variable | Para qué |
|----------|----------|
| `DATABASE_URL` | Postgres (Supabase/Railway) |
| `FRONTEND_URL` | `https://sspillowy.com` |
| `API_PUBLIC_URL` | `https://api.sspillowy.com` |
| `GITHUB_TOKEN` | Clonar repos (privados o rate-limit anónimo) |
| `GITHUB_WEBHOOK_SECRET` | Firma HMAC del webhook GitHub |
| `WEBHOOK_SCAN_ENGINES` | Ej. `semgrep,gitleaks,trivy` |
| `RESEND_API_KEY` + `EMAIL_FROM` | Correos (verificación + alertas) |
| `SECURITY_ALERT_EMAILS` | Destinatarios de GATE_BLOCK / secretos (coma) |
| `HUB_AUTH_MODE` | `writes` (default) · `all` · `off` |
| `GEMINI_API_KEY` | Pillow (chat dashboard) |
| OAuth `*_CLIENT_ID/SECRET` + `*_REDIRECT_URI` | Login GitHub/Google/… |

`GITHUB_TOKEN`: Classic PAT con `public_repo` (o `repo` si hay privados). Fine-grained: Contents Read.

### 2. Vercel (web)

- `VITE_API_URL=https://api.sspillowy.com`
- Redeploy tras cambiar variables

### 3. Webhook GitHub (scan automático)

1. Railway → `GITHUB_WEBHOOK_SECRET` = string largo aleatorio  
2. GitHub → Settings → Webhooks → Add webhook  
   - Payload URL: `https://api.sspillowy.com/api/v1/webhooks/github`  
   - Content type: `application/json`  
   - Secret: el mismo valor  
   - Events: **Push** + **Pull requests**  
3. Registrar el repo en la consola SSPILLOWY con la **misma** URL de GitHub  

Comprobar: `GET /api/v1/webhooks/github/info`

### 4. Security Gate + CI

Tras cada scan el hub evalúa la política (`default-policy`).

Check manual / CI:

```text
GET /api/v1/security-gates/check?repository_url=https://github.com/ORG/REPO
```

JSON relevante: `allowed` (`true`/`false`), `decision`, `summary`.

El workflow `.github/workflows/security-gate.yml` falla el job si `allowed` no es `true`.

Opcional en el repo de GitHub: variable `SSPILLOWY_API_URL` (default `https://api.sspillowy.com`).

### 5. Alertas email

Con Resend/SMTP configurado, al cerrar un scan:

- Gate **BLOCKED**, o  
- Secretos GitLeaks abiertos con política `block_on_secrets`

se envía correo a `SECURITY_ALERT_EMAILS` (si vacío, a `PILLOW_ADMIN_EMAILS`).

### 5b. Bypass CISO (hub)

En **Security Gates** puedes solicitar / aprobar / rechazar una excepción temporal.
Si hay bypass `APPROVED` vigente, el check CI responde `allowed=true` con decisión `BYPASSED`.
Aprueban los correos en `PILLOW_ADMIN_EMAILS` / `SECURITY_ALERT_EMAILS` (si la lista está vacía, cualquier sesión autenticada puede aprobar en demo).

### 6. Auth del hub

El front guarda `sspillowy_session` y envía `X-Session-Id` en las llamadas API.

| `HUB_AUTH_MODE` | Comportamiento |
|-----------------|----------------|
| `writes` (default) | Mutaciones (crear repo, scan, triage, seed…) requieren sesión |
| `all` | Toda la API de negocio (excepto health, auth, webhook y gate check CI) |
| `off` | Sin exigir sesión (solo demos locales) |

El endpoint de CI `GET /security-gates/check` y el webhook GitHub **siempre** son públicos (el webhook valida firma HMAC).

### 7. Motores de escaneo

- Semgrep / GitLeaks / Trivy: en la imagen Docker de la API  
- OWASP ZAP: por defecto **baseline-lite**; ZAP full solo si instalas el binario y defines `ZAP_SH`  
- Fixture demo: `SEMGREP_FALLBACK_FIXTURE=false` en producción (evita falsos hallazgos que bloquean el gate)

Progreso en vivo: el scan expone `progress_stage` / `progress_detail` (cloning → motores → gate).

---

## Comandos útiles

```bash
# Health
curl -fsS https://api.sspillowy.com/health

# Gate de un repo
curl -fsS "https://api.sspillowy.com/api/v1/security-gates/check?repository_url=https%3A%2F%2Fgithub.com%2FORG%2FREPO"

# Seed demo (requiere sesión si HUB_AUTH_MODE≠off)
curl -X POST https://api.sspillowy.com/api/v1/admin/seed -H "X-Session-Id: TU_SESSION"
```
