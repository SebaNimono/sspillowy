export type RoadmapStage = 'mvp' | 'next';

export interface RoadmapModule {
  id: string;
  title: string;
  tagline: string;
  description: string;
  features: string[];
  howItWorks: string[];
  stage: RoadmapStage;
  meanwhile?: { tab: string; label: string };
}

export const STAGE_LABEL: Record<RoadmapStage, string> = {
  mvp: 'En desarrollo · primera versión',
  next: 'En la hoja de ruta',
};

export const ROADMAP: Record<string, RoadmapModule> = {
  executive: {
    id: 'executive',
    title: 'Resumen ejecutivo',
    tagline: 'La postura de seguridad en una página, para dirección.',
    description:
      'Un informe breve y sin tecnicismos que resume el estado de seguridad de la organización, su evolución y los riesgos principales, listo para compartir.',
    features: [
      'Puntaje de salud global y su variación en el periodo.',
      'Los 5 riesgos principales explicados en lenguaje de negocio.',
      'Cumplimiento de plazos y de la política del gate.',
      'Exportación a PDF y envío periódico por correo.',
    ],
    howItWorks: [
      'Toma los datos de Risk Posture y de Compliance continuo.',
      'Selecciona automáticamente lo más relevante del periodo.',
      'Genera el documento en un formato fijo y comparable mes a mes.',
    ],
    stage: 'mvp',
    meanwhile: { tab: 'dashboard', label: 'Ver Risk Posture' },
  },
  runbooks: {
    id: 'runbooks',
    title: 'Runbooks & RPA',
    tagline: 'Respuestas automáticas ante eventos de seguridad.',
    description:
      'Define reglas del tipo "si pasa esto, haz aquello" para que SSPILLOWY responda solo ante eventos frecuentes, sin intervención manual.',
    features: [
      'Disparadores: secreto detectado, nuevo crítico, gate bloqueado, plazo vencido.',
      'Acciones: avisar por correo, crear una tarea, asignar un responsable, lanzar un análisis.',
      'Plantillas listas para los casos más comunes.',
      'Historial de cada ejecución.',
    ],
    howItWorks: [
      'Eliges un disparador y una o varias acciones.',
      'La regla se evalúa al terminar cada análisis o cambio de estado.',
      'Cada ejecución queda registrada en la bitácora.',
    ],
    stage: 'next',
    meanwhile: { tab: 'notifications', label: 'Ver Notificaciones' },
  },
  observability: {
    id: 'observability',
    title: 'Observabilidad',
    tagline: 'La salud de la plataforma, conectada con Prometheus y Grafana.',
    description:
      'Indicadores de funcionamiento de SSPILLOWY (disponibilidad, duración de los análisis, errores) expuestos para Prometheus y visualizados en Grafana.',
    features: [
      'Disponibilidad y tiempos de respuesta.',
      'Duración y tasa de éxito de los análisis por herramienta.',
      'Objetivos de servicio (SLO) y presupuesto de error.',
      'Acceso directo a los paneles de Grafana.',
    ],
    howItWorks: [
      'La plataforma publica sus métricas en formato Prometheus.',
      'Grafana las consulta y las muestra en paneles.',
      'Este módulo resume el estado y enlaza a los paneles.',
    ],
    stage: 'next',
    meanwhile: { tab: 'scans', label: 'Ver Escaneos' },
  },
  traceability: {
    id: 'traceability',
    title: 'Trazabilidad',
    tagline: 'La historia completa de cada hallazgo, de principio a fin.',
    description:
      'Reconstruye el recorrido de un hallazgo: en qué commit apareció, qué análisis lo detectó, quién lo revisó, si hubo una excepción y cuándo se corrigió. Ideal para auditorías.',
    features: [
      'Línea de tiempo por hallazgo con cada evento y su autor.',
      'Relación entre commit, análisis, decisión del gate y bypass.',
      'Búsqueda por repositorio, persona o periodo.',
      'Exportación como evidencia de auditoría.',
    ],
    howItWorks: [
      'Une la bitácora de acciones con los análisis y los hallazgos.',
      'Ordena los eventos en una línea de tiempo.',
      'Permite descargar el recorrido completo.',
    ],
    stage: 'next',
    meanwhile: { tab: 'reports', label: 'Ver Compliance continuo' },
  },
  integrations: {
    id: 'integrations',
    title: 'Integraciones',
    tagline: 'Conecta SSPILLOWY con las herramientas de tu equipo.',
    description:
      'Un catálogo de integraciones con su estado (conectada o no) y una guía para configurarlas.',
    features: [
      'Repositorios: GitHub (disponible) y GitLab.',
      'Comunicación: correo (disponible), Slack y Microsoft Teams.',
      'Gestión de tareas: Jira.',
      'Monitoreo: Prometheus y Grafana.',
    ],
    howItWorks: [
      'Cada integración muestra si está activa y qué permite hacer.',
      'Se configura desde una guía paso a paso.',
      'Las nuevas integraciones se suman al catálogo progresivamente.',
    ],
    stage: 'next',
    meanwhile: { tab: 'repositories', label: 'Configurar webhook de GitHub' },
  },
};
