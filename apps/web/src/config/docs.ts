export type DocBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: { title: string; text: string }[] }
  | { type: 'code'; title?: string; code: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'callout'; tone: 'info' | 'warn' | 'tip'; text: string }
  | { type: 'goto'; tab: string; label: string };

export interface DocSection {
  id: string;
  group: string;
  title: string;
  summary: string;
  blocks: DocBlock[];
}

export const DOC_GROUPS = ['Empezar', 'Cómo funciona', 'Gobernanza', 'Integraciones', 'Referencia'] as const;

export const GLOSSARY_SECTION_ID = 'glosario';

export const DOC_SECTIONS: DocSection[] = [
  // ───────────────────────── Empezar
  {
    id: 'intro',
    group: 'Empezar',
    title: '¿Qué es SSPILLOWY?',
    summary: 'Plataforma DevSecOps que orquesta escáneres open source, unifica sus hallazgos y gobierna el despliegue.',
    blocks: [
      {
        type: 'p',
        text: 'SSPILLOWY (Software Security Platform for Intelligent, Low-latency Oversight & Warning Yield) centraliza la seguridad del software de un equipo. Conecta repositorios, ejecuta varios motores de análisis, normaliza sus resultados en un único modelo de hallazgo y decide, mediante un Security Gate, si un cambio puede desplegarse.',
      },
      { type: 'h', text: 'El principio: detecta, propone, firma' },
      {
        type: 'table',
        head: ['Rol', 'Quién', 'Qué hace', 'Qué nunca hace'],
        rows: [
          ['Detecta', 'Motores OSS (Semgrep, Trivy, GitLeaks, ZAP)', 'Encuentran problemas de forma determinista', 'Interpretar o priorizar'],
          ['Propone', 'Asistente IA (Pillow)', 'Explica, resume y sugiere remediación', 'Cerrar o abrir hallazgos'],
          ['Firma', 'Auditor humano (HITL)', 'Cambia el estado del hallazgo y aprueba excepciones', '—'],
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Esta separación es el núcleo del producto: los motores no "alucinan" y la IA no toma decisiones. Toda decisión queda registrada en la bitácora con quién la tomó.',
      },
      { type: 'h', text: 'Módulos del hub' },
      {
        type: 'table',
        head: ['Módulo', 'Para qué sirve'],
        rows: [
          ['Dashboards', 'Postura de seguridad en tiempo real: KPIs, tendencias, SLA, gates y actividad.'],
          ['Repositorios', 'Registrar repos, lanzar escaneos con perfiles y configurar el webhook.'],
          ['Matriz de hallazgos', 'Triage HITL: filtrar, agrupar y cambiar el estado de los hallazgos.'],
          ['Escaneos', 'Historial de ejecuciones con su progreso, motores y decisión del gate.'],
          ['Security Gates', 'Política de bloqueo (umbrales) y solicitudes de bypass.'],
          ['Notificaciones', 'Alertas de hallazgos críticos, secretos y altos recientes.'],
          ['Informes ISO 27001', 'Estado de los controles del Anexo A con evidencia.'],
        ],
      },
      { type: 'h', text: 'Pulse (móvil)' },
      {
        type: 'p',
        text: 'Pulse es la app móvil complementaria: recibe push ante un hallazgo crítico o un secreto y permite aprobar un bypass con biometría. Se construye en paralelo; el hub ya expone los endpoints que usará.',
      },
    ],
  },
  {
    id: 'quickstart',
    group: 'Empezar',
    title: 'Primeros pasos',
    summary: 'De cero a tu primer escaneo y tu primera decisión del gate en cinco pasos.',
    blocks: [
      {
        type: 'steps',
        items: [
          {
            title: 'Inicia sesión',
            text: 'Entra con GitHub, GitLab, Google, Microsoft o con correo y contraseña (requiere verificar el correo). El primer inicio de sesión crea la cuenta. Sin sesión puedes ver datos, pero no modificarlos.',
          },
          {
            title: 'Registra un repositorio',
            text: 'En Repositorios → "Nuevo Repositorio" indica nombre, URL de Git y rama. Si es privado, el servidor necesita un GITHUB_TOKEN con acceso de lectura. Opcional: una URL desplegada para DAST.',
          },
          {
            title: 'Lanza un escaneo',
            text: 'Pulsa "Escanear" y elige un perfil. Para una primera revisión usa "Código completo" (Semgrep + GitLeaks + Trivy). El progreso se ve en vivo en la tarjeta y en Escaneos.',
          },
          {
            title: 'Revisa la matriz',
            text: 'En la Matriz de hallazgos verás los resultados agrupados por paquete o regla. Empieza por los críticos y por los que tienen el plazo vencido.',
          },
          {
            title: 'Decide',
            text: 'Para cada hallazgo o grupo: pásalo a En revisión, márcalo como Corregido, Falso positivo o Riesgo aceptado. El gate se recalcula con los hallazgos que siguen activos.',
          },
        ],
      },
      { type: 'goto', tab: 'repositories', label: 'Ir a Repositorios' },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Para probar que la detección funciona, registra un repositorio intencionalmente vulnerable (por ejemplo repositorio_test / VulnShop): debería aparecer inyección SQL, secretos de prueba y dependencias con CVE.',
      },
    ],
  },
  {
    id: 'arquitectura',
    group: 'Empezar',
    title: 'Arquitectura',
    summary: 'Componentes, despliegue y cómo viaja un dato desde el repositorio hasta el dashboard.',
    blocks: [
      {
        type: 'table',
        head: ['Componente', 'Tecnología', 'Despliegue'],
        rows: [
          ['Web Hub', 'React + TypeScript + Vite, Recharts, Framer Motion', 'Vercel'],
          ['API', 'FastAPI (Python 3.12), SQLAlchemy 2.0', 'Railway (Docker)'],
          ['Base de datos', 'PostgreSQL 16 (driver psycopg2)', 'Railway'],
          ['Motores', 'Semgrep, Trivy, GitLeaks, OWASP ZAP', 'Dentro del contenedor de la API'],
          ['Correo', 'Verificación de cuenta, recuperación de clave y alertas de gate', 'SMTP'],
          ['IA', 'Pillow (Gemini) con créditos diarios', 'API externa'],
          ['Móvil', 'Pulse (Flutter)', 'En construcción'],
        ],
      },
      { type: 'h', text: 'Flujo de datos' },
      {
        type: 'list',
        items: [
          'Un push, un pull request o un clic en el hub crea un escaneo en estado RUNNING.',
          'Una tarea en segundo plano clona el repositorio y ejecuta los motores elegidos.',
          'Cada salida se normaliza a un hallazgo común: severidad, archivo, línea, CWE, control ISO y remediación.',
          'Se evalúa el Security Gate y se guarda la decisión en el escaneo y en la bitácora.',
          'El hub consulta la API (stats, findings, scans, heatmap, audit-log) y dibuja los dashboards.',
        ],
      },
      { type: 'h', text: 'Autenticación' },
      {
        type: 'p',
        text: 'Con HUB_AUTH_MODE=writes las lecturas son públicas y toda escritura (crear repo, escanear, cambiar estados, editar la política) requiere una sesión válida enviada en la cabecera X-Session-Id. El endpoint de verificación del gate es público para que los pipelines puedan consultarlo.',
      },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Si la API no logra conectarse a PostgreSQL arranca en SQLite vacío. El endpoint /health lo indica como "degraded": revísalo si los datos "desaparecen" tras un despliegue.',
      },
    ],
  },

  // ───────────────────────── Cómo funciona
  {
    id: 'ciclo-escaneo',
    group: 'Cómo funciona',
    title: 'Ciclo de un escaneo',
    summary: 'Qué ocurre, etapa por etapa, desde que se dispara un escaneo hasta la decisión del gate.',
    blocks: [
      {
        type: 'steps',
        items: [
          { title: 'En cola (queued)', text: 'Se crea el registro del escaneo con la rama y los motores. Se anota SCAN_TRIGGERED en la bitácora.' },
          { title: 'Clonado (cloning)', text: 'Se clona el repositorio en un directorio temporal. Si falla (URL incorrecta, repo privado sin token) el escaneo termina como FAILED.' },
          { title: 'Motores (semgrep, gitleaks, trivy, owasp_zap)', text: 'Cada motor corre por separado. Si uno falla, los demás continúan y el error queda en el detalle.' },
          { title: 'Normalización', text: 'Los resultados se convierten al modelo común y se guardan con el escaneo y el repositorio.' },
          { title: 'Reemplazo (supersede)', text: 'Los hallazgos activos de escaneos anteriores, de los mismos motores, pasan a SUPERSEDED. Así un re-escaneo no duplica la matriz.' },
          { title: 'Contadores y health score', text: 'Se recalculan críticos, altos, total activo y el health score del repositorio.' },
          { title: 'Security Gate (gate)', text: 'Se evalúa la política sobre los hallazgos activos del repo. Resultado: PASSED, BLOCKED, BYPASSED o SKIPPED si la política está deshabilitada.' },
          { title: 'Alerta', text: 'Si el gate bloquea, se envía un correo a SECURITY_ALERT_EMAILS y se registra SECURITY_ALERT_SENT.' },
          { title: 'Fin (done)', text: 'El escaneo queda COMPLETED con sus conteos por severidad.' },
        ],
      },
      { type: 'h', text: 'Perfiles de escaneo' },
      {
        type: 'table',
        head: ['Perfil', 'Motores', 'Cuándo usarlo'],
        rows: [
          ['CI rápido', 'Semgrep + GitLeaks', 'En cada pull request; es el más rápido'],
          ['Código completo', 'Semgrep + GitLeaks + Trivy', 'Revisión completa del código y dependencias'],
          ['Solo SAST', 'Semgrep', 'Validar un cambio de código puntual'],
          ['Solo secretos', 'GitLeaks', 'Después de rotar credenciales'],
          ['Solo SCA / IaC', 'Trivy', 'Después de actualizar dependencias'],
          ['Solo DAST', 'OWASP ZAP', 'Contra una URL ya desplegada'],
          ['Full stack', 'Los cuatro', 'Auditoría completa (más lento)'],
        ],
      },
      { type: 'h', text: 'Qué se excluye' },
      {
        type: 'p',
        text: 'Para no reportar laboratorios ni código de terceros se ignoran: fixtures, vuln_sample, node_modules, defectdojo, mockup_movil, ppt, build y dist.',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Un escaneo que lleva más de STALE_SCAN_MINUTES (20 por defecto) en RUNNING se marca como fallido automáticamente, para que no quede colgado si el contenedor se reinicia.',
      },
      { type: 'goto', tab: 'scans', label: 'Ver Escaneos' },
    ],
  },
  {
    id: 'motores',
    group: 'Cómo funciona',
    title: 'Motores de análisis',
    summary: 'Qué detecta cada motor, cómo está configurado y a qué control ISO se asocia.',
    blocks: [
      { type: 'h', text: 'Semgrep · SAST' },
      {
        type: 'p',
        text: 'Analiza el código fuente buscando patrones inseguros sobre el árbol sintáctico. Usa los rulesets de SEMGREP_CONFIG (por defecto p/ci y p/owasp-top-ten) y guarda hasta SEMGREP_MAX_FINDINGS (200).',
      },
      { type: 'list', items: ['Inyección SQL y de comandos', 'eval/exec, deserialización insegura (pickle, yaml.load)', 'SSRF, SSTI, debug activado, hashes débiles (MD5)', 'Control ISO: A.8.28 Codificación segura'] },
      { type: 'h', text: 'Trivy · SCA e IaC' },
      {
        type: 'p',
        text: 'Revisa dependencias (requirements.txt, package-lock.json, etc.), configuraciones de infraestructura (Dockerfile, Kubernetes, Terraform) y secretos, según TRIVY_SCANNERS. Ordena por severidad antes de aplicar el tope TRIVY_MAX_FINDINGS (300), así nunca se pierde un crítico por el límite.',
      },
      { type: 'list', items: ['Un hallazgo por cada CVE de cada paquete', 'Indica la versión que corrige', 'Control ISO: A.8.8 Gestión de vulnerabilidades técnicas'] },
      { type: 'h', text: 'GitLeaks · Secretos' },
      {
        type: 'p',
        text: 'Busca credenciales con las reglas por defecto (AWS, GitHub, Stripe, claves privadas, alta entropía…) más una lista de rutas excluidas. El valor del secreto se enmascara antes de guardarse. Tope: GITLEAKS_MAX_FINDINGS (100).',
      },
      { type: 'list', items: ['Un secreto abierto bloquea el gate si la política tiene "bloquear secretos"', 'Controles ISO: A.8.3 Protección de la información y A.8.5 Autenticación segura'] },
      { type: 'h', text: 'OWASP ZAP · DAST' },
      {
        type: 'p',
        text: 'Analiza una aplicación en ejecución: cabeceras de seguridad, cookies, rutas expuestas. Usa la URL DAST del repositorio o, si no hay, ZAP_DEFAULT_TARGET. Corre en modo liviano para no sobrecargar el contenedor. Tope: ZAP_MAX_FINDINGS (40).',
      },
      { type: 'list', items: ['Control ISO: A.8.9 Gestión de configuración'] },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Si en Railway existen variables antiguas como TRIVY_MAX_FINDINGS=40 o SEMGREP_CONFIG=p/ci, tienen prioridad sobre los valores por defecto y reducen lo que se detecta.',
      },
    ],
  },
  {
    id: 'matriz',
    group: 'Cómo funciona',
    title: 'Matriz de hallazgos',
    summary: 'Cómo leer, filtrar, agrupar y triar los hallazgos.',
    blocks: [
      { type: 'h', text: 'Resumen superior' },
      {
        type: 'p',
        text: 'Las tarjetas muestran los activos por severidad, los que están fuera de plazo y los que tienen parche disponible. Al hacer clic en una tarjeta se filtra la tabla.',
      },
      { type: 'h', text: 'Vista agrupada y vista lista' },
      {
        type: 'list',
        items: [
          'Agrupada (por defecto): los CVE de Trivy se agrupan por paquete@versión y el resto por regla. Un grupo como "Pillow 6.2.0 · 30 hallazgos · actualizar a 10.2.0" se resuelve con una sola acción.',
          'Lista: un hallazgo por fila, con paginación de 50.',
        ],
      },
      { type: 'h', text: 'Filtros' },
      { type: 'p', text: 'Búsqueda libre (título, archivo, CVE, regla), repositorio, motor y estado. Por defecto se muestran solo los activos (Abierto y En revisión).' },
      { type: 'h', text: 'Estados y transiciones' },
      {
        type: 'table',
        head: ['Estado', 'Significado', '¿Cuenta para el gate?'],
        rows: [
          ['OPEN · Abierto', 'Recién detectado, sin revisar', 'Sí'],
          ['IN_REVIEW · En revisión', 'Alguien lo está analizando', 'Sí'],
          ['FIXED · Corregido', 'Se corrigió en el código', 'No'],
          ['FALSE_POSITIVE · Falso positivo', 'No es una vulnerabilidad real en este contexto', 'No'],
          ['ACCEPTED_RISK · Riesgo aceptado', 'Real, pero se asume conscientemente', 'No'],
          ['SUPERSEDED · Reemplazado', 'Sustituido por un escaneo más reciente', 'No'],
        ],
      },
      { type: 'h', text: 'Plazos de corrección (SLA)' },
      {
        type: 'table',
        head: ['Severidad', 'Plazo', 'Estado del badge'],
        rows: [
          ['Crítico', '7 días', 'En plazo → Por vencer (último 25 %) → Vencido'],
          ['Alto', '30 días', 'Ídem'],
          ['Medio', '90 días', 'Ídem'],
          ['Bajo', '180 días', 'Ídem'],
          ['Info', '365 días', 'Ídem'],
        ],
      },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Acciones masivas: dentro de un grupo puedes cambiar el estado de todos sus hallazgos a la vez. Si alguno falla, se informa cuántos se actualizaron y cuántos no.',
      },
      { type: 'goto', tab: 'findings', label: 'Abrir la Matriz' },
    ],
  },
  {
    id: 'dashboards',
    group: 'Cómo funciona',
    title: 'Dashboards y widgets',
    summary: 'Qué mide cada KPI y cada widget, inspirados en DefectDojo y Datadog.',
    blocks: [
      { type: 'h', text: 'Barra de herramientas' },
      { type: 'list', items: ['Rango: 7, 30 o 90 días (se recuerda en el navegador).', 'Actualizar: recarga todos los datos.', 'En vivo: refresca automáticamente cada 60 segundos.', 'Configurar: mostrar u ocultar widgets y ajustar umbrales.'] },
      { type: 'h', text: 'KPIs' },
      {
        type: 'table',
        head: ['KPI', 'Cálculo'],
        rows: [
          ['Hallazgos activos', 'Abiertos + En revisión, con variación respecto al periodo anterior'],
          ['Críticos activos', 'Activos de severidad crítica'],
          ['Fuera de plazo', 'Activos con el SLA vencido'],
          ['Gate aprobado', '(PASSED + BYPASSED) / escaneos evaluados en el rango'],
          ['Escaneos', 'Escaneos ejecutados en el rango'],
        ],
      },
      { type: 'h', text: 'Widgets' },
      {
        type: 'table',
        head: ['Widget', 'Qué responde'],
        rows: [
          ['Tendencia por severidad', '¿Estamos detectando más o menos con el tiempo?'],
          ['Decisiones del gate', '¿Cuántos despliegues se aprobaron, bloquearon o pasaron por bypass?'],
          ['Cumplimiento de plazos', '¿Qué parte de cada severidad está en plazo, por vencer o vencida?'],
          ['Antigüedad', '¿Cuánto tiempo llevan abiertos los hallazgos?'],
          ['Salud', 'Health score global de la organización'],
          ['Top repositorios', '¿Qué repos concentran más riesgo? (risk score)'],
          ['Top componentes', '¿Qué paquetes o reglas generan más hallazgos?'],
          ['Embudo de triage', '¿Qué porcentaje ya revisó una persona?'],
          ['Motores × severidad', '¿Qué motor aporta qué tipo de hallazgo?'],
          ['Mapa de calor', 'Actividad de detección por día'],
          ['Bitácora', 'Últimos eventos auditados'],
        ],
      },
      { type: 'goto', tab: 'dashboard', label: 'Abrir Dashboards' },
    ],
  },

  // ───────────────────────── Gobernanza
  {
    id: 'gates',
    group: 'Gobernanza',
    title: 'Security Gates',
    summary: 'La política que decide si un cambio puede avanzar en el pipeline.',
    blocks: [
      {
        type: 'p',
        text: 'El gate evalúa los hallazgos activos (Abierto y En revisión) de un repositorio, o de toda la organización, contra una política con cuatro parámetros.',
      },
      {
        type: 'table',
        head: ['Parámetro', 'Efecto'],
        rows: [
          ['Máximo de críticos', 'Si hay más críticos activos que este número, bloquea'],
          ['Máximo de altos', 'Si hay más altos activos que este número, bloquea'],
          ['Bloquear secretos', 'Cualquier secreto de GitLeaks activo bloquea'],
          ['Requerir aprobación CISO', 'El bloqueo solo se puede saltar con un bypass aprobado'],
        ],
      },
      { type: 'h', text: 'Decisiones' },
      {
        type: 'table',
        head: ['Decisión', 'Cuándo', 'allowed'],
        rows: [
          ['PASSED', 'Todos los conteos dentro de los umbrales', 'true'],
          ['BLOCKED', 'Al menos un umbral superado y sin bypass vigente', 'false'],
          ['BYPASSED', 'Hay umbrales superados pero existe un bypass aprobado y vigente', 'true'],
          ['DISABLED / SKIPPED', 'La política está deshabilitada', 'true'],
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'La respuesta incluye siempre las razones (por ejemplo "Críticas abiertas 3 > máximo 0"), para que quien recibe el bloqueo sepa exactamente qué corregir.',
      },
      { type: 'goto', tab: 'gates', label: 'Configurar la política' },
    ],
  },
  {
    id: 'bypass',
    group: 'Gobernanza',
    title: 'Bypass CISO',
    summary: 'Excepciones temporales, justificadas y auditadas para desplegar con el gate bloqueado.',
    blocks: [
      {
        type: 'steps',
        items: [
          { title: 'Solicitud', text: 'Desde Security Gates se pide un bypass con un motivo (mínimo 8 caracteres), el repositorio (o toda la organización) y la duración: de 1 a 168 horas, 24 por defecto.' },
          { title: 'Aprobación', text: 'Un aprobador lo acepta o rechaza con una nota. Pueden aprobar los correos en PILLOW_ADMIN_EMAILS o SECURITY_ALERT_EMAILS; si ambas listas están vacías, cualquier sesión puede aprobar (modo demo).' },
          { title: 'Vigencia', text: 'Mientras esté vigente, el gate responde BYPASSED en lugar de BLOCKED e incluye quién lo pidió y por qué.' },
          { title: 'Expiración', text: 'Al vencer, el gate vuelve a evaluar normalmente. No hay que revocarlo a mano.' },
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Un bypass no corrige nada: solo permite desplegar. Los hallazgos siguen activos y cuentan para el SLA.',
      },
    ],
  },
  {
    id: 'informes',
    group: 'Gobernanza',
    title: 'Informes ISO 27001',
    summary: 'Cómo se mapean los hallazgos a los controles del Anexo A de ISO/IEC 27001:2022.',
    blocks: [
      {
        type: 'table',
        head: ['Control', 'Nombre', 'Fuente'],
        rows: [
          ['A.8.8', 'Gestión de vulnerabilidades técnicas', 'Trivy'],
          ['A.8.9', 'Gestión de configuración', 'OWASP ZAP'],
          ['A.8.28', 'Codificación segura', 'Semgrep'],
          ['A.8.5', 'Autenticación segura', 'GitLeaks'],
          ['A.8.3', 'Protección de la información', 'GitLeaks'],
          ['A.8.25', 'Seguridad en el ciclo de desarrollo', 'Proceso (pipeline + gate)'],
          ['A.8.26', 'Requisitos de seguridad de las aplicaciones', 'Proceso (política del gate)'],
          ['A.8.32', 'Gestión del cambio', 'Proceso (webhook + gate)'],
          ['A.5.33', 'Protección de registros', 'Bitácora de auditoría'],
        ],
      },
      {
        type: 'p',
        text: 'Cada control muestra cuántos hallazgos activos lo afectan y su estado (Cumple, Parcial o Brecha). El informe incluye el health score global y se descarga como paquete de evidencia en JSON para el auditor.',
      },
      { type: 'goto', tab: 'reports', label: 'Ver Informes' },
    ],
  },
  {
    id: 'notificaciones',
    group: 'Gobernanza',
    title: 'Notificaciones y alertas',
    summary: 'Qué genera una notificación en el hub y cuándo se envía un correo.',
    blocks: [
      { type: 'h', text: 'En el hub' },
      {
        type: 'list',
        items: [
          'Los 10 hallazgos críticos activos más recientes (los de GitLeaks aparecen como "Fuga de secreto").',
          'Los 5 hallazgos altos activos más recientes.',
          'Escaneos recientes y sus resultados.',
          'El contador de la campana muestra las no leídas; se pueden marcar una a una o todas.',
        ],
      },
      { type: 'h', text: 'Por correo' },
      {
        type: 'p',
        text: 'Cuando un escaneo termina con el gate bloqueado se envía una alerta a las direcciones de SECURITY_ALERT_EMAILS, con la decisión, las razones y la cantidad de secretos abiertos. Si la variable está vacía no se envía nada.',
      },
      { type: 'goto', tab: 'notifications', label: 'Ver Notificaciones' },
    ],
  },

  // ───────────────────────── Integraciones
  {
    id: 'webhook',
    group: 'Integraciones',
    title: 'Webhook de GitHub',
    summary: 'Escanear automáticamente en cada push o pull request (shift-left).',
    blocks: [
      {
        type: 'steps',
        items: [
          { title: 'Abre la configuración del repo en GitHub', text: 'Settings → Webhooks → Add webhook.' },
          { title: 'Payload URL', text: '<URL de la API>/api/v1/webhooks/github (el hub muestra la URL exacta en Repositorios → "Configurar webhook", con botón para copiarla).' },
          { title: 'Content type y secreto', text: 'application/json. En Secret pon el mismo valor que GITHUB_WEBHOOK_SECRET del servidor.' },
          { title: 'Eventos', text: 'Selecciona "Pushes" y "Pull requests". GitHub enviará un ping inicial para verificar.' },
        ],
      },
      { type: 'h', text: 'Comportamiento' },
      {
        type: 'list',
        items: [
          'Se valida la firma HMAC de cada llamada; si no coincide se rechaza.',
          'El repositorio debe estar registrado en SSPILLOWY (se busca por URL o por owner/repo).',
          'Motores usados: WEBHOOK_SCAN_ENGINES (por defecto semgrep, gitleaks y trivy).',
          'Debounce: si ya hay un escaneo en curso de menos de WEBHOOK_DEBOUNCE_MINUTES (3), no se crea otro.',
          'Con WEBHOOK_ONLY_TRACKED_BRANCH=true solo se escanea la rama configurada del repo.',
        ],
      },
      { type: 'goto', tab: 'repositories', label: 'Configurar webhook' },
    ],
  },
  {
    id: 'cicd',
    group: 'Integraciones',
    title: 'Gate en CI/CD',
    summary: 'Hacer que el pipeline falle cuando SSPILLOWY bloquea.',
    blocks: [
      {
        type: 'p',
        text: 'El endpoint GET /api/v1/security-gates/check es público y acepta repository_id o repository_url. Devuelve allowed, decision, reasons y los conteos. Basta con fallar el job cuando allowed es false.',
      },
      {
        type: 'code',
        title: '.github/workflows/security-gate.yml',
        code: `name: Security Gate
on: [pull_request]

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - name: Consultar SSPILLOWY
        run: |
          RESP=$(curl -s "$API/api/v1/security-gates/check?repository_url=https://github.com/\${{ github.repository }}")
          echo "$RESP" | jq .
          echo "$RESP" | jq -e '.allowed == true' > /dev/null
        env:
          API: \${{ vars.SSPILLOWY_API_URL }}`,
      },
      {
        type: 'code',
        title: 'Respuesta de ejemplo',
        code: `{
  "allowed": false,
  "decision": "BLOCKED",
  "reasons": ["Críticas abiertas 3 > máximo 0", "Secretos GitLeaks abiertos: 2 (bloqueo estricto)"],
  "open_critical": 3,
  "open_high": 12,
  "open_secrets": 2,
  "policy_name": "Default Organization Security Gate"
}`,
      },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Combina el webhook (escanea en el push) con este paso (consulta en el PR): el desarrollador ve el bloqueo antes de hacer merge.',
      },
    ],
  },
  {
    id: 'api',
    group: 'Integraciones',
    title: 'Referencia de la API',
    summary: 'Endpoints REST bajo /api/v1. La documentación interactiva está en /docs del servidor.',
    blocks: [
      {
        type: 'table',
        head: ['Método', 'Ruta', 'Descripción', 'Sesión'],
        rows: [
          ['GET', '/health', 'Estado del servicio y del motor de base de datos', 'No'],
          ['GET', '/api/v1/stats', 'Métricas agregadas para el dashboard', 'No'],
          ['GET', '/api/v1/heatmap', 'Actividad diaria de hallazgos', 'No'],
          ['GET', '/api/v1/audit-log', 'Bitácora de auditoría', 'No'],
          ['GET · POST', '/api/v1/repositories', 'Listar y registrar repositorios', 'POST'],
          ['DELETE', '/api/v1/repositories/{id}', 'Eliminar un repositorio y sus datos', 'Sí'],
          ['GET · POST', '/api/v1/scans', 'Listar y lanzar escaneos (engines, branch, target_url)', 'POST'],
          ['GET', '/api/v1/findings', 'Listar hallazgos', 'No'],
          ['PATCH', '/api/v1/findings/{id}', 'Cambiar estado (HITL)', 'Sí'],
          ['GET · POST', '/api/v1/security-gates', 'Leer y actualizar la política', 'POST'],
          ['GET', '/api/v1/security-gates/check', 'Evaluar el gate (para CI)', 'No'],
          ['POST', '/api/v1/security-gates/evaluate', 'Evaluar y registrar en la bitácora', 'Sí'],
          ['GET · POST', '/api/v1/security-gates/bypasses', 'Listar y solicitar bypass', 'POST'],
          ['POST', '/api/v1/security-gates/bypasses/{id}/approve | reject', 'Decidir un bypass', 'Sí'],
          ['GET', '/api/v1/notifications', 'Notificaciones (unread_only opcional)', 'No'],
          ['GET', '/api/v1/compliance/iso27001', 'Informe de controles ISO', 'No'],
          ['POST', '/api/v1/webhooks/github', 'Receptor del webhook (firma HMAC)', 'Firma'],
          ['POST', '/api/v1/pillow/chat', 'Asistente IA (consume créditos)', 'Sí'],
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Las escrituras requieren la cabecera X-Session-Id con el identificador de la sesión iniciada en el hub.',
      },
    ],
  },
  {
    id: 'configuracion',
    group: 'Integraciones',
    title: 'Configuración del servidor',
    summary: 'Variables de entorno que cambian el comportamiento de la API.',
    blocks: [
      { type: 'h', text: 'Motores' },
      {
        type: 'table',
        head: ['Variable', 'Por defecto', 'Efecto'],
        rows: [
          ['SEMGREP_CONFIG', 'p/ci,p/owasp-top-ten', 'Rulesets de Semgrep, separados por coma'],
          ['SEMGREP_MAX_FINDINGS', '200', 'Tope de hallazgos por escaneo'],
          ['TRIVY_SCANNERS', 'vuln,misconfig,secret', 'Qué analiza Trivy'],
          ['TRIVY_MAX_FINDINGS', '300', 'Tope (después de ordenar por severidad)'],
          ['GITLEAKS_MAX_FINDINGS', '100', 'Tope de secretos'],
          ['ZAP_MAX_FINDINGS', '40', 'Tope de alertas DAST'],
          ['ZAP_DEFAULT_TARGET', 'https://sspillowy.com', 'URL DAST si el repo no tiene una'],
          ['GITHUB_TOKEN', '—', 'Para clonar repositorios privados'],
          ['STALE_SCAN_MINUTES', '20', 'Minutos para dar por fallido un escaneo colgado'],
        ],
      },
      { type: 'h', text: 'Webhook y alertas' },
      {
        type: 'table',
        head: ['Variable', 'Por defecto', 'Efecto'],
        rows: [
          ['GITHUB_WEBHOOK_SECRET', '—', 'Secreto para validar la firma de GitHub'],
          ['WEBHOOK_SCAN_ENGINES', 'semgrep,gitleaks,trivy', 'Motores del escaneo automático'],
          ['WEBHOOK_DEBOUNCE_MINUTES', '3', 'Evita escaneos duplicados por pushes seguidos'],
          ['WEBHOOK_ONLY_TRACKED_BRANCH', 'false', 'Escanear solo la rama configurada'],
          ['SECURITY_ALERT_EMAILS', '—', 'Destinatarios de alertas de gate; también aprueban bypass'],
        ],
      },
      { type: 'h', text: 'Plataforma' },
      {
        type: 'table',
        head: ['Variable', 'Efecto'],
        rows: [
          ['DATABASE_URL', 'Cadena de PostgreSQL (se fuerza el driver psycopg2)'],
          ['HUB_AUTH_MODE', 'writes: lecturas públicas, escrituras con sesión'],
          ['FRONTEND_URL / BACKEND_CORS_ORIGINS', 'Orígenes permitidos y enlaces de los correos'],
          ['GITHUB_ / GITLAB_ / GOOGLE_ / MICROSOFT_ CLIENT_ID y SECRET', 'Proveedores de inicio de sesión'],
          ['GEMINI_API_KEY, PILLOW_DAILY_CREDITS', 'Asistente IA y créditos diarios por usuario'],
          ['PILLOW_ADMIN_EMAILS', 'Administradores (créditos ilimitados, aprueban bypass)'],
        ],
      },
    ],
  },

  // ───────────────────────── Referencia
  {
    id: GLOSSARY_SECTION_ID,
    group: 'Referencia',
    title: 'Glosario',
    summary: 'Los conceptos de análisis, motores, clasificación, gobernanza y métricas que usa SSPILLOWY.',
    blocks: [],
  },
  {
    id: 'faq',
    group: 'Referencia',
    title: 'Problemas frecuentes',
    summary: 'Síntomas habituales y cómo resolverlos.',
    blocks: [
      {
        type: 'table',
        head: ['Síntoma', 'Causa probable', 'Solución'],
        rows: [
          ['Los repositorios o hallazgos "desaparecen" tras un despliegue', 'La API no conectó a PostgreSQL y arrancó en SQLite', 'Revisar /health y la variable DATABASE_URL'],
          ['El escaneo falla en la etapa de clonado', 'URL incorrecta o repositorio privado sin token', 'Verificar la URL y configurar GITHUB_TOKEN'],
          ['Se detecta muy poco', 'Variables de tope o de ruleset antiguas en el servidor', 'Revisar SEMGREP_CONFIG y TRIVY_MAX_FINDINGS'],
          ['La matriz parece tener duplicados', 'Son CVE distintos del mismo paquete', 'Usar la vista agrupada'],
          ['"Sesión expirada" al crear o escanear', 'La sesión del hub venció', 'Cerrar sesión y volver a entrar'],
          ['El webhook no dispara escaneos', 'Secreto distinto, repo no registrado o debounce', 'Revisar "Recent deliveries" en GitHub'],
          ['No llegan alertas por correo', 'SECURITY_ALERT_EMAILS vacío o SMTP sin configurar', 'Configurar las variables de correo'],
          ['El escaneo queda en "En cola" mucho tiempo', 'El contenedor se reinició', 'Se marcará fallido tras STALE_SCAN_MINUTES; relanzar'],
        ],
      },
    ],
  },
];
