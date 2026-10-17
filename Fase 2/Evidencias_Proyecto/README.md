# Evidencias del proyecto — Fase 2

Evidencias de **documentación**, **aplicación** y **base de datos** del producto SSPILLOWY, con enlaces al sistema en producción y al código.

## Enlaces al producto (SSPILLOWY)

| Recurso | URL |
|---------|-----|
| Código (monorepo) | https://github.com/SebaNimono/sspillowy |
| Consola web | https://sspillowy.com |
| API | https://api.sspillowy.com |
| Health API | https://api.sspillowy.com/health |
| CI Security Gate | https://github.com/SebaNimono/sspillowy/blob/main/.github/workflows/security-gate.yml |

Stack: React/Vite (Vercel) · FastAPI (Railway) · PostgreSQL · Semgrep / GitLeaks / Trivy / ZAP.

## Contenido de esta carpeta

```
Evidencias_Proyecto/
├── Documentacion/          ← diccionario de datos, documento técnico
└── Sistema/
    ├── Aplicacion/         ← capturas del hub y herramientas
    └── Base_de_datos/      ← diccionario / esquema PostgreSQL
```

### Documentación

- `Documentacion/SSPILLOWY_Documento_Tecnico.docx`
- `Documentacion/06_Diccionario_Datos_SSPILLOWY.docx`

### Sistema — Aplicación

Capturas del hub en uso:

| Archivo | Qué muestra |
|---------|-------------|
| `01_dashboard.png` | Dashboard / Risk Posture |
| `02_repositorios.png` | Repositorios monitoreados |
| `03_security_gates.png` | Security Gates & reglas CI/CD |
| `04_jira_backlog.png` | Backlog en Jira |
| `05_confluence_espacio.png` | Espacio Confluence del proyecto |

### Sistema — Base de datos

- `Base_de_datos/06_Diccionario_Datos_SSPILLOWY.docx` — diccionario de datos PostgreSQL (Railway)

## Presentación

Las PPT de avance/exposición están en [Evidencias_Grupales](../Evidencias_Grupales/) (`Avance_Proyecto_APT.pptx` y `Presentacion_Proyecto_SSPILLOWY_Fase2.pptx`).
