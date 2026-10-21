export type DashboardWidgetId =
  | 'kpis'
  | 'trend'
  | 'gates'
  | 'health'
  | 'sla'
  | 'aging'
  | 'topRepos'
  | 'topComponents'
  | 'triage'
  | 'engines'
  | 'heatmap'
  | 'audit';

/** Anchos en la grilla de 12 (internamente ×5 = columnas de 60). */
export type WidgetSpan = 3 | 4 | 5 | 6 | 8 | 12;

export interface WidgetLayoutItem {
  id: DashboardWidgetId;
  span: WidgetSpan;
}

export interface DashboardThresholds {
  /** Alerta si críticas > este valor (0 = cualquier crítica en rojo). */
  critical_max: number;
  /** Alerta si altas > este valor. */
  high_max: number;
  /** Alerta si hallazgos abiertos > este valor. */
  open_max: number;
  /** Alerta si health score < este valor. */
  health_min: number;
}

export interface DashboardConfig {
  widgets: Record<DashboardWidgetId, boolean>;
  thresholds: DashboardThresholds;
  /** Orden y tamaño de cada bloque. */
  layout: WidgetLayoutItem[];
}

export const WIDGET_IDS: DashboardWidgetId[] = [
  'kpis',
  'trend',
  'gates',
  'health',
  'sla',
  'aging',
  'topRepos',
  'topComponents',
  'triage',
  'engines',
  'heatmap',
  'audit',
];

export const WIDGET_SPAN_OPTIONS: { span: WidgetSpan; label: string }[] = [
  { span: 3, label: '¼' },
  { span: 4, label: '⅓' },
  { span: 5, label: '≈⅖' },
  { span: 6, label: '½' },
  { span: 8, label: '⅔' },
  { span: 12, label: 'Ancho' },
];

export const DEFAULT_LAYOUT: WidgetLayoutItem[] = [
  { id: 'kpis', span: 12 },
  { id: 'trend', span: 8 },
  { id: 'gates', span: 4 },
  { id: 'sla', span: 5 },
  { id: 'aging', span: 3 },
  { id: 'health', span: 4 },
  { id: 'topRepos', span: 4 },
  { id: 'topComponents', span: 4 },
  { id: 'triage', span: 4 },
  { id: 'engines', span: 12 },
  { id: 'heatmap', span: 12 },
  { id: 'audit', span: 12 },
];

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  widgets: {
    kpis: true,
    trend: true,
    gates: true,
    health: true,
    sla: true,
    aging: true,
    topRepos: true,
    topComponents: true,
    triage: true,
    engines: true,
    heatmap: true,
    audit: true,
  },
  thresholds: {
    critical_max: 0,
    high_max: 2,
    open_max: 10,
    health_min: 70,
  },
  layout: structuredClone(DEFAULT_LAYOUT),
};

const STORAGE_KEY = 'sspillowy_dashboard_config';
const VALID_SPANS = new Set<number>([3, 4, 5, 6, 8, 12]);

function parseNumber(value: string | null, fallback: number): number {
  if (value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseWidgets(value: string | null, base: Record<DashboardWidgetId, boolean>) {
  if (!value) return base;
  const wanted = new Set(
    value
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!wanted.size) return base;
  const next = { ...base };
  for (const id of WIDGET_IDS) {
    next[id] = wanted.has(id);
  }
  return next;
}

export function normalizeLayout(layout?: WidgetLayoutItem[] | null): WidgetLayoutItem[] {
  const byId = new Map<DashboardWidgetId, WidgetSpan>();
  if (Array.isArray(layout)) {
    for (const item of layout) {
      if (!item || !WIDGET_IDS.includes(item.id as DashboardWidgetId)) continue;
      const span = VALID_SPANS.has(item.span) ? (item.span as WidgetSpan) : 4;
      byId.set(item.id as DashboardWidgetId, item.id === 'kpis' ? 12 : span);
    }
  }
  const ordered: WidgetLayoutItem[] = [];
  if (Array.isArray(layout)) {
    for (const item of layout) {
      if (!item || !WIDGET_IDS.includes(item.id as DashboardWidgetId)) continue;
      if (ordered.some((o) => o.id === item.id)) continue;
      ordered.push({ id: item.id as DashboardWidgetId, span: byId.get(item.id as DashboardWidgetId) ?? 4 });
    }
  }
  for (const def of DEFAULT_LAYOUT) {
    if (!ordered.some((o) => o.id === def.id)) {
      ordered.push({ id: def.id, span: byId.get(def.id) ?? def.span });
    }
  }
  return ordered;
}

function parseLayout(value: string | null): WidgetLayoutItem[] | null {
  if (!value) return null;
  const items: WidgetLayoutItem[] = [];
  for (const part of value.split(',')) {
    const [rawId, rawSpan] = part.trim().split(':');
    if (!rawId || !WIDGET_IDS.includes(rawId as DashboardWidgetId)) continue;
    const span = Number(rawSpan);
    items.push({
      id: rawId as DashboardWidgetId,
      span: VALID_SPANS.has(span) ? (span as WidgetSpan) : 4,
    });
  }
  return items.length ? items : null;
}

export function moveLayoutItem(layout: WidgetLayoutItem[], fromId: DashboardWidgetId, toId: DashboardWidgetId): WidgetLayoutItem[] {
  if (fromId === toId) return layout;
  const next = [...layout];
  const from = next.findIndex((i) => i.id === fromId);
  const to = next.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0) return layout;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function setLayoutSpan(layout: WidgetLayoutItem[], id: DashboardWidgetId, span: WidgetSpan): WidgetLayoutItem[] {
  return layout.map((item) => (item.id === id ? { ...item, span: id === 'kpis' ? 12 : span } : item));
}

export function mergeDashboardConfig(partial?: Partial<DashboardConfig> | null): DashboardConfig {
  const base = structuredClone(DEFAULT_DASHBOARD_CONFIG);
  if (!partial) return base;
  if (partial.widgets) base.widgets = { ...base.widgets, ...partial.widgets };
  if (partial.thresholds) base.thresholds = { ...base.thresholds, ...partial.thresholds };
  base.layout = normalizeLayout(partial.layout ?? base.layout);
  return base;
}

/** Lee config: defaults → localStorage → query string (query gana). */
export function loadDashboardConfig(): DashboardConfig {
  let config = structuredClone(DEFAULT_DASHBOARD_CONFIG);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<DashboardConfig>;
      config = mergeDashboardConfig(saved);
    }
  } catch {
    // ignore
  }

  const params = new URLSearchParams(window.location.search);
  if (params.has('w') || params.has('widgets')) {
    config.widgets = parseWidgets(params.get('w') ?? params.get('widgets'), config.widgets);
  }
  if (params.has('layout')) {
    config.layout = normalizeLayout(parseLayout(params.get('layout')));
  }
  if (params.has('crit_max') || params.has('critical_max')) {
    config.thresholds.critical_max = parseNumber(
      params.get('crit_max') ?? params.get('critical_max'),
      config.thresholds.critical_max,
    );
  }
  if (params.has('high_max')) {
    config.thresholds.high_max = parseNumber(params.get('high_max'), config.thresholds.high_max);
  }
  if (params.has('open_max')) {
    config.thresholds.open_max = parseNumber(params.get('open_max'), config.thresholds.open_max);
  }
  if (params.has('health_min')) {
    config.thresholds.health_min = parseNumber(params.get('health_min'), config.thresholds.health_min);
  }

  return config;
}

