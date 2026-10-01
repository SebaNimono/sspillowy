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
    summary: 'Una plataforma para encontrar, priorizar y gestionar las vulnerabilidades de tu software en un solo lugar.',
    blocks: [
      {
        type: 'p',
        text: 'SSPILLOWY revisa tus repositorios con varias herramientas de seguridad reconocidas, junta todos sus resultados en una sola lista y te ayuda a decidir qué corregir primero. Además puede impedir que un cambio inseguro llegue a producción.',
      },
      { type: 'h', text: 'Qué puedes hacer' },
      {
        type: 'list',
        items: [
          'Analizar tu código, tus dependencias, tus secretos y tu aplicación web desde un mismo lugar.',
          'Ver todas las vulnerabilidades unificadas, con su gravedad, el archivo y cómo corregirlas.',
          'Revisarlas y marcarlas como corregidas, falsos positivos o riesgos aceptados.',
          'Bloquear despliegues que no cumplen tu política de seguridad.',
          'Seguir la evolución de tu postura de seguridad con dashboards.',
          'Generar evidencia para auditorías ISO 27001.',
        ],
      },
      { type: 'h', text: 'Detecta, propone, firma' },
      {
        type: 'table',
        head: ['Paso', 'Quién', 'Qué hace'],
        rows: [
          ['Detecta', 'Las herramientas de análisis', 'Encuentran los problemas en tu código y dependencias'],
          ['Propone', 'El asistente Pillow', 'Explica cada problema y sugiere cómo corregirlo'],
          ['Firma', 'Tú o tu equipo', 'Deciden el estado final de cada hallazgo'],
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Ninguna herramienta ni la IA cierra un hallazgo por su cuenta: siempre decide una persona, y cada decisión queda registrada con su autor.',
      },
      { type: 'h', text: 'Secciones del panel' },
      {
        type: 'table',
        head: ['Sección', 'Para qué sirve'],
        rows: [
          ['Risk Posture', 'Ver de un vistazo cómo está la seguridad de tus proyectos.'],
          ['Repositorios', 'Agregar proyectos y lanzar análisis.'],
          ['Priorización contextual', 'Revisar y gestionar cada vulnerabilidad encontrada.'],
          ['Escaneos', 'Consultar el historial de análisis y su resultado.'],
          ['Security Gates', 'Definir cuándo se bloquea un despliegue y pedir excepciones.'],
          ['Compliance continuo', 'Ver el cumplimiento por control y descargar la evidencia.'],
          ['Notificaciones', 'Enterarte de lo crítico apenas aparece.'],
        ],
      },
    ],
  },
  {
    id: 'quickstart',
    group: 'Empezar',
    title: 'Primeros pasos',
    summary: 'De cero a tu primer análisis en cinco pasos.',
    blocks: [
      {
        type: 'steps',
        items: [
          {
            title: 'Inicia sesión',
            text: 'Entra con tu cuenta de GitHub, GitLab, Google o Microsoft, o con correo y contraseña. La primera vez se crea tu cuenta automáticamente.',
          },
          {
            title: 'Agrega un repositorio',
            text: 'En Repositorios pulsa "Nuevo Repositorio" e indica el nombre, la URL de Git y la rama principal. Si tu aplicación está publicada, puedes añadir su URL para analizarla en vivo.',
          },
          {
            title: 'Lanza un análisis',
            text: 'Pulsa "Escanear" y elige un perfil. Para empezar te recomendamos "Código completo". Verás el avance en vivo en la tarjeta del repositorio.',
          },
          {
            title: 'Revisa los resultados',
            text: 'Abre la Priorización contextual. Empieza por los críticos y por los que tienen el plazo vencido.',
          },
          {
            title: 'Toma decisiones',
            text: 'Marca cada hallazgo o grupo como En revisión, Corregido, Falso positivo o Riesgo aceptado. Los dashboards y el gate se actualizan con tus decisiones.',
          },
        ],
      },
      { type: 'goto', tab: 'repositories', label: 'Ir a Repositorios' },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Conecta el webhook de GitHub para que cada push o pull request se analice solo, sin entrar al panel.',
      },
    ],
  },
  {
    id: 'casos-uso',
    group: 'Empezar',
    title: 'Casos de uso',
    summary: 'Situaciones habituales y cómo resolverlas con SSPILLOWY.',
    blocks: [
      { type: 'h', text: '“Quiero saber qué tan seguro es mi proyecto”' },
      {
        type: 'p',
        text: 'Agrega el repositorio y lanza un análisis con el perfil "Código completo". Luego revisa en Risk Posture el health score y los críticos activos, y en Priorización contextual qué paquetes o reglas concentran más problemas.',
      },
      { type: 'h', text: '“Subí una contraseña o una API key por error”' },
      {
        type: 'p',
        text: 'Lanza el perfil "Solo secretos". Rota la credencial en el proveedor (no basta con borrarla del código: queda en el historial de Git) y después marca el hallazgo como Corregido.',
      },
      { type: 'h', text: '“Actualicé dependencias y quiero comprobarlo”' },
      {
        type: 'p',
        text: 'Lanza "Solo SCA / IaC". Los hallazgos del análisis anterior se reemplazan por los nuevos, así que verás solo lo que sigue pendiente.',
      },
      { type: 'h', text: '“No quiero que llegue código inseguro a producción”' },
      {
        type: 'p',
        text: 'Define en Security Gates cuántos críticos y altos toleras, activa el bloqueo por secretos y agrega el paso de verificación a tu pipeline (ver "Gate en CI/CD").',
      },
      { type: 'h', text: '“Necesito desplegar una urgencia aunque el gate esté bloqueado”' },
      {
        type: 'p',
        text: 'Solicita un bypass en Security Gates con un motivo y una duración. Cuando un aprobador lo acepte podrás desplegar; la excepción vence sola.',
      },
      { type: 'h', text: '“Tengo una auditoría ISO 27001”' },
      {
        type: 'p',
        text: 'En Compliance continuo verás el estado de cada control y podrás descargar el paquete de evidencia. La bitácora demuestra quién tomó cada decisión y cuándo.',
      },
      { type: 'h', text: '“Quiero revisar mi aplicación ya publicada”' },
      {
        type: 'p',
        text: 'Agrega la URL de tu aplicación al repositorio y lanza "Solo DAST". Se revisan cabeceras de seguridad, cookies y rutas expuestas.',
      },
    ],
  },

  // ───────────────────────── Cómo funciona
  {
    id: 'ciclo-escaneo',
    group: 'Cómo funciona',
    title: 'Cómo funciona un análisis',
    summary: 'Qué pasa desde que lanzas un análisis hasta que ves los resultados.',
    blocks: [
      {
        type: 'steps',
        items: [
          { title: 'En cola', text: 'El análisis se registra con la rama y las herramientas elegidas.' },
          { title: 'Descarga del código', text: 'Se obtiene una copia del repositorio. Si la URL es incorrecta o el repositorio es privado sin acceso, el análisis falla en este paso.' },
          { title: 'Análisis', text: 'Cada herramienta revisa el código por separado. Si una falla, las demás continúan.' },
          { title: 'Unificación', text: 'Los resultados se convierten a un formato común: gravedad, archivo, línea, tipo de debilidad (CWE), control ISO y recomendación.' },
          { title: 'Actualización', text: 'Los hallazgos de análisis anteriores se reemplazan por los nuevos, para que no se dupliquen.' },
          { title: 'Security Gate', text: 'Se comprueba si el proyecto cumple tu política: Aprobado, Bloqueado o Bypass.' },
          { title: 'Aviso', text: 'Si el gate bloquea, se avisa por correo a los responsables de seguridad.' },
        ],
      },
      { type: 'h', text: 'Perfiles de análisis' },
      {
        type: 'table',
        head: ['Perfil', 'Qué revisa', 'Cuándo usarlo'],
        rows: [
          ['CI rápido', 'Código + secretos', 'En cada pull request; es el más rápido'],
          ['Código completo', 'Código + secretos + dependencias', 'Revisión general recomendada'],
          ['Solo SAST', 'Código fuente', 'Validar un cambio de código'],
          ['Solo secretos', 'Credenciales en el repositorio', 'Tras una posible fuga o rotación de claves'],
          ['Solo SCA / IaC', 'Dependencias y configuración (Docker, Kubernetes…)', 'Tras actualizar librerías'],
          ['Solo DAST', 'Aplicación publicada', 'Revisar una URL en vivo'],
          ['Full stack', 'Todo lo anterior', 'Auditoría completa (más lento)'],
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'No se analizan carpetas de dependencias descargadas ni de compilación (como node_modules, build o dist), ni datos de prueba: así los resultados se centran en tu código.',
      },
      { type: 'goto', tab: 'scans', label: 'Ver Escaneos' },
    ],
  },
  {
    id: 'motores',
    group: 'Cómo funciona',
    title: 'Herramientas de análisis',
    summary: 'Qué detecta cada herramienta y en qué casos usarla.',
    blocks: [
      { type: 'h', text: 'Semgrep · Análisis de código (SAST)' },
      { type: 'p', text: 'Lee tu código fuente buscando patrones inseguros, con reglas basadas en el OWASP Top 10.' },
      { type: 'list', items: ['Inyección SQL y de comandos', 'Uso de eval o deserialización insegura', 'SSRF, plantillas inseguras, modo debug activado, cifrado débil'] },
      { type: 'h', text: 'Trivy · Dependencias y configuración (SCA / IaC)' },
      { type: 'p', text: 'Revisa las librerías que usa tu proyecto y los archivos de infraestructura, y los compara con bases públicas de vulnerabilidades.' },
      { type: 'list', items: ['Librerías con CVE conocidos y la versión que los corrige', 'Dockerfiles y manifiestos de Kubernetes o Terraform mal configurados', 'Prioriza siempre los hallazgos más graves'] },
      { type: 'h', text: 'GitLeaks · Secretos' },
      { type: 'p', text: 'Busca credenciales escritas en el código: claves de AWS, tokens de GitHub, claves privadas, contraseñas, etc.' },
      { type: 'list', items: ['El valor del secreto nunca se muestra completo: se enmascara', 'Un secreto activo puede bloquear el despliegue según tu política'] },
      { type: 'h', text: 'OWASP ZAP · Aplicación en vivo (DAST)' },
      { type: 'p', text: 'Revisa tu aplicación publicada desde fuera, como lo haría un atacante.' },
      { type: 'list', items: ['Cabeceras de seguridad ausentes', 'Cookies sin protección', 'Rutas o información expuesta'] },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Cada herramienta cubre un ángulo distinto. Ninguna reemplaza a las demás: combina al menos código, secretos y dependencias.',
      },
    ],
  },
  {
    id: 'matriz',
    group: 'Cómo funciona',
    title: 'Priorización contextual',
    summary: 'Cómo leer, filtrar y gestionar las vulnerabilidades.',
    blocks: [
      { type: 'h', text: 'Resumen superior' },
      {
        type: 'p',
        text: 'Las tarjetas muestran cuántos hallazgos activos hay por gravedad, cuántos están fuera de plazo y cuántos tienen parche disponible. Haz clic en una tarjeta para filtrar.',
      },
      { type: 'h', text: 'Vista agrupada y vista lista' },
      {
        type: 'list',
        items: [
          'Agrupada: las vulnerabilidades de una misma librería o regla se juntan. Por ejemplo, "Pillow 6.2.0 · 30 hallazgos · actualizar a 10.2.0" se resuelve con una sola actualización.',
          'Lista: un hallazgo por fila, para revisarlos uno a uno.',
        ],
      },
      { type: 'h', text: 'Filtros' },
      { type: 'p', text: 'Busca por texto (título, archivo, CVE o regla) y filtra por repositorio, herramienta y estado. Por defecto solo se muestran los pendientes.' },
      { type: 'h', text: 'Estados' },
      {
        type: 'table',
        head: ['Estado', 'Úsalo cuando…', '¿Cuenta para el gate?'],
        rows: [
          ['Abierto', 'Aún no se ha revisado', 'Sí'],
          ['En revisión', 'Alguien lo está analizando', 'Sí'],
          ['Corregido', 'Ya se arregló en el código', 'No'],
          ['Falso positivo', 'No es un problema real en tu caso', 'No'],
          ['Riesgo aceptado', 'Es real, pero decides asumirlo por ahora', 'No'],
          ['Reemplazado', 'Un análisis más reciente lo sustituyó (automático)', 'No'],
        ],
      },
      { type: 'h', text: 'Plazos de corrección' },
      {
        type: 'table',
        head: ['Gravedad', 'Plazo recomendado'],
        rows: [
          ['Crítica', '7 días'],
          ['Alta', '30 días'],
          ['Media', '90 días'],
          ['Baja', '180 días'],
          ['Informativa', '365 días'],
        ],
      },
      { type: 'p', text: 'Cada hallazgo muestra si está En plazo, Por vencer (último cuarto del plazo) o Vencido.' },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Dentro de un grupo puedes cambiar el estado de todos sus hallazgos a la vez.',
      },
      { type: 'goto', tab: 'findings', label: 'Abrir Priorización contextual' },
    ],
  },
  {
    id: 'dashboards',
    group: 'Cómo funciona',
    title: 'Risk Posture (dashboards)',
    summary: 'Qué muestra cada indicador y cada gráfico.',
    blocks: [
      { type: 'h', text: 'Controles' },
      { type: 'list', items: ['Periodo: últimos 7, 30 o 90 días.', 'Actualizar: recarga los datos.', 'En vivo: se actualiza solo cada minuto.', 'Configurar: elige qué widgets ver y tus umbrales de alerta.'] },
      { type: 'h', text: 'Indicadores' },
      {
        type: 'table',
        head: ['Indicador', 'Qué significa'],
        rows: [
          ['Hallazgos activos', 'Pendientes de resolver, comparado con el periodo anterior'],
          ['Críticos activos', 'Pendientes de gravedad crítica'],
          ['Fuera de plazo', 'Pendientes que superaron su plazo de corrección'],
          ['Gate aprobado', 'Porcentaje de análisis que pasaron tu política'],
          ['Escaneos', 'Análisis realizados en el periodo'],
        ],
      },
      { type: 'h', text: 'Gráficos' },
      {
        type: 'table',
        head: ['Widget', 'Responde a'],
        rows: [
          ['Tendencia por severidad', '¿Aparecen más o menos problemas con el tiempo?'],
          ['Decisiones del gate', '¿Cuántos despliegues se aprobaron o bloquearon?'],
          ['Cumplimiento de plazos', '¿Estamos corrigiendo a tiempo?'],
          ['Antigüedad', '¿Cuánto llevan abiertos los hallazgos?'],
          ['Salud', '¿Cómo está la seguridad general? (0 a 100)'],
          ['Top repositorios', '¿Qué proyectos concentran más riesgo?'],
          ['Top componentes', '¿Qué librerías o reglas generan más problemas?'],
          ['Embudo de triage', '¿Cuánto ha revisado ya el equipo?'],
          ['Herramientas × severidad', '¿Qué encuentra cada herramienta?'],
          ['Mapa de calor', '¿Qué días hubo más detecciones?'],
          ['Bitácora', '¿Qué acciones se hicieron recientemente?'],
        ],
      },
      { type: 'goto', tab: 'dashboard', label: 'Abrir Risk Posture' },
    ],
  },

  // ───────────────────────── Gobernanza
  {
    id: 'gates',
    group: 'Gobernanza',
    title: 'Security Gates',
    summary: 'Define cuándo un proyecto puede desplegarse y cuándo no.',
    blocks: [
      {
        type: 'p',
        text: 'El gate revisa los hallazgos pendientes de un proyecto y los compara con tu política. Si la supera, el despliegue se bloquea.',
      },
      {
        type: 'table',
        head: ['Opción', 'Qué hace'],
        rows: [
          ['Máximo de críticos', 'Bloquea si hay más críticos pendientes que este número'],
          ['Máximo de altos', 'Bloquea si hay más altos pendientes que este número'],
          ['Bloquear secretos', 'Bloquea si hay cualquier secreto pendiente'],
          ['Requerir aprobación CISO', 'Solo se puede saltar el bloqueo con un bypass aprobado'],
        ],
      },
      { type: 'h', text: 'Resultados posibles' },
      {
        type: 'table',
        head: ['Resultado', 'Significado'],
        rows: [
          ['Aprobado', 'El proyecto cumple la política'],
          ['Bloqueado', 'Supera algún límite; se indica cuál'],
          ['Bypass', 'Supera algún límite, pero hay una excepción aprobada vigente'],
          ['Omitido', 'La política está desactivada'],
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Cuando bloquea, siempre explica el motivo, por ejemplo "Críticas abiertas 3 > máximo 0", para que sepas exactamente qué corregir.',
      },
      { type: 'goto', tab: 'gates', label: 'Configurar la política' },
    ],
  },
  {
    id: 'bypass',
    group: 'Gobernanza',
    title: 'Bypass (excepciones)',
    summary: 'Cómo desplegar de forma controlada cuando el gate está bloqueado.',
    blocks: [
      {
        type: 'steps',
        items: [
          { title: 'Solicita', text: 'En Security Gates pide un bypass indicando el motivo, el proyecto y cuánto tiempo lo necesitas (de 1 hora a 7 días).' },
          { title: 'Aprobación', text: 'Un responsable de seguridad lo aprueba o rechaza, con una nota.' },
          { title: 'Despliega', text: 'Mientras esté vigente, el gate responde "Bypass" y permite continuar.' },
          { title: 'Vence solo', text: 'Al terminar el plazo, el gate vuelve a funcionar normalmente.' },
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Un bypass no corrige nada: solo permite desplegar. Los hallazgos siguen pendientes y su plazo sigue corriendo.',
      },
    ],
  },
  {
    id: 'informes',
    group: 'Gobernanza',
    title: 'Compliance continuo',
    summary: 'Cómo tus hallazgos se relacionan con los controles de ISO/IEC 27001:2022.',
    blocks: [
      {
        type: 'table',
        head: ['Control', 'Nombre', 'Se alimenta de'],
        rows: [
          ['A.8.8', 'Gestión de vulnerabilidades técnicas', 'Dependencias (Trivy)'],
          ['A.8.9', 'Gestión de configuración', 'Aplicación en vivo (ZAP)'],
          ['A.8.28', 'Codificación segura', 'Código (Semgrep)'],
          ['A.8.5', 'Autenticación segura', 'Secretos (GitLeaks)'],
          ['A.8.3', 'Protección de la información', 'Secretos (GitLeaks)'],
          ['A.8.25', 'Seguridad en el ciclo de desarrollo', 'Uso de análisis y gate'],
          ['A.8.26', 'Requisitos de seguridad de las aplicaciones', 'Política del gate'],
          ['A.8.32', 'Gestión del cambio', 'Análisis automático por push'],
          ['A.5.33', 'Protección de registros', 'Bitácora de acciones'],
        ],
      },
      {
        type: 'p',
        text: 'Cada control muestra cuántos hallazgos pendientes lo afectan y su estado: Cumple, Parcial o Brecha. Puedes descargar el paquete de evidencia para entregarlo al auditor.',
      },
      { type: 'goto', tab: 'reports', label: 'Ver Informes' },
    ],
  },
  {
    id: 'notificaciones',
    group: 'Gobernanza',
    title: 'Notificaciones',
    summary: 'Cuándo y cómo te avisa SSPILLOWY.',
    blocks: [
      {
        type: 'list',
        items: [
          'Hallazgos críticos nuevos (los secretos aparecen como "Fuga de secreto").',
          'Hallazgos altos recientes.',
          'Resultados de análisis recientes.',
          'La campana muestra cuántas no has leído; puedes marcarlas una a una o todas juntas.',
          'Si un análisis queda bloqueado por el gate, los responsables de seguridad reciben un correo con el motivo.',
        ],
      },
      { type: 'goto', tab: 'notifications', label: 'Ver Notificaciones' },
    ],
  },

  // ───────────────────────── Integraciones
  {
    id: 'webhook',
    group: 'Integraciones',
    title: 'Webhook de GitHub',
    summary: 'Analiza automáticamente cada push y pull request.',
    blocks: [
      {
        type: 'steps',
        items: [
          { title: 'Copia la URL', text: 'En Repositorios pulsa "Configurar webhook" y copia la URL que aparece.' },
          { title: 'Abre GitHub', text: 'En tu repositorio: Settings → Webhooks → Add webhook.' },
          { title: 'Configura', text: 'Pega la URL en "Payload URL", elige "application/json" e ingresa el secreto que te indique tu administrador.' },
          { title: 'Elige los eventos', text: 'Marca "Pushes" y "Pull requests" y guarda. GitHub hará una prueba de conexión.' },
        ],
      },
      { type: 'h', text: 'Bueno saber' },
      {
        type: 'list',
        items: [
          'El repositorio debe estar agregado antes en SSPILLOWY.',
          'Si haces varios push seguidos, se agrupan en un solo análisis.',
          'Se analizan código, secretos y dependencias.',
          'En GitHub, la pestaña "Recent deliveries" del webhook muestra si cada envío llegó bien.',
        ],
      },
      { type: 'goto', tab: 'repositories', label: 'Configurar webhook' },
    ],
  },
  {
    id: 'cicd',
    group: 'Integraciones',
    title: 'Gate en CI/CD',
    summary: 'Haz que tu pipeline se detenga cuando el gate bloquea.',
    blocks: [
      {
        type: 'p',
        text: 'Agrega un paso a tu pipeline que consulte el gate. Si la respuesta indica que no está permitido, el paso falla y el merge o despliegue se detiene.',
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
  "open_secrets": 2
}`,
      },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Combina el webhook (analiza en cada push) con este paso (verifica en el pull request): verás el bloqueo antes de hacer merge.',
      },
    ],
  },

  // ───────────────────────── Referencia
  {
    id: GLOSSARY_SECTION_ID,
    group: 'Referencia',
    title: 'Glosario',
    summary: 'Los términos de seguridad que vas a encontrar en SSPILLOWY, explicados.',
    blocks: [],
  },
  {
    id: 'faq',
    group: 'Referencia',
    title: 'Preguntas frecuentes',
    summary: 'Dudas habituales y cómo resolverlas.',
    blocks: [
      {
        type: 'table',
        head: ['Pregunta o problema', 'Respuesta'],
        rows: [
          ['El análisis falla al empezar', 'Revisa que la URL del repositorio sea correcta. Si es privado, la plataforma necesita permiso de lectura.'],
          ['Veo muchos hallazgos de la misma librería', 'Son vulnerabilidades distintas (CVE) del mismo paquete. Usa la vista agrupada: normalmente se resuelven todas actualizando a una versión.'],
          ['Corregí algo pero sigue apareciendo', 'Lanza un nuevo análisis: los resultados anteriores se reemplazan por los nuevos.'],
          ['¿Qué hago con un falso positivo?', 'Márcalo como "Falso positivo". Deja de contar para el gate y queda registrado quién lo decidió.'],
          ['Me pide iniciar sesión de nuevo', 'Tu sesión expiró. Vuelve a entrar y repite la acción.'],
          ['El webhook no lanza análisis', 'Comprueba que el repositorio esté agregado, que el secreto sea correcto y revisa "Recent deliveries" en GitHub.'],
          ['El análisis se queda "En cola"', 'Si pasan más de 20 minutos se marca como fallido automáticamente; vuelve a lanzarlo.'],
          ['¿La IA cierra vulnerabilidades sola?', 'No. Solo explica y sugiere; el estado lo decide siempre una persona.'],
        ],
      },
    ],
  },
];
