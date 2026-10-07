import { useEffect } from 'react';

export interface PillowChatLine {
  role: 'user' | 'pillow';
  text: string;
  page?: string;
  suggestions?: { type: string; title: string; metric?: string | null }[];
}

export const PILLOW_PAGE_LABEL: Record<string, string> = {
  dashboard: 'Risk Posture',
  velocity: 'Security Velocity',
  executive: 'Resumen ejecutivo',
  runbooks: 'Automatizaciones',
  repositories: 'Repositorios',
  findings: 'Priorización contextual',
  fixIntel: 'Fix Intelligence',
  secrets: 'Secret Management',
  sbom: 'Supply Chain & SBOM',
  scans: 'Escaneos',
  gates: 'Security Gates',
  notifications: 'Notificaciones',
  reports: 'Compliance continuo',
  observability: 'Observabilidad',
  docs: 'Documentación',
};

export const PILLOW_PAGE_SUGGESTIONS: Record<string, string[]> = {
  dashboard: [
    '¿Cómo monitoreo hallazgos críticos esta semana?',
    'Quiero ver distribución por motor de escaneo',
    'Resume el health score y severidades abiertas',
  ],
  velocity: [
    '¿Estamos corrigiendo más rápido que antes?',
    '¿Qué repositorio se está quedando atrás?',
    '¿Cómo bajo el tiempo medio de corrección?',
  ],
  executive: [
    'Explícame este resumen como para gerencia',
    '¿Qué decisión debería tomar primero?',
    '¿Qué le digo a un cliente sobre nuestra seguridad?',
  ],
  observability: [
    '¿Está todo funcionando bien?',
    '¿Por qué se incumple este objetivo de servicio?',
    '¿Qué significa el presupuesto de error?',
  ],
  runbooks: [
    '¿Qué runbooks me recomiendas para empezar?',
    '¿Por qué falló la última ejecución?',
    '¿Cómo conecto un canal de Slack?',
  ],
  findings: ['¿Qué hallazgos debería atender primero?', '¿Cuándo conviene aceptar un riesgo?'],
  fixIntel: [
    '¿Por dónde empiezo con esta cola?',
    'Explícame los quick wins disponibles',
    '¿Cómo confirmo si algo es falso positivo?',
  ],
  secrets: ['¿Qué hago primero si se filtró una credencial?', '¿Por qué hay que limpiar el historial?'],
  sbom: ['¿Qué dependencias me exponen más?', '¿Cómo reduzco paquetes vulnerables?'],
  scans: ['¿Qué hace cada motor de escaneo?', '¿Cada cuánto debería escanear?'],
  gates: ['¿Qué política de gate me recomiendas?', '¿Cuándo es válido un bypass?'],
  reports: [
    '¿Qué controles debo resolver primero para subir mi preparación?',
    '¿Qué marcos me conviene activar?',
    '¿Qué evidencia necesito para los controles manuales?',
  ],
};

const DEFAULT_SUGGESTIONS = ['¿Qué puedo hacer en esta sección?', '¿Cuál es mi mayor riesgo ahora?'];

export function suggestionsFor(page: string): string[] {
  return PILLOW_PAGE_SUGGESTIONS[page] ?? DEFAULT_SUGGESTIONS;
}

const pageContexts = new Map<string, Record<string, unknown>>();

export function getPillowPageContext(page: string): Record<string, unknown> | undefined {
  return pageContexts.get(page);
}

/** Cada página publica un resumen de lo que muestra para que Pillow responda con esos datos. */
export function usePillowPageContext(page: string, data: Record<string, unknown> | null | undefined): void {
  useEffect(() => {
    if (data) pageContexts.set(page, data);
    return () => {
      pageContexts.delete(page);
    };
  }, [page, data]);
}

const CHAT_KEY_PREFIX = 'sspillowy_pillow_chat:';
const MAX_STORED_LINES = 40;

export function loadPillowChat(userKey: string): PillowChatLine[] {
  if (!userKey) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_KEY_PREFIX + userKey) || '[]') as PillowChatLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePillowChat(userKey: string, lines: PillowChatLine[]): void {
  if (!userKey) return;
  try {
    localStorage.setItem(CHAT_KEY_PREFIX + userKey, JSON.stringify(lines.slice(-MAX_STORED_LINES)));
  } catch {
    // ignore
  }
}
