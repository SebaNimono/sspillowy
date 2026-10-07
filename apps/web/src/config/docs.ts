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
          'Medir tu preparación para ISO 27001, SOC 2, NIST, PCI DSS, CIS, OWASP y la Ley Marco de Ciberseguridad, y generar la evidencia para auditorías.',
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
          ['Resumen ejecutivo', 'Explicar el estado de la seguridad a dirección o a un cliente, en una página.'],
          ['Compliance continuo', 'Medir tu preparación para cada norma o marco y descargar la evidencia.'],
          ['Notificaciones', 'Enterarte de lo crítico apenas aparece.'],
          ['Observabilidad', 'Comprobar que la plataforma y sus análisis funcionan bien.'],
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
    id: 'recorrido',
    group: 'Empezar',
    title: 'Recorrido por la plataforma',
    summary: 'Un paseo guiado por cada sección, en el orden en que se usan en el día a día.',
    blocks: [
      {
        type: 'p',
        text: 'El menú está ordenado por áreas, pero el trabajo sigue otro orden: conectar un repositorio, analizarlo, revisar lo encontrado, controlar el despliegue y, por último, medir y auditar. Este recorrido sigue ese orden. Te llevará unos 30 minutos.',
      },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Para seguirlo con datos reales, agrega un repositorio y lanza un análisis "Código completo" antes de empezar.',
      },

      { type: 'h', text: '1. Repositorios · el punto de partida' },
      {
        type: 'list',
        items: [
          'Pulsa "Nuevo Repositorio" e indica nombre, URL de Git y rama. Si la aplicación está publicada, añade su URL para analizarla en vivo.',
          'Pulsa "Escanear" y elige un perfil: "CI rápido" para pull requests, "Código completo" para una revisión general, "Full stack" para una auditoría.',
          'Con "Configurar webhook" cada push o pull request se analiza solo. El punto de color indica si está activo.',
        ],
      },
      { type: 'goto', tab: 'repositories', label: 'Ir a Repositorios' },

      { type: 'h', text: '2. Escaneos · el historial' },
      {
        type: 'list',
        items: [
          'Cada análisis muestra sus etapas: en cola, descarga del código, análisis, unificación y Security Gate.',
          'Al terminar verás los hallazgos por severidad y la decisión del gate: Aprobado, Bloqueado o Bypass.',
          'Si un análisis queda detenido más de 20 minutos se marca como fallido; vuelve a lanzarlo.',
        ],
      },
      { type: 'goto', tab: 'scans', label: 'Ir a Escaneos' },

      { type: 'h', text: '3. Priorización contextual · el trabajo diario' },
      {
        type: 'steps',
        items: [
          { title: 'Mira el resumen', text: 'Las tarjetas muestran los pendientes por severidad, los de plazo vencido y los que tienen parche. Haz clic en una para filtrar.' },
          { title: 'Empieza por lo urgente', text: 'Primero los críticos y los de plazo vencido. Usa el buscador para encontrar un CVE, una librería o un archivo.' },
          { title: 'Usa la vista agrupada', text: 'Los hallazgos de una misma librería se juntan: suelen resolverse todos actualizando a la versión indicada.' },
          { title: 'Abre el detalle', text: 'Verás archivo, línea, severidad, plazo, tipo de debilidad (CWE), control ISO y cómo corregirlo.' },
          { title: 'Decide', text: 'Marca En revisión, Corregido, Falso positivo o Riesgo aceptado, de uno en uno o el grupo completo.' },
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Los secretos filtrados se gestionan en Secret Management: allí se cierran con su checklist de respuesta, no marcándolos a mano como Corregido.',
      },
      { type: 'goto', tab: 'findings', label: 'Ir a Priorización contextual' },

      { type: 'h', text: '4. Secret Management · la respuesta a fugas' },
      {
        type: 'list',
        items: [
          'Cada credencial detectada aparece una sola vez, con su proveedor (AWS, GitHub, Stripe…), el valor enmascarado y dónde está.',
          'Ábrela y sigue el checklist: rotar, revocar, limpiar el historial y verificar. Cada paso guarda quién lo hizo y cuándo.',
          'Al completar los cuatro pasos el secreto queda resuelto y deja de bloquear el gate. Si vuelve a aparecer, se reabre solo.',
        ],
      },
      { type: 'goto', tab: 'secrets', label: 'Ir a Secret Management' },

      { type: 'h', text: '5. Supply Chain & SBOM · el inventario de librerías' },
      {
        type: 'list',
        items: [
          'Cada análisis de dependencias guarda el inventario completo (SBOM) de cada repositorio: paquete, versión, licencia y manifiesto.',
          'Escribe un nombre en el buscador para saber al instante si lo usas, en qué repositorios y en qué versión.',
          'Los filtros muestran las librerías vulnerables, las de licencia a revisar y las que no declaran licencia.',
          'En el panel lateral ves qué librerías se añadieron, quitaron o actualizaron en el último análisis, y puedes exportar el SBOM en CycloneDX.',
        ],
      },
      { type: 'goto', tab: 'sbom', label: 'Ir a Supply Chain & SBOM' },

      { type: 'h', text: '6. Fix Intelligence · qué corregir primero y cómo' },
      {
        type: 'list',
        items: [
          'Todos los hallazgos pendientes en una sola cola, ordenados por una prioridad de 0 a 100 que explica sus motivos (severidad, exposición, fix disponible, ruta de test…).',
          'Los "quick wins" se corrigen actualizando una versión: empieza por ellos para bajar mucho riesgo con poco esfuerzo.',
          'Selecciona hasta 5 hallazgos y pulsa "Analizar con Pillow": Pillow estima si son reales o falsos positivos y propone la corrección.',
          'Tú aceptas o descartas cada sugerencia. Nada cambia de estado sin tu decisión, y lo decidido se mantiene en los siguientes análisis.',
        ],
      },
      { type: 'goto', tab: 'fixIntel', label: 'Ir a Fix Intelligence' },

      { type: 'h', text: '7. Security Gates · el control del despliegue' },
      {
        type: 'list',
        items: [
          'Define cuántos críticos y altos toleras, si cualquier secreto bloquea y si saltar un bloqueo requiere aprobación.',
          'Cuando bloquea, siempre indica el motivo, por ejemplo "Críticas abiertas 3 > máximo 0".',
          'Para una urgencia, solicita un bypass con motivo y duración (1 hora a 7 días). Vence solo y queda registrado.',
          'Tus decisiones en Priorización contextual afectan al gate: un falso positivo bien marcado deja de bloquear.',
        ],
      },
      { type: 'goto', tab: 'gates', label: 'Ir a Security Gates' },

      { type: 'h', text: '8. Risk Posture · la vista general' },
      {
        type: 'list',
        items: [
          'Elige el periodo (7, 30 o 90 días) y activa "En vivo" para actualizar cada minuto.',
          'Los indicadores comparan con el periodo anterior: activos, críticos, fuera de plazo, gate aprobado y escaneos.',
          'Los widgets responden: ¿vamos mejorando?, ¿corregimos a tiempo?, ¿dónde está el riesgo?, ¿cuánto revisó el equipo?',
          'Con "Configurar" eliges qué widgets ver y tus umbrales de alerta. Desde aquí Pillow también puede añadir widgets a tu tablero.',
          'Con el botón "Dashboards" ves la lista completa y creas dashboards propios por producto, equipo o cliente, cada uno con sus repositorios.',
        ],
      },
      { type: 'goto', tab: 'dashboard', label: 'Ir a Risk Posture' },

      { type: 'h', text: '9. Security Velocity · el ritmo del equipo' },
      {
        type: 'list',
        items: [
          'Mide cuánto tarda el equipo en corregir, cuántos hallazgos entran y salen cada semana y si se cumplen los plazos.',
          'Un hallazgo cuenta como corregido cuando un análisis posterior ya no lo encuentra: escanea de nuevo después de corregir.',
          'La tabla por repositorio muestra quién reduce su deuda y quién la acumula.',
        ],
      },
      { type: 'goto', tab: 'velocity', label: 'Ir a Security Velocity' },

      { type: 'h', text: '10. Automatizaciones · respuestas automáticas' },
      {
        type: 'list',
        items: [
          'Un runbook es una regla "cuando pase esto, haz esto": por ejemplo, si aparece un secreto, avisar a seguridad y asignar un responsable.',
          'Se revisan solos al terminar cada análisis. Empieza desde una plantilla y ajústala a tu equipo.',
          'Con "Probar" ves qué haría sin enviar ni cambiar nada; el historial muestra todo lo que se ejecutó.',
        ],
      },
      { type: 'goto', tab: 'runbooks', label: 'Ir a Automatizaciones' },

      { type: 'h', text: '11. Resumen ejecutivo · para dirección' },
      {
        type: 'list',
        items: [
          'Una página sin tecnicismos: nota de la A a la F, si mejoramos, los riesgos principales y las decisiones pendientes.',
          'Elige el periodo (mes, trimestre, semestre o año) y si es de toda la organización o de un proyecto.',
          'Descárgalo en PDF o copia el texto para enviarlo por correo.',
        ],
      },
      { type: 'goto', tab: 'executive', label: 'Ir a Resumen ejecutivo' },

      { type: 'h', text: '12. Compliance continuo · la evidencia' },
      {
        type: 'list',
        items: [
          'Activa los marcos que te aplican: ISO 27001, SOC 2, NIST, PCI DSS, CIS, OWASP o la Ley Marco de Ciberseguridad.',
          'Cada marco muestra su porcentaje de preparación y qué requisitos fallan. Un mismo control cuenta para todos los marcos.',
          'Los controles de proceso (política, capacitación, continuidad) se verifican a mano con un enlace a la evidencia.',
          'Descarga el paquete de evidencia de cada marco para entregarlo al auditor.',
        ],
      },
      { type: 'goto', tab: 'reports', label: 'Ir a Compliance continuo' },

      { type: 'h', text: '13. Notificaciones · los avisos' },
      {
        type: 'list',
        items: [
          'La campana muestra los críticos, las fugas de secretos y los altos recientes.',
          'Puedes marcarlas como leídas una a una o todas juntas.',
          'Si un análisis queda bloqueado por el gate, los responsables de seguridad reciben un correo.',
        ],
      },
      { type: 'goto', tab: 'notifications', label: 'Ir a Notificaciones' },

      { type: 'h', text: '14. Pillow · tu asistente en todas las secciones' },
      {
        type: 'list',
        items: [
          'El botón "Pillow" está abajo a la derecha en todas las pantallas. Responde con los datos de la sección donde estás.',
          'La conversación se guarda: puedes cambiar de sección y seguir preguntando sin repetir el contexto. El botón de reinicio empieza una nueva.',
          'Cada pregunta usa un crédito diario. Pillow explica y sugiere; nunca cambia nada por ti.',
        ],
      },

      { type: 'h', text: '15. Observabilidad · la salud de la plataforma' },
      {
        type: 'list',
        items: [
          'Muestra si cada parte de la plataforma funciona: la API, la base de datos, los motores de análisis, el webhook de GitHub, el correo y Pillow.',
          'Los objetivos de servicio dicen si la plataforma cumple lo prometido (por ejemplo, que el 95% de los análisis terminen bien) y cuánto margen queda.',
          'Si algo falló, lo verás en Incidentes recientes con la hora y el detalle.',
        ],
      },
      { type: 'goto', tab: 'observability', label: 'Ir a Observabilidad' },

      { type: 'h', text: '16. Módulos en camino' },
      {
        type: 'p',
        text: 'Las secciones con la etiqueta "Pronto" están en desarrollo: Trazabilidad e Integraciones. Al abrirlas verás qué harán y qué puedes usar mientras tanto.',
      },

      { type: 'h', text: 'Pon a prueba lo aprendido' },
      {
        type: 'steps',
        items: [
          { title: 'Responde a un secreto', text: 'En Secret Management, abre un secreto, asígnate como responsable y lee cómo se rota en su proveedor.' },
          { title: 'Encuentra una actualización', text: 'En la vista agrupada, ubica una librería vulnerable y la versión a la que hay que actualizar.' },
          { title: 'Busca una librería', text: 'En Supply Chain & SBOM, averigua si usas "requests" y en qué versión.' },
          { title: 'Pide una segunda opinión', text: 'En Fix Intelligence, analiza con Pillow el hallazgo más prioritario y decide si aceptas su sugerencia.' },
          { title: 'Toma una decisión', text: 'Marca un hallazgo como En revisión.' },
          { title: 'Explica el gate', text: 'En Security Gates, identifica por qué tu proyecto está aprobado o bloqueado.' },
          { title: 'Busca un término', text: 'En el Glosario, encuentra qué significa "SCA".' },
        ],
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
        text: 'Lanza el perfil "Solo secretos" y abre Secret Management. Sigue el checklist: rota la credencial en el proveedor, revoca la anterior, límpiala del historial de Git (borrarla del código no basta) y verifica. Al completarlo, el secreto se cierra solo y deja de bloquear el gate.',
      },
      { type: 'h', text: '“Actualicé dependencias y quiero comprobarlo”' },
      {
        type: 'p',
        text: 'Lanza "Solo SCA / IaC". Los hallazgos del análisis anterior se reemplazan por los nuevos, así que verás solo lo que sigue pendiente. En Supply Chain & SBOM, el panel del repositorio muestra exactamente qué librerías cambiaron de versión.',
      },
      { type: 'h', text: '“Salió una vulnerabilidad famosa: ¿nos afecta?”' },
      {
        type: 'p',
        text: 'Escribe el nombre de la librería (por ejemplo "log4j") en el buscador de Supply Chain & SBOM. Verás al instante si la usas, en qué repositorios y en qué versión, sin esperar a un nuevo análisis.',
      },
      { type: 'h', text: '“Un cliente o auditor me pide el SBOM”' },
      {
        type: 'p',
        text: 'En Supply Chain & SBOM, usa el botón de descarga del repositorio. Obtienes un archivo CycloneDX 1.5 con todas las librerías, sus licencias y las vulnerabilidades conocidas.',
      },
      { type: 'h', text: '“Cada equipo quiere ver solo sus proyectos”' },
      {
        type: 'p',
        text: 'En Risk Posture, abre "Dashboards" y crea uno por equipo eligiendo sus repositorios. Cada equipo marca el suyo como favorito y ve sus métricas, plazos y bitácora sin el ruido del resto de la organización.',
      },
      { type: 'h', text: '“Quiero demostrar que el equipo está mejorando”' },
      {
        type: 'p',
        text: 'Abre Security Velocity con 90 días. Si el tiempo medio de corrección baja, el flujo neto es positivo y sube el porcentaje corregido en plazo, tienes la evidencia; cada indicador muestra la comparación con el trimestre anterior.',
      },
      { type: 'h', text: '“Quiero enterarme al instante si se filtra una credencial”' },
      {
        type: 'p',
        text: 'En Automatizaciones usa la plantilla "Respuesta a secretos filtrados": avisa por correo al equipo de seguridad, asigna un responsable y deja el secreto en revisión en cuanto un análisis lo detecta. Pulsa "Probar" para ver qué haría antes de activarlo.',
      },
      { type: 'h', text: '“Tengo cientos de hallazgos y no sé por dónde empezar”' },
      {
        type: 'p',
        text: 'Abre Fix Intelligence. La cola ya está ordenada por prioridad: corrige primero los urgentes y los quick wins. Para los dudosos, usa "Analizar con Pillow" y acepta los falsos positivos que Pillow detecte; salen de la cola y no vuelven en los siguientes análisis.',
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
      { type: 'h', text: '“Gerencia me pide un informe de seguridad”' },
      {
        type: 'p',
        text: 'Abre Resumen ejecutivo, elige "Trimestre" y descarga el PDF. Incluye la nota general, si mejoramos respecto al inicio del trimestre, los cinco riesgos principales explicados sin tecnicismos y las decisiones que necesitan su aprobación. Si es para un cliente, elige solo su proyecto.',
      },
      { type: 'h', text: '“Tengo una auditoría (ISO 27001, SOC 2, PCI DSS…)”' },
      {
        type: 'p',
        text: 'En Compliance continuo activa el marco, filtra los requisitos con brecha o sin evidencia y resuélvelos. Para los controles de proceso, enlaza el documento y márcalo como verificado. Al final descarga el paquete de evidencia del marco: incluye los resultados, los responsables y la bitácora de quién decidió qué y cuándo.',
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
    id: 'sbom',
    group: 'Cómo funciona',
    title: 'Supply Chain & SBOM',
    summary: 'El inventario de todas las librerías que usan tus proyectos.',
    blocks: [
      {
        type: 'p',
        text: 'Un SBOM (Software Bill of Materials) es la lista de ingredientes de tu software: cada librería de terceros, su versión y su licencia. SSPILLOWY lo genera automáticamente en cada análisis que incluye dependencias y siempre muestra el más reciente de cada repositorio.',
      },
      { type: 'h', text: 'Qué puedes hacer' },
      {
        type: 'steps',
        items: [
          { title: 'Buscar en toda la organización', text: 'Escribe un nombre de librería y obtienes la respuesta directa: si la usas, en cuántos repositorios y en qué versiones.' },
          { title: 'Ver el riesgo', text: 'Cada librería indica si tiene vulnerabilidades activas, su severidad máxima y la versión mínima a la que actualizar para corregirlas todas.' },
          { title: 'Revisar licencias', text: 'Las licencias copyleft (GPL, AGPL, LGPL, MPL…) se marcan "a revisar" porque pueden obligarte a publicar tu código. Las que no declaran licencia también se señalan.' },
          { title: 'Seguir los cambios', text: 'Cada repositorio muestra qué librerías se añadieron, eliminaron o actualizaron respecto al análisis anterior.' },
          { title: 'Exportar', text: 'Descarga el SBOM en formato estándar CycloneDX 1.5 para clientes, auditores u otras herramientas.' },
        ],
      },
      { type: 'h', text: 'Ecosistemas compatibles' },
      {
        type: 'p',
        text: 'Python (requirements.txt, Pipfile.lock, poetry.lock), Node (package-lock.json, yarn.lock, pnpm-lock.yaml), Go (go.mod), Java (pom.xml, Gradle), Rust (Cargo.lock), PHP (composer.lock), Ruby (Gemfile.lock) y .NET.',
      },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Usa archivos de bloqueo (lockfiles) siempre que puedas: listan también las dependencias indirectas y sus versiones exactas, así el inventario es completo.',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'El inventario se genera con los perfiles "Código completo" y "Solo SCA / IaC". Si un repositorio aparece "Sin SBOM todavía", lanza uno de esos análisis.',
      },
      { type: 'goto', tab: 'sbom', label: 'Abrir Supply Chain & SBOM' },
    ],
  },
  {
    id: 'fix-intelligence',
    group: 'Cómo funciona',
    title: 'Fix Intelligence',
    summary: 'La cola de corrección priorizada y el análisis de Pillow.',
    blocks: [
      {
        type: 'p',
        text: 'Fix Intelligence responde dos preguntas: qué corregir primero y cómo hacerlo. Reúne todos los hallazgos pendientes de todas las herramientas en una sola cola ordenada.',
      },
      { type: 'h', text: 'Cómo se calcula la prioridad' },
      {
        type: 'table',
        head: ['Factor', 'Efecto'],
        rows: [
          ['Severidad', 'Base: crítica 40, alta 30, media 18, baja 8'],
          ['Expuesto en la app en ejecución', '+15: se detectó en la aplicación publicada'],
          ['Credencial filtrada', '+15: un secreto expuesto es explotable de inmediato'],
          ['Fix disponible', '+10: se corrige actualizando una versión (quick win)'],
          ['Inyección (OWASP A03)', '+8: una de las categorías más explotadas'],
          ['Ruta de test o ejemplo', '−15: código que normalmente no llega a producción'],
          ['Opinión de Pillow', '+10 si es probable real, −20 si es probable falso positivo'],
        ],
      },
      { type: 'h', text: 'Análisis con Pillow paso a paso' },
      {
        type: 'steps',
        items: [
          { title: 'Selecciona', text: 'Marca hasta 5 hallazgos o usa "Seleccionar los 5 más prioritarios".' },
          { title: 'Analiza', text: 'Pillow lee cada hallazgo y, si el repositorio es público, el código alrededor de la línea. Nunca se envía el valor de un secreto.' },
          { title: 'Revisa', text: 'Cada hallazgo recibe un veredicto (probable real, requiere revisión o probable falso positivo), un nivel de confianza y la corrección sugerida.' },
          { title: 'Decide', text: 'Aceptar un falso positivo lo marca como tal; aceptar uno real lo pasa a "En revisión". Descartar deja todo como estaba.' },
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Tus decisiones y los análisis de Pillow se conservan al volver a escanear: un falso positivo aceptado no vuelve a aparecer en la cola.',
      },
      {
        type: 'callout',
        tone: 'tip',
        text: 'El indicador "Acierto de Pillow" muestra qué porcentaje de sugerencias aceptó tu equipo. Te ayuda a decidir cuánto confiar en sus sugerencias.',
      },
      { type: 'goto', tab: 'fixIntel', label: 'Abrir Fix Intelligence' },
    ],
  },
  {
    id: 'security-velocity',
    group: 'Cómo funciona',
    title: 'Security Velocity',
    summary: 'Qué tan rápido corrige tu equipo y si la seguridad acompaña el ritmo de entrega.',
    blocks: [
      {
        type: 'p',
        text: 'Security Velocity responde una pregunta: ¿la seguridad acompaña la velocidad del equipo o la frena? Mide el ritmo de corrección de hallazgos y el de entrega (análisis y decisiones del gate) en el periodo que elijas.',
      },
      { type: 'h', text: 'Cómo sabe que algo se corrigió' },
      {
        type: 'p',
        text: 'Cada hallazgo se reconoce por su herramienta, su regla y su archivo, aunque se vuelva a escanear muchas veces. Se considera corregido en el primer análisis posterior del mismo repositorio que ejecutó esa herramienta y ya no lo encontró. Si después vuelve a aparecer, cuenta como "reapareció".',
      },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Para medir bien, vuelve a escanear el repositorio después de cada corrección. Sin un segundo análisis no hay forma de saber que algo se arregló.',
      },
      { type: 'h', text: 'Qué significa cada indicador' },
      {
        type: 'table',
        head: ['Indicador', 'Qué mide'],
        rows: [
          ['Tiempo medio de corrección', 'Días entre que se detecta un hallazgo y el análisis que confirma que ya no está (MTTR). También verás la mediana, menos sensible a casos extremos.'],
          ['Corregidos / Nuevos', 'Hallazgos que salieron y que entraron en el periodo.'],
          ['Flujo neto', 'Corregidos menos nuevos. Positivo: el equipo reduce su deuda; negativo: la acumula.'],
          ['Corregidos en plazo', 'Porcentaje corregido dentro del plazo de su severidad: crítica 7 días, alta 30, media 90, baja 180.'],
          ['Abiertos hoy', 'Pendientes ahora mismo, cuántos ya superaron su plazo y su antigüedad mediana.'],
          ['Análisis por semana', 'Con qué frecuencia se analiza el código.'],
          ['Aprobados por el gate', 'Porcentaje de análisis que pasaron el Security Gate sin bloqueo ni excepción.'],
          ['Excepciones al gate', 'Bypass aprobados en el periodo: si crecen, la política o el backlog necesitan atención.'],
        ],
      },
      {
        type: 'p',
        text: 'Cada indicador se compara con el periodo anterior del mismo largo, en verde si mejora y en rojo si empeora. Los hallazgos marcados como falso positivo o riesgo aceptado no cuentan.',
      },
      { type: 'h', text: 'Cómo leer los gráficos' },
      {
        type: 'list',
        items: [
          'Nuevos vs corregidos por semana: barras rojas y verdes, con la línea azul de pendientes al cierre de cada semana. Si la línea baja, vas ganando.',
          'Tiempo de corrección vs plazo: la barra es el tiempo medio por severidad y la marca negra su plazo. En rojo si se pasa.',
          'Por repositorio: ordenado por vencidos, para ver primero dónde hace falta ayuda.',
          'Críticos y altos más antiguos: lo que lleva más tiempo esperando; desde ahí vas a Fix Intelligence para atacarlo.',
        ],
      },
      { type: 'goto', tab: 'velocity', label: 'Abrir Security Velocity' },
    ],
  },
  {
    id: 'runbooks',
    group: 'Cómo funciona',
    title: 'Automatizaciones',
    summary: 'Respuestas automáticas: cuando pasa algo en un análisis, SSPILLOWY avisa, asigna o actúa por ti.',
    blocks: [
      {
        type: 'p',
        text: 'Un runbook es una regla con tres partes: cuándo se activa, en qué repositorios y qué acciones realiza. Al terminar cada análisis, SSPILLOWY revisa los runbooks activos y ejecuta los que correspondan, sin que nadie tenga que estar mirando.',
      },
      { type: 'h', text: 'Cuándo se activa' },
      {
        type: 'table',
        head: ['Disparador', 'Se activa cuando…'],
        rows: [
          ['Secreto detectado', 'Aparece una credencial que no estaba en análisis anteriores del repositorio.'],
          ['Nuevo hallazgo', 'Aparece un hallazgo nuevo con la severidad mínima que elijas (por ejemplo, alto o más).'],
          ['Gate bloqueado', 'El Security Gate bloquea un análisis.'],
          ['Plazo vencido', 'Un hallazgo pendiente supera el plazo de su severidad. Se avisa una sola vez por hallazgo.'],
          ['Análisis fallido', 'Un análisis termina con error y no produce resultados.'],
        ],
      },
      {
        type: 'p',
        text: 'Solo cuenta lo nuevo: un hallazgo que ya existía en el análisis anterior no vuelve a disparar el runbook, así que no recibirás el mismo aviso cada vez que escanees.',
      },
      { type: 'h', text: 'Qué puede hacer' },
      {
        type: 'table',
        head: ['Acción', 'Qué hace'],
        rows: [
          ['Enviar correo', 'Avisa con un resumen del evento al equipo de seguridad y a los correos que agregues.'],
          ['Publicar en canal', 'Envía el aviso a un canal de Slack, Microsoft Teams o a cualquier URL que reciba avisos (webhook).'],
          ['Asignar responsable', 'Asigna el secreto a una persona en Secret Management, si aún no tiene responsable. Solo con "Secreto detectado".'],
          ['Pasar a En revisión', 'Marca los hallazgos del evento como "En revisión" para que nadie los pase por alto.'],
          ['Relanzar análisis', 'Vuelve a analizar el repositorio. Útil con "Análisis fallido" para superar fallos puntuales de red o descarga.'],
        ],
      },
      { type: 'h', text: 'Cómo crear uno' },
      {
        type: 'steps',
        items: [
          { title: 'Elige una plantilla', text: 'En "Empezar desde una plantilla" hay respuestas listas para los casos más comunes. También puedes partir de cero con "Nuevo runbook".' },
          { title: 'Define cuándo y dónde', text: 'Elige el disparador y si aplica a todos los repositorios (incluidos los que agregues después) o solo a algunos.' },
          { title: 'Agrega acciones', text: 'Puedes combinar varias. Se ejecutan en orden y, si una falla, las demás continúan.' },
          { title: 'Prueba', text: '"Probar" lo evalúa contra el último análisis y muestra qué haría, sin enviar nada ni cambiar ningún hallazgo.' },
          { title: 'Actívalo', text: 'Con el interruptor lo enciendes o apagas cuando quieras sin perder su configuración.' },
        ],
      },
      { type: 'h', text: 'Historial' },
      {
        type: 'p',
        text: 'Cada ejecución queda registrada con fecha, repositorio, resultado y el detalle de cada acción: Correcta (todo salió bien), Parcial (alguna acción falló) o Fallida. Las pruebas aparecen como "Prueba". Las ejecuciones también quedan en la bitácora de auditoría.',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Para enviar correos, tu administrador debe tener configurado el envío de correo y la lista del equipo de seguridad; mientras tanto el editor te lo indica. Para publicar en Slack o Teams, crea un "Incoming Webhook" en el canal y pega su URL (debe empezar por https://).',
      },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Un análisis relanzado por un runbook nunca vuelve a relanzar otro, así que no hay riesgo de bucles. Si ya hay un análisis en curso en el repositorio, el relanzamiento se omite.',
      },
      { type: 'goto', tab: 'runbooks', label: 'Abrir Automatizaciones' },
    ],
  },
  {
    id: 'dashboards',
    group: 'Cómo funciona',
    title: 'Risk Posture (dashboards)',
    summary: 'Tus dashboards, qué muestra cada indicador y cada gráfico.',
    blocks: [
      { type: 'h', text: 'Tus dashboards' },
      {
        type: 'p',
        text: 'Risk Posture abre el último dashboard que viste. El General muestra toda la organización y siempre está disponible. Además puedes crear los tuyos: cada uno elige qué repositorios incluye y muestra las mismas métricas solo de ese alcance.',
      },
      {
        type: 'steps',
        items: [
          { title: 'Crea', text: 'Pulsa "Dashboards" y luego "Nuevo dashboard". Ponle nombre, elige "Toda la organización" o los repositorios que quieras, el periodo y quién lo ve.' },
          { title: 'Personaliza', text: 'Dentro del dashboard, "Personalizar" guarda bloques y umbrales solo para ese dashboard. Los widgets que añadas con Pillow también se quedan en él.' },
          { title: 'Organiza', text: 'Marca con la estrella los que más uses, filtra por favoritos, creados por ti o del equipo, y busca por nombre o por repositorio.' },
          { title: 'Comparte', text: 'Los dashboards "Todo el equipo" los ve cualquiera; los "Solo yo" solo tú. Quien no es el autor puede duplicarlo para hacer su propia versión.' },
        ],
      },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Ejemplos útiles: un dashboard por producto ("Backend de pagos"), uno por cliente para sus informes, o uno con solo los repositorios que van a producción.',
      },
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
    id: 'secret-management',
    group: 'Gobernanza',
    title: 'Secret Management',
    summary: 'Cómo responder a una credencial filtrada hasta cerrarla con evidencia.',
    blocks: [
      {
        type: 'p',
        text: 'Cuando GitLeaks detecta una credencial en tu repositorio, Secret Management la convierte en un incidente con su propio checklist de respuesta. El incidente se mantiene aunque vuelvas a analizar el repositorio, así que el avance no se pierde.',
      },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Borrar el secreto del código no lo invalida: sigue en el historial de Git y cualquiera con acceso al repositorio puede recuperarlo. Lo único que lo neutraliza es rotarlo y revocarlo en el proveedor.',
      },
      { type: 'h', text: 'El checklist de respuesta' },
      {
        type: 'steps',
        items: [
          { title: 'Rotar', text: 'Emite una credencial nueva en el proveedor y despliégala donde se use. El panel muestra cómo hacerlo en AWS, GitHub, Stripe, Google Cloud y otros.' },
          { title: 'Revocar', text: 'Invalida la credencial filtrada en el proveedor y revisa sus registros de acceso por uso indebido.' },
          { title: 'Limpiar historial', text: 'Quita el secreto del código y reescribe el historial de Git (por ejemplo con git filter-repo o BFG).' },
          { title: 'Verificar', text: 'Confirma que la credencial antigua ya no funciona y vuelve a analizar. Solo puedes verificar después de rotar y revocar.' },
        ],
      },
      { type: 'h', text: 'Estados' },
      {
        type: 'table',
        head: ['Estado', 'Significado'],
        rows: [
          ['Abierto', 'Detectado y sin respuesta iniciada'],
          ['En respuesta', 'Tiene responsable o al menos un paso completado'],
          ['Resuelto', 'Los cuatro pasos completos; sus hallazgos pasan a Corregido y dejan de bloquear el gate'],
          ['Falso positivo', 'No es una credencial real; las nuevas detecciones del mismo valor se descartan solas'],
        ],
      },
      { type: 'h', text: 'Qué más registra' },
      {
        type: 'list',
        items: [
          'Responsable y notas de cada incidente.',
          'Quién completó cada paso y cuándo; todo queda en la bitácora de auditoría.',
          '"Detectado en el último análisis" o "Ya no detectado", para saber si el secreto sigue en el código.',
          'Si un secreto resuelto vuelve a aparecer, el incidente se reabre y pide verificar otra vez.',
          'Indicadores: abiertos, en respuesta, críticos sin rotar y tiempo medio de resolución.',
        ],
      },
      { type: 'goto', tab: 'secrets', label: 'Ir a Secret Management' },
    ],
  },
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
    summary: 'Qué tan preparado estás para ISO 27001, SOC 2, NIST, PCI DSS, CIS, OWASP y la Ley Marco de Ciberseguridad.',
    blocks: [
      {
        type: 'p',
        text: 'Compliance continuo trabaja con controles comunes: cada control se prueba una vez y cuenta para todos los marcos que lo piden. Por ejemplo, «Análisis de código» sirve a la vez para ISO 27001, SOC 2, PCI DSS, NIST SSDF y OWASP. Así, sumar un marco nuevo no significa empezar de cero.',
      },
      { type: 'h', text: 'Marcos disponibles' },
      {
        type: 'table',
        head: ['Marco', 'Para qué sirve'],
        rows: [
          ['ISO/IEC 27001:2022', 'Certificación internacional de seguridad de la información.'],
          ['SOC 2', 'Informe de auditoría que piden clientes, sobre todo en Estados Unidos.'],
          ['NIST CSF 2.0', 'Marco de referencia para organizar un programa de ciberseguridad.'],
          ['NIST SSDF', 'Prácticas de desarrollo seguro de software.'],
          ['PCI DSS 4.0', 'Obligatorio si procesas o almacenas datos de tarjetas de pago.'],
          ['CIS Controls v8', 'Buenas prácticas priorizadas y concretas.'],
          ['OWASP Top 10', 'Los diez riesgos más comunes en aplicaciones web.'],
          ['Ley 21.663 (Chile)', 'Ley Marco de Ciberseguridad: deberes de los servicios esenciales y operadores de importancia vital.'],
        ],
      },
      {
        type: 'p',
        text: 'Con «Gestionar marcos» activas solo los que aplican a tu organización. Por defecto vienen activos ISO 27001, NIST SSDF y OWASP Top 10.',
      },
      { type: 'h', text: 'Controles automáticos y manuales' },
      {
        type: 'table',
        head: ['Tipo', 'Cómo se comprueba'],
        rows: [
          ['Automático', 'La plataforma lo verifica sola con sus datos: análisis, inventario de librerías, secretos, Security Gate, excepciones, plazos de corrección, bitácora, automatizaciones y alertas. Se recalcula con cada análisis.'],
          ['Manual', 'Procesos que la plataforma no puede ver, como la política de seguridad, la capacitación o el plan de continuidad. Asignas un responsable, enlazas la evidencia y lo marcas como verificado. La verificación dura 12 meses.'],
        ],
      },
      {
        type: 'p',
        text: 'Si un control no corresponde a tu organización (por ejemplo, no publicas aplicaciones web), márcalo como «No aplica» con una justificación. Queda registrado en la bitácora y deja de contar en el porcentaje.',
      },
      { type: 'h', text: 'Estados' },
      {
        type: 'table',
        head: ['Estado', 'Cuándo'],
        rows: [
          ['Cumple', 'El control funciona y hay evidencia reciente que lo demuestra.'],
          ['Parcial', 'Funciona a medias: quedan hallazgos medios o bajos, falta cobertura, la política es permisiva o la verificación venció.'],
          ['Brecha', 'Hay hallazgos críticos o altos pendientes, secretos sin resolver o el control está desactivado.'],
          ['Falta evidencia', 'Control manual que aún no se ha verificado.'],
          ['No aplica', 'Excluido con una justificación.'],
        ],
      },
      {
        type: 'p',
        text: 'Un requisito toma el peor estado de sus controles. En OWASP Top 10, cada categoría se evalúa con los hallazgos abiertos de esa categoría.',
      },
      { type: 'h', text: 'Porcentaje de preparación' },
      {
        type: 'p',
        text: 'Cada marco muestra un porcentaje: los requisitos que cumplen cuentan completos y los parciales cuentan la mitad. Los que no aplican no cuentan. La pequeña gráfica de cada tarjeta muestra cómo evolucionó en los últimos 90 días.',
      },
      { type: 'h', text: 'Evidencia para el auditor' },
      {
        type: 'list',
        items: [
          '«Paquete de evidencia» descarga un archivo con el estado de cada requisito, el resultado de cada control, sus responsables, las verificaciones y la bitácora de los últimos 90 días.',
          '«CSV» descarga la lista de requisitos para trabajarla en una planilla.',
          'Cada cambio (verificar, marcar «No aplica», activar un marco) queda en la bitácora con autor y fecha.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'La evaluación es orientativa: te dice qué tan cerca estás de cada marco con la evidencia que la plataforma puede comprobar. La certificación la otorga siempre un auditor.',
      },
      {
        type: 'callout',
        tone: 'tip',
        text: 'Compliance continuo está pensado para el auditor: control por control y con evidencia. Para explicar la situación a dirección o a un cliente, usa el Resumen ejecutivo.',
      },
      { type: 'goto', tab: 'reports', label: 'Ver Compliance continuo' },
    ],
  },
  {
    id: 'resumen-ejecutivo',
    group: 'Gobernanza',
    title: 'Resumen ejecutivo',
    summary: 'El estado de la seguridad en una página y sin tecnicismos, para dirección, clientes o directorio.',
    blocks: [
      {
        type: 'p',
        text: 'El Resumen ejecutivo responde tres preguntas: cómo estamos, si vamos mejorando y qué decisiones hacen falta. Está escrito en lenguaje de negocio, así que puedes compartirlo con personas que no son técnicas.',
      },
      { type: 'h', text: 'En qué se diferencia de Compliance continuo' },
      {
        type: 'table',
        head: ['', 'Resumen ejecutivo', 'Compliance continuo'],
        rows: [
          ['Para quién', 'Dirección, clientes, directorio', 'Auditores y responsables de cumplimiento'],
          ['Pregunta', '¿Cómo estamos y qué decidimos?', '¿Qué tan preparados estamos para cada norma?'],
          ['Contenido', 'Nota general, tendencia, riesgos principales y decisiones', 'Requisitos de cada marco, controles, responsables y evidencia'],
          ['Formato', 'Una página en PDF o texto para copiar', 'Vista por marco y por control, paquete de evidencia y CSV'],
        ],
      },
      { type: 'h', text: 'Qué contiene' },
      {
        type: 'table',
        head: ['Parte', 'Qué muestra'],
        rows: [
          ['Nota y postura', 'Una letra de la A a la F y un puntaje de 0 a 100, con su variación en el periodo. Es el mismo puntaje de Risk Posture.'],
          ['Mensajes clave', 'Tres o cuatro frases que resumen el periodo: si mejoró o empeoró, cuánto se corrigió y qué queda grave.'],
          ['Indicadores', 'Problemas graves abiertos, fuera de plazo, tiempo medio de corrección, porcentaje corregido a tiempo y entregas aprobadas, comparados con el inicio del periodo.'],
          ['Riesgos principales', 'Hasta cinco, agrupados por proyecto y tipo de problema, con su impacto explicado y qué hacer.'],
          ['Decisiones pendientes', 'Lo que necesita a alguien con autoridad: excepciones por aprobar, críticos vencidos, credenciales sin responsable, proyectos sin analizar y riesgos aceptados.'],
          ['Logros', 'Lo que el equipo consiguió: problemas corregidos, análisis, despliegues riesgosos detenidos, credenciales resueltas y respuestas automáticas.'],
          ['Cumplimiento', 'El porcentaje de preparación de cada marco activo y los controles que más lo frenan.'],
        ],
      },
      { type: 'h', text: 'Cómo leer la nota' },
      {
        type: 'table',
        head: ['Nota', 'Puntaje', 'Significado'],
        rows: [
          ['A', '90 a 100', 'Sólida: casi sin problemas pendientes.'],
          ['B', '75 a 89', 'Buena: problemas acotados y bajo control.'],
          ['C', '60 a 74', 'Mejorable: conviene dedicarle tiempo.'],
          ['D', '40 a 59', 'Débil: hay riesgos importantes abiertos.'],
          ['F', 'menos de 40', 'Crítica: requiere acción inmediata.'],
        ],
      },
      { type: 'h', text: 'Cómo compartirlo' },
      {
        type: 'steps',
        items: [
          { title: 'Elige el periodo', text: 'Último mes, trimestre, semestre o año. Todo se compara con el inicio de ese periodo.' },
          { title: 'Elige el alcance', text: 'Toda la organización o un solo proyecto, por ejemplo para el cliente de ese proyecto.' },
          { title: 'Descarga el PDF', text: '"Descargar PDF" abre la impresión: elige "Guardar como PDF". El menú y los botones no salen en el documento.' },
          { title: 'O copia el texto', text: '"Copiar resumen" copia los mensajes clave, los riesgos y las decisiones para pegarlos en un correo o un chat.' },
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Para que la tendencia sea fiel, analiza los repositorios con regularidad: un problema solo cuenta como corregido cuando un análisis posterior confirma que ya no está.',
      },
      { type: 'goto', tab: 'executive', label: 'Abrir Resumen ejecutivo' },
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
  {
    id: 'observabilidad',
    group: 'Gobernanza',
    title: 'Observabilidad',
    summary: 'Cómo saber si la plataforma y sus análisis funcionan bien.',
    blocks: [
      {
        type: 'p',
        text: 'Observabilidad muestra la salud de SSPILLOWY: si cada parte está en línea, qué tan rápido responde, cuántos análisis terminan bien y cuánto tardan. Sirve para detectar un problema antes de que alguien lo reporte y para demostrar que la plataforma cumple lo que promete.',
      },
      { type: 'h', text: 'Componentes' },
      {
        type: 'table',
        head: ['Componente', 'Qué se comprueba'],
        rows: [
          ['API', 'Que la plataforma esté en línea y desde cuándo.'],
          ['Base de datos', 'Que responda y en cuánto tiempo.'],
          ['Cola de análisis', 'Cuántos análisis están en curso y si alguno quedó atascado.'],
          ['Motores', 'Que Semgrep, Gitleaks, Trivy y OWASP ZAP estén instalados y no fallen seguido.'],
          ['Webhook de GitHub', 'Que lleguen los avisos de cada push y no fallen.'],
          ['Correo', 'Que los avisos por correo se envíen sin errores.'],
          ['Pillow', 'Que el asistente responda sin errores.'],
        ],
      },
      {
        type: 'table',
        head: ['Estado', 'Significado'],
        rows: [
          ['Operativo', 'Funciona con normalidad.'],
          ['Degradado', 'Funciona, pero con fallos frecuentes o lentitud.'],
          ['Caído', 'No está disponible.'],
          ['Sin configurar', 'No está activado en esta instalación.'],
        ],
      },
      { type: 'h', text: 'Objetivos de servicio' },
      {
        type: 'p',
        text: 'Un objetivo de servicio (SLO) es una promesa medible, por ejemplo: "el 95% de los análisis termina bien". El presupuesto de error es el margen de fallos que esa promesa permite. Si un objetivo pide 95%, se pueden fallar 5 de cada 100; cuando ese margen se agota, el objetivo se incumple.',
      },
      {
        type: 'table',
        head: ['Objetivo', 'Meta'],
        rows: [
          ['Disponibilidad de la API', '99,5% de las peticiones sin error del servidor.'],
          ['Velocidad de la API', '95% de las peticiones respondidas en menos de 1 segundo.'],
          ['Análisis exitosos', '95% de los análisis terminan con resultados.'],
          ['Análisis a tiempo', '90% de los análisis terminan en menos de 15 minutos.'],
          ['Respuestas de Pillow', '95% de las consultas respondidas sin error.'],
        ],
      },
      {
        type: 'p',
        text: 'Cada tarjeta muestra el valor actual, la meta y la barra del presupuesto restante. "Presupuesto casi agotado" avisa cuando queda menos de un 25%.',
      },
      { type: 'h', text: 'Gráficos y tablas' },
      {
        type: 'list',
        items: [
          'Tráfico y latencia: peticiones, errores y el tiempo de respuesta p95 (el 95% de las peticiones fue más rápido que ese valor).',
          'Análisis: exitosos y fallidos por periodo, con su duración media.',
          'Motores: ejecuciones, porcentaje de éxito y duración de cada herramienta.',
          'Rutas de la API: las más usadas, las más lentas y las que tienen errores.',
          'Incidentes recientes: análisis fallidos, motores con error, automatizaciones fallidas, análisis atascados y errores del servidor.',
        ],
      },
      {
        type: 'callout',
        tone: 'tip',
        text: 'La página se actualiza sola cada minuto. Elige 24 horas para ver el detalle por hora, o 7 y 30 días para ver tendencias.',
      },
      { type: 'goto', tab: 'observability', label: 'Ver Observabilidad' },
    ],
  },

  // ───────────────────────── Integraciones
  {
    id: 'prometheus-grafana',
    group: 'Integraciones',
    title: 'Prometheus y Grafana',
    summary: 'Lleva las métricas de la plataforma a tu propio monitoreo.',
    blocks: [
      {
        type: 'p',
        text: 'SSPILLOWY publica sus métricas en formato Prometheus. Así puedes guardar el historial completo, crear alertas propias y armar paneles en Grafana junto al resto de tus sistemas.',
      },
      {
        type: 'steps',
        items: [
          { title: 'Pide el token de métricas', text: 'El administrador de SSPILLOWY habilita las métricas y te entrega el token de acceso.' },
          { title: 'Configura Prometheus', text: 'En Observabilidad, copia la configuración de la tarjeta "Prometheus y Grafana", reemplaza el token y agrégala a tu prometheus.yml.' },
          { title: 'Importa el panel', text: 'Descarga "Panel para Grafana" e impórtalo en Grafana desde Dashboards → New → Import. Elige tu fuente de Prometheus.' },
        ],
      },
      {
        type: 'table',
        head: ['Métrica', 'Qué mide'],
        rows: [
          ['sspillowy_up', 'La plataforma está en línea.'],
          ['sspillowy_http_requests_total', 'Peticiones por ruta y tipo de respuesta.'],
          ['sspillowy_http_request_duration_seconds', 'Tiempo de respuesta por ruta.'],
          ['sspillowy_scans_last_24h', 'Análisis de las últimas 24 horas por estado.'],
          ['sspillowy_engine_available', 'Motores de análisis instalados.'],
          ['sspillowy_findings_open', 'Hallazgos abiertos por severidad.'],
          ['sspillowy_secret_incidents_open', 'Secretos expuestos pendientes.'],
          ['sspillowy_email_sends_total / sspillowy_pillow_requests_total', 'Correos y consultas a Pillow por resultado.'],
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Si el administrador configuró el enlace a Grafana, verás el botón "Abrir Grafana" en Observabilidad.',
      },
      { type: 'goto', tab: 'observability', label: 'Ir a Observabilidad' },
    ],
  },
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
          ['Corregí algo pero sigue apareciendo', 'Lanza un nuevo análisis (o haz push a la rama si tienes el webhook activo): los resultados anteriores se reemplazan por los nuevos.'],
          ['¿Se pierde lo que decidí al volver a escanear?', 'No. Los falsos positivos, riesgos aceptados y análisis de Pillow se trasladan al nuevo análisis.'],
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
