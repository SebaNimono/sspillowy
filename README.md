# SSPILLOWY — Open Source DevSecOps Governance & Security Gate Platform

**Software Security Platform for Intelligent, Low-latency Oversight & Warning Yield**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Open Source](https://img.shields.io/badge/Open%20Source-100%25-0969da.svg)](https://github.com/SebaNimono/sspillowy)
[![Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20Flutter%20%7C%20PostgreSQL-8250df.svg)](https://sspillowy.com)

**SSPILLOWY** es una plataforma **DevSecOps Open Source (Licencia MIT)** diseñada para centralizar, automatizar y gobernar la seguridad de software de extremo a extremo. A diferencia de soluciones privativas de código cerrado, SSPILLOWY es completamente transparente, auditable y auto-alojable (*self-hosted*), permitiendo que cualquier equipo integre escaneo multi-motor, bloqueo preventivo en CI/CD (*Security Gates*), triaje asistido por IA con validación humana, gobernanza móvil (**Pulse**) y **observabilidad continua** post-despliegue.

---

## Tabla de contenidos

- [Por qué SSPILLOWY (Filosofía Open Source)](#por-qué-sspillowy-filosofía-open-source)
- [Capacidades principales](#capacidades-principales)
- [Arquitectura y estructura del Monorepo](#arquitectura-y-estructura-del-monorepo)
- [Observabilidad continua post-despliegue](#observabilidad-continua-post-despliegue)
- [URLs de producción](#urls-de-producción)
- [Arranque local paso a paso](#arranque-local-paso-a-paso)
- [Operación y configuración del Hub](#operación-y-configuración-del-hub)
- [Comandos útiles](#comandos-útiles)
- [Licencia](#licencia)

---

## Por qué SSPILLOWY (Filosofía Open Source)

Construimos **SSPILLOWY** como una herramienta **abierta y comunitaria bajo licencia MIT** porque la seguridad del software no debería ser una caja negra ni estar restringida a grandes presupuestos corporativos:

1. **Transparencia total:** Todo el código de orquestación, las reglas de evaluación del *Security Gate*, el cálculo de prioridad (*Fix Intelligence*) y los prompts de triaje están abiertos y auditables en este repositorio.
2. **Estándares abiertos y sin *vendor lock-in*:** Integramos motores líderes del ecosistema Open Source (**Semgrep**, **GitLeaks**, **Trivy** y **OWASP ZAP**), exportamos inventario de dependencias (SBOM) y exponemos métricas en formato estándar **Prometheus**.
3. **Listo para producción o auto-alojamiento (*Self-Hosted*):** Se puede desplegar en minutos usando contenedores Docker o en plataformas cloud modernas (Railway, Vercel, GitHub Actions).

---

## Capacidades principales

- **Escaneo Multi-Motor Unificado:**
  - **SAST (Semgrep):** Análisis estático de código fuente multilinguaje.
  - **Secretos (GitLeaks):** Detección temprana de credenciales, llaves API y tokens expuestos.
  - **SCA / IaC / SBOM (Trivy):** Vulnerabilidades (CVEs) en dependencias y configuraciones de infraestructura.
  - **DAST (OWASP ZAP):** Inspección dinámica de cabeceras y superficie web en ejecución.
- **Security Gates en CI/CD:** Evaluación automática contra políticas personalizables (máximo de críticas/altas permitidas y bloqueo inmediato ante secretos expuestos), bloqueando o aprobando *Pull Requests* en GitHub Actions.
- **Triaje Asistido por IA (Pillow) con *Human-in-the-Loop*:** Clasificación inteligente de hallazgos (*Likely Real*, *Needs Review*, *Likely False Positive*) y sugerencias de remediación que siempre requieren confirmación humana antes de alterar el estado oficial.
- **Deduplicación y Trazabilidad Inmutable:** Huella única (*fingerprint*) por hallazgo para evitar duplicados entre escaneos, conservando línea de tiempo completa de detecciones, reaperturas y decisiones.
- **App Móvil SSPILLOWY Pulse (Flutter):** Alertas push en tiempo real ante bloqueos críticos y autorización de excepciones temporales (*CISO Bypass*) con verificación biométrica (huella o rostro).
- **Soporte Multi-Workspace e Internacionalización (i18n):** Aislamiento de repositorios, políticas y credenciales por espacio de trabajo, con interfaz disponible en Español, Inglés, Portugués y Francés.

---

## Arquitectura y estructura del Monorepo

```text
[ GitHub Push / PR ] ──(Webhook HMAC)──► [ API FastAPI (apps/api) ]
                                                  │
                       ┌──────────────────────────┼──────────────────────────┐
                       ▼                          ▼                          ▼
          [ Motores de Análisis ]      [ PostgreSQL 16 (22 tablas) ]   [ Observabilidad ]
       Semgrep | GitLeaks | Trivy | ZAP    Hallazgos + Trazabilidad    /metrics + /health
                       │                          │                          │
                       └──────────────────────────┼──────────────────────────┘
                                                  ▼
                                    [ Evaluación Security Gate ]
                                                  │
                  ┌───────────────────────────────┼───────────────────────────────┐
                  ▼                               ▼                               ▼
       [ Consola Web (apps/web) ]      [ GitHub Actions CI ]           [ App Móvil Pulse ]
         Triaje, Fix Intel,             Aprueba o bloquea               Alertas Push +
         Dashboards y Reportes          el pipeline CI/CD               Bypass Biométrico
```

| Ruta | Rol dentro del monorepo |
| --- | --- |
| `apps/api` | Backend en **FastAPI (Python 3.11+)** · Orquestación de Semgrep, GitLeaks, Trivy y ZAP · Evaluación de Security Gates · Webhooks HMAC · Triaje IA Pillow · Métricas Prometheus |
| `apps/web` | Consola Web en **React 18 + Vite + TypeScript** · Dashboards de riesgo, velocidad, hallazgos, SBOM, secretos, trazabilidad y observabilidad |
| `packages/core_models` | Esquemas y contratos **Pydantic** compartidos |
| `.github/workflows/security-gate.yml` | Workflow de integración continua que consulta el *Security Gate* del Hub y bloquea el pipeline si no cumple la política |
| `docker-compose.yml` | Orquestación local de base de datos PostgreSQL y servicios |

---

## Observabilidad continua post-despliegue

Una vez puesto en marcha cualquier proyecto en producción, **la observabilidad es fundamental** para garantizar su fiabilidad operativa y diagnosticar incidentes a tiempo. En SSPILLOWY integramos observabilidad nativa en tres niveles:

1. **Estado de salud por componente (`GET /health`):** Verifica en tiempo real la conexión a PostgreSQL y la disponibilidad de cada binario de análisis dentro del entorno de ejecución.
2. **Métricas operativas (`GET /metrics`):** Exportación compatible con **Prometheus** y **Grafana Cloud** para monitorear volumen de escaneos, latencia por motor, tasa de bloqueos del *Security Gate* y distribución de severidades.
3. **Telemetría de ejecución y módulo visual de Observabilidad:** Seguimiento en vivo por etapas (`queued` → `cloning` → `semgrep` → `gitleaks` → `trivy` → `owasp_zap` → `gate`) con diagnóstico detallado de errores y panel dedicado dentro de la consola web.

---

## URLs de producción

- **Consola Web Hub:** [https://sspillowy.com](https://sspillowy.com)
- **API Pública:** [https://api.sspillowy.com](https://api.sspillowy.com)
- **Health Check:** [https://api.sspillowy.com/health](https://api.sspillowy.com/health)
- **Documentación Académica y Gestión Ágil (Capstone):** [https://github.com/SebaNimono/capstone_2026_duoc_alameda_grupo5](https://github.com/SebaNimono/capstone_2026_duoc_alameda_grupo5)

---

## Arranque local paso a paso

1. **Clonar el repositorio y configurar variables de entorno:**
   ```bash
   git clone https://github.com/SebaNimono/sspillowy.git
   cd sspillowy
   cp .env.example .env
   ```

2. **Levantar la API (FastAPI):**
   ```bash
   cd apps/api
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

3. **Levantar la Consola Web (React + Vite):**
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

4. **Opcional — Levantar con Docker Compose:**
   ```bash
   docker compose up -d --build
   ```

---

## Operación y configuración del Hub

### 1. Variables clave (Railway / API)

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL 16 (Railway / Supabase / Local) |
| `FRONTEND_URL` | Origen permitido de la consola web (`https://sspillowy.com`) |
| `API_PUBLIC_URL` | URL pública de la API (`https://api.sspillowy.com`) |
| `GITHUB_TOKEN` | PAT para clonar repositorios privados o evitar límites de tasa anónimos |
| `GITHUB_WEBHOOK_SECRET` | Secreto compartido para validar la firma HMAC-SHA256 del webhook de GitHub |
| `WEBHOOK_SCAN_ENGINES` | Motores por defecto al recibir un push/PR (ej. `semgrep,gitleaks,trivy`) |
| `RESEND_API_KEY` + `EMAIL_FROM` | Envío de correos de verificación y alertas de seguridad |
| `SECURITY_ALERT_EMAILS` | Destinatarios de alertas por bloqueo de gate o secretos expuestos (separados por coma) |
| `HUB_AUTH_MODE` | `writes` (por defecto) · `all` · `off` |
| `GEMINI_API_KEY` | Clave para el asistente IA **Pillow** (incluye modo *fallback* determinista si no se configura) |
| OAuth `*_CLIENT_ID/SECRET` + `*_REDIRECT_URI` | Inicio de sesión federado con GitHub / Google |

### 2. Configuración en Vercel (Web)

- Definir `VITE_API_URL=https://api.sspillowy.com` y desplegar la aplicación desde `apps/web`.

### 3. Webhook de GitHub (escaneo automático en Push / PR)

1. Definir `GITHUB_WEBHOOK_SECRET` en la API (o usar el secreto único por *workspace* desde la consola).
2. En el repositorio de GitHub → **Settings** → **Webhooks** → **Add webhook**:
   - **Payload URL:** `https://api.sspillowy.com/api/v1/webhooks/github`
   - **Content type:** `application/json`
   - **Secret:** el mismo valor configurado
   - **Events:** *Push* y *Pull requests*
3. Registrar el repositorio en la consola de SSPILLOWY con la misma URL de GitHub.

### 4. Security Gate + GitHub Actions CI

Tras cada escaneo, el Hub evalúa la política activa del repositorio. Para verificar el estado desde un pipeline CI/CD:

```text
GET /api/v1/security-gates/check?repository_url=https://github.com/ORG/REPO
```

La respuesta JSON incluye `allowed` (`true`/`false`), `decision` (`PASSED`, `BLOCKED`, `BYPASSED`) y `summary`. El workflow [`.github/workflows/security-gate.yml`](./.github/workflows/security-gate.yml) detiene automáticamente el pipeline si `allowed` no es `true`.

### 5. Excepciones y Bypass CISO (Web Hub y App Móvil Pulse)

Desde la vista **Security Gates** o desde la app móvil **Pulse**, se puede solicitar, aprobar o rechazar una excepción temporal (*bypass*) justificada. Cuando existe un bypass aprobado y vigente, el check de CI responde `allowed=true` con decisión `BYPASSED`, dejando trazabilidad completa en la bitácora de auditoría.

### 6. Autenticación del Hub

El frontend envía la cabecera `X-Session-Id` en cada petición:

| `HUB_AUTH_MODE` | Comportamiento |
| --- | --- |
| `writes` (default) | Las mutaciones (crear repositorio, lanzar escaneo, triaje, configurar gates) requieren sesión activa |
| `all` | Toda la API requiere sesión (excepto `/health`, `/auth`, webhook HMAC y el check público de CI) |
| `off` | Modo abierto para pruebas o demostraciones locales |

---

## Comandos útiles

```bash
# Verificar estado de salud de la API y motores
curl -fsS https://api.sspillowy.com/health

# Consultar el Security Gate de un repositorio desde terminal o CI
curl -fsS "https://api.sspillowy.com/api/v1/security-gates/check?repository_url=https%3A%2F%2Fgithub.com%2FSebaNimono%2Fsspillowy"

# Cargar datos de demostración (requiere sesión activa si HUB_AUTH_MODE != off)
curl -X POST https://api.sspillowy.com/api/v1/admin/seed -H "X-Session-Id: TU_SESSION"
```

---

## Licencia

Distribuido bajo la **Licencia MIT**. Consulta el archivo [LICENSE](./LICENSE) para más información.
