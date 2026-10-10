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
