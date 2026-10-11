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

export const ROADMAP: Record<string, RoadmapModule> = {};
