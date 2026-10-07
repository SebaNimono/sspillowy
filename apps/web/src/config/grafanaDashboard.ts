/** Panel de Grafana importable (Dashboards → New → Import) con las métricas de /metrics. */

const DS = { type: 'prometheus', uid: '${DS_PROMETHEUS}' };

type Panel = {
  title: string;
  type: 'timeseries' | 'stat' | 'bargauge';
  w: number;
  h: number;
  unit?: string;
  targets: { expr: string; legend?: string }[];
};

const PANELS: Panel[] = [
  { title: 'API en línea', type: 'stat', w: 4, h: 4, targets: [{ expr: 'sspillowy_up' }] },
  { title: 'Base de datos', type: 'stat', w: 4, h: 4, targets: [{ expr: 'sspillowy_database_up' }] },
  { title: 'Análisis en curso', type: 'stat', w: 4, h: 4, targets: [{ expr: 'sspillowy_scans_running' }] },
  { title: 'Secretos pendientes', type: 'stat', w: 4, h: 4, targets: [{ expr: 'sspillowy_secret_incidents_open' }] },
  {
    title: 'Motores disponibles',
    type: 'stat',
    w: 8,
    h: 4,
    targets: [{ expr: 'sspillowy_engine_available', legend: '{{engine}}' }],
  },
  {
    title: 'Peticiones por segundo',
    type: 'timeseries',
    w: 12,
    h: 8,
    unit: 'reqps',
    targets: [{ expr: 'sum by (status) (rate(sspillowy_http_requests_total[5m]))', legend: '{{status}}' }],
  },
  {
    title: 'Errores del servidor',
    type: 'timeseries',
    w: 12,
    h: 8,
    unit: 'percent',
    targets: [
      {
        expr: '100 * sum(rate(sspillowy_http_requests_total{status="5xx"}[5m])) / clamp_min(sum(rate(sspillowy_http_requests_total[5m])), 1e-9)',
        legend: '5xx',
      },
    ],
  },
  {
    title: 'Latencia p95',
    type: 'timeseries',
    w: 12,
    h: 8,
    unit: 's',
    targets: [{ expr: 'histogram_quantile(0.95, sum by (le) (rate(sspillowy_http_request_duration_seconds_bucket[5m])))', legend: 'p95' }],
  },
  {
    title: 'Rutas más lentas (p95)',
    type: 'bargauge',
    w: 12,
    h: 8,
    unit: 's',
    targets: [
      {
        expr: 'topk(8, histogram_quantile(0.95, sum by (le, method, route) (rate(sspillowy_http_request_duration_seconds_bucket[30m]))))',
        legend: '{{method}} {{route}}',
      },
    ],
  },
  {
    title: 'Análisis de las últimas 24 h',
    type: 'timeseries',
    w: 12,
    h: 8,
    targets: [{ expr: 'sspillowy_scans_last_24h', legend: '{{status}}' }],
  },
  {
    title: 'Duración media de los análisis',
    type: 'timeseries',
    w: 12,
    h: 8,
    unit: 's',
    targets: [{ expr: 'sspillowy_scan_duration_seconds_avg_24h', legend: 'media 24 h' }],
  },
  {
    title: 'Hallazgos abiertos por severidad',
    type: 'timeseries',
    w: 12,
    h: 8,
    targets: [{ expr: 'sspillowy_findings_open', legend: '{{severity}}' }],
  },
  {
    title: 'Correos y Pillow (última hora)',
    type: 'timeseries',
    w: 12,
    h: 8,
    targets: [
      { expr: 'sum by (result) (increase(sspillowy_email_sends_total[1h]))', legend: 'correo {{result}}' },
      { expr: 'sum by (result) (increase(sspillowy_pillow_requests_total[1h]))', legend: 'Pillow {{result}}' },
    ],
  },
];

export function buildGrafanaDashboard(): string {
  let x = 0;
  let y = 0;
  let rowH = 0;
  const panels = PANELS.map((p, i) => {
    if (x + p.w > 24) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    const gridPos = { x, y, w: p.w, h: p.h };
    x += p.w;
    rowH = Math.max(rowH, p.h);
    return {
      id: i + 1,
      title: p.title,
      type: p.type,
      datasource: DS,
      gridPos,
      fieldConfig: { defaults: { unit: p.unit ?? 'short' }, overrides: [] },
      options: p.type === 'stat' ? { colorMode: 'value', graphMode: 'none', reduceOptions: { calcs: ['lastNotNull'] } } : {},
      targets: p.targets.map((t, j) => ({
        datasource: DS,
        expr: t.expr,
        legendFormat: t.legend ?? '',
        refId: String.fromCharCode(65 + j),
      })),
    };
  });
  return JSON.stringify(
    {
      __inputs: [
        { name: 'DS_PROMETHEUS', label: 'Prometheus', type: 'datasource', pluginId: 'prometheus', pluginName: 'Prometheus' },
      ],
      title: 'SSPILLOWY · Salud de la plataforma',
      uid: 'sspillowy-health',
      tags: ['sspillowy'],
      timezone: 'browser',
      schemaVersion: 39,
      refresh: '1m',
      time: { from: 'now-24h', to: 'now' },
      panels,
    },
    null,
    2,
  );
}
