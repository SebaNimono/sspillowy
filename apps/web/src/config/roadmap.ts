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
