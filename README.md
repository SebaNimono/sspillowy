# SSPILLOWY

**Software Security Platform for Intelligent, Low-latency Oversight & Warning Yield**

Plataforma integral de gobernanza DevSecOps y orquestación de seguridad de software con triaje asistido por IA y centro de comando móvil.

## Estructura del Monorepo

- `apps/api`: Backend Core en FastAPI (Python 3.12).
- `apps/worker`: Adaptadores de escaneo asíncrono (Trivy, Semgrep, GitLeaks, OWASP ZAP) con ARQ y Redis.
- `apps/web`: Consola analítica Web para auditoría y triaje.
- `apps/mobile`: Aplicación móvil SSPILLOWY Pulse (Flutter).
- `packages/core-models`: Esquemas de datos compartidos y definiciones Pydantic.
- `infra/`: Configuración de Docker Compose, Prometheus y Grafana.