export function saveDashboardConfig(config: DashboardConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function syncDashboardConfigToUrl(config: DashboardConfig): void {
  const params = new URLSearchParams(window.location.search);
  const enabled = config.layout.filter((i) => config.widgets[i.id]).map((i) => i.id);
  params.set('w', enabled.join(','));
  params.set(
    'layout',
    config.layout.map((i) => `${i.id}:${i.span}`).join(','),
  );
  params.set('crit_max', String(config.thresholds.critical_max));
  params.set('high_max', String(config.thresholds.high_max));
  params.set('open_max', String(config.thresholds.open_max));
  params.set('health_min', String(config.thresholds.health_min));
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  window.history.replaceState({}, '', next);
}

export type MetricAlert = 'ok' | 'warn' | 'danger';

export function metricAlert(value: number, maxInclusive: number): MetricAlert {
  if (value > maxInclusive) return 'danger';
  if (value === maxInclusive && maxInclusive === 0) return 'ok';
  if (value > maxInclusive * 0.8) return 'warn';
  return 'ok';
}

export function healthAlert(score: number, min: number): MetricAlert {
  if (score < min) return 'danger';
  if (score < min + 10) return 'warn';
  return 'ok';
}

export const ALERT_COLORS: Record<MetricAlert, string> = {
  ok: '#1a7f37',
  warn: '#bf8700',
  danger: '#cf222e',
};

/** Paleta de alto contraste y claridad para gráficos del dashboard. */
export const PASTEL_SEVERITY: Record<string, string> = {
  CRITICAL: '#e5484d',
  HIGH: '#f76b15',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  INFO: '#8c959f',
};

export const PASTEL_GATE: Record<string, string> = {
  PASSED: '#2da44e',
  BLOCKED: '#e5484d',
  BYPASSED: '#8250df',
  OTHER: '#94a3b8',
};

export const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  kpis: 'KPIs con tendencia',
  trend: 'Detección por severidad',
  gates: 'Resultados del Security Gate',
  health: 'Health score',
  sla: 'Cumplimiento de plazos (SLA)',
  aging: 'Antigüedad de hallazgos',
  topRepos: 'Repos con más riesgo',
  topComponents: 'Componentes más vulnerables',
  triage: 'Embudo de triage HITL',
  engines: 'Motor × severidad',
  heatmap: 'Mapa de calor',
  audit: 'Bitácora',
};

export const WIDGET_HINTS: Record<DashboardWidgetId, string> = {
  kpis: 'Indicadores clave arriba del tablero',
  trend: 'Área apilada de hallazgos por día',
  gates: 'Donut de aprobado / bloqueado / bypass',
  health: 'Puntuación global y desglose',
  sla: 'Hallazgos dentro o fuera de plazo',
  aging: 'Antigüedad de lo que sigue abierto',
  topRepos: 'Repos ordenados por riesgo',
  topComponents: 'Archivos o paquetes más afectados',
  triage: 'Embudo de estados HITL',
  engines: 'Matriz motor × severidad',
  heatmap: 'Actividad de hallazgos en el calendario',
  audit: 'Últimos eventos del espacio',
};

export const WIDGET_GROUPS: { title: string; ids: DashboardWidgetId[] }[] = [
  { title: 'Resumen', ids: ['kpis', 'health', 'gates', 'sla'] },
  { title: 'Tendencias', ids: ['trend', 'aging', 'heatmap'] },
  { title: 'Detalle', ids: ['topRepos', 'topComponents', 'triage', 'engines', 'audit'] },
];
