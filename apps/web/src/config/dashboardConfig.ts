export type DashboardWidgetId =
  | 'kpis'
  | 'engines'
  | 'trend'
  | 'health'
  | 'heatmap'
  | 'audit';

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
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  widgets: {
    kpis: true,
    engines: true,
    trend: true,
    health: true,
    heatmap: true,
    audit: true,
  },
  thresholds: {
    critical_max: 0,
    high_max: 2,
    open_max: 10,
    health_min: 70,
  },
};

const STORAGE_KEY = 'sspillowy_dashboard_config';

const WIDGET_IDS: DashboardWidgetId[] = ['kpis', 'engines', 'trend', 'health', 'heatmap', 'audit'];

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

/** Lee config: defaults → localStorage → query string (query gana). */
export function loadDashboardConfig(): DashboardConfig {
  let config: DashboardConfig = structuredClone(DEFAULT_DASHBOARD_CONFIG);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<DashboardConfig>;
      if (saved.widgets) config.widgets = { ...config.widgets, ...saved.widgets };
      if (saved.thresholds) config.thresholds = { ...config.thresholds, ...saved.thresholds };
    }
  } catch {
    // ignore
  }

  const params = new URLSearchParams(window.location.search);
  if (params.has('w') || params.has('widgets')) {
    config.widgets = parseWidgets(params.get('w') ?? params.get('widgets'), config.widgets);
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
  const enabled = WIDGET_IDS.filter((id) => config.widgets[id]);
  params.set('w', enabled.join(','));
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

export const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  kpis: 'Tarjetas KPI',
  engines: 'Hallazgos por motor',
  trend: 'Tendencia 7 días',
  health: 'Health score',
  heatmap: 'Mapa de calor',
  audit: 'Bitácora',
};
