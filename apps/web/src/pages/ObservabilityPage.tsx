import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Gauge,
  MinusCircle,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { ObsComponentStatus, ObsRange, ObsSlo, ObservabilityData, fetchObservability } from '../api/client';
import { buildGrafanaDashboard } from '../config/grafanaDashboard';
import { usePillowPageContext } from '../config/pillowContext';
import { formatDateTime } from '../utils/formatDateTime';
import { timeAgo } from '../utils/timeAgo';
import '../styles/velocity.css';
import '../styles/observability.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const RANGES: { id: ObsRange; label: string }[] = [
  { id: '24h', label: '24 horas' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
];
const RANGE_KEY = 'sspillowy_observability_range';
const REFRESH_MS = 60_000;

const COMPONENT_META: Record<ObsComponentStatus, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  up: { label: 'Operativo', color: '#1a7f37', Icon: CheckCircle2 },
  degraded: { label: 'Degradado', color: '#9a6700', Icon: AlertTriangle },
  down: { label: 'Caído', color: '#cf222e', Icon: XCircle },
  unconfigured: { label: 'Sin configurar', color: '#8c959f', Icon: MinusCircle },
};

const OVERALL = {
  operational: { text: 'Todos los sistemas operativos', tone: 'is-ok' },
  degraded: { text: 'Funcionamiento degradado', tone: 'is-warn' },
  down: { text: 'Servicio caído', tone: 'is-bad' },
} as const;

const SLO_META: Record<ObsSlo['status'], { label: string; color: string }> = {
  ok: { label: 'Dentro del objetivo', color: '#1a7f37' },
  at_risk: { label: 'Presupuesto casi agotado', color: '#9a6700' },
  breached: { label: 'Objetivo incumplido', color: '#cf222e' },
  no_data: { label: 'Sin datos aún', color: '#8c959f' },
};

const fmtMs = (v: number | null) => (v === null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);
const fmtSecs = (v: number | null) => (v === null ? '—' : v >= 60 ? `${(v / 60).toFixed(1)} min` : `${v} s`);
const fmtNum = (v: number) => v.toLocaleString('es-CL');

function fmtUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export const ObservabilityPage: React.FC<PageProps> = ({ onNavigate, ...headerProps }) => {
  const [range, setRange] = useState<ObsRange>(() => {
    const saved = localStorage.getItem(RANGE_KEY) as ObsRange | null;
    return RANGES.some((r) => r.id === saved) ? (saved as ObsRange) : '24h';
  });
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeSort, setRouteSort] = useState<'count' | 'p95' | 'errors'>('count');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchObservability(range));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el estado de la plataforma');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const changeRange = (r: ObsRange) => {
    setRange(r);
    localStorage.setItem(RANGE_KEY, r);
  };

  const pillowContext = useMemo(() => {
    if (!data) return null;
    return {
      periodo: RANGES.find((r) => r.id === data.range)?.label,
      estado_general: OVERALL[data.status].text,
      componentes_con_problemas: data.components
        .filter((c) => c.status !== 'up')
        .map((c) => `${c.name}: ${COMPONENT_META[c.status].label} (${c.detail})`),
      objetivos: data.slos.map((s) => ({
        objetivo: s.name,
        meta: `${s.target}%`,
        actual: s.value === null ? 'sin datos' : `${s.value}%`,
        presupuesto_restante: s.budget_remaining === null ? null : `${s.budget_remaining}%`,
        estado: SLO_META[s.status].label,
      })),
      indicadores: data.kpis,
      motores: data.engines.map((e) => ({ motor: e.name, disponible: e.available, ejecuciones: e.runs, fallos: e.failures, duracion_media_s: e.avg_s })),
      incidentes_recientes: data.incidents.slice(0, 8).map((i) => `${i.title} · ${i.target ?? ''} · ${i.detail}`),
    };
  }, [data]);
  usePillowPageContext('observability', pillowContext);

  const chartData = useMemo(() => {
    if (!data) return [];
    const hourly = data.range === '24h';
    return data.series.map((p) => {
      const d = new Date(p.t);
      return {
        ...p,
        label: hourly
          ? d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }),
      };
    });
  }, [data]);

  const routes = useMemo(() => {
    const list = [...(data?.routes ?? [])];
    if (routeSort === 'p95') list.sort((a, b) => (b.p95_ms ?? 0) - (a.p95_ms ?? 0));
    if (routeSort === 'errors') list.sort((a, b) => b.error_pct - a.error_pct || b.count - a.count);
    return list;
  }, [data, routeSort]);

  const scrapeConfig = data
    ? `scrape_configs:
  - job_name: sspillowy
    scheme: https
    metrics_path: /metrics
    scrape_interval: 60s
    authorization:
      credentials: <TOKEN_DE_METRICAS>
    static_configs:
      - targets: ['${new URL(data.integrations.metrics_url).host}']`
    : '';

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(scrapeConfig);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const k = data?.kpis;

  return (
    <div className="ob-page">
      <Header
        title="Observabilidad"
        subtitle="La salud de SSPILLOWY y de su pipeline de seguridad: disponibilidad, tiempos de respuesta, análisis y objetivos de servicio."
        onNavigate={onNavigate}
        {...headerProps}
      />

      <div className="card vl-toolbar">
        <div className="vl-ranges" role="group" aria-label="Periodo">
          {RANGES.map((r) => (
            <button key={r.id} type="button" className={`vl-range ${range === r.id ? 'is-active' : ''}`} onClick={() => changeRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="ob-toolbar-actions">
          {data && <span className="ob-muted">Actualizado {timeAgo(data.generated_at)} · se refresca cada minuto</span>}
          {data?.platform_view && data.integrations.grafana_url && (
            <a className="btn btn-secondary" href={data.integrations.grafana_url} target="_blank" rel="noreferrer noopener">
              <ExternalLink size={15} /> Abrir Grafana
            </a>
          )}
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} aria-label="Actualizar">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="card ob-error">{error}</div>}
      {!data && loading && <div className="card ob-empty">Midiendo la plataforma…</div>}

      {data && (
        <>
          <div className={`ob-banner ${OVERALL[data.status].tone}`}>
            <Activity size={18} />
            <strong>{OVERALL[data.status].text}</strong>
            <span>En línea desde hace {fmtUptime(data.uptime_seconds)}</span>
          </div>

          <section className="ob-components">
            {data.components.map((c) => {
              const m = COMPONENT_META[c.status];
              return (
                <div key={c.id} className={`ob-component is-${c.status}`}>
                  <m.Icon size={16} color={m.color} />
                  <div>
                    <strong>{c.name}</strong>
                    <small>
                      {c.detail}
                      {c.last ? ` · último ${timeAgo(c.last)}` : ''}
                    </small>
                  </div>
                  <span style={{ color: m.color }}>{m.label}</span>
                </div>
              );
            })}
          </section>

          <h2 className="ob-section-title">
            <Gauge size={16} /> Objetivos de servicio
          </h2>
          <section className="ob-slos">
            {data.slos.map((s) => {
              const meta = SLO_META[s.status];
              const budget = s.budget_remaining === null ? null : Math.max(0, s.budget_remaining);
              return (
                <div key={s.id} className="card ob-slo">
                  <div className="ob-slo-head">
                    <strong>{s.name}</strong>
                    <span style={{ color: meta.color }}>{meta.label}</span>
                  </div>
                  <div className="ob-slo-value">
                    <b style={{ color: s.value === null ? undefined : meta.color }}>{s.value === null ? '—' : `${s.value}%`}</b>
                    <small>meta {s.target}%</small>
                  </div>
                  <p>{s.description}</p>
                  <div className="ob-budget" aria-label="Presupuesto de error restante">
                    <i style={{ width: `${budget ?? 0}%`, background: meta.color }} />
                  </div>
                  <small className="ob-muted">
                    {s.total
                      ? `Presupuesto de error: ${budget === null ? '—' : `${Math.round(budget)}% restante`} · ${fmtNum(s.bad)} de ${fmtNum(s.total)} fuera del objetivo`
                      : 'Se calculará con la actividad del periodo.'}
                  </small>
                </div>
              );
            })}
          </section>

          <section className="ob-kpis">
            {data.platform_view && (
              <>
                <div>
                  <span>Peticiones</span>
                  <strong>{fmtNum(k!.requests)}</strong>
                </div>
                <div>
                  <span>Errores del servidor</span>
                  <strong className={k!.error_pct ? 'is-bad' : ''}>{k!.error_pct === null ? '—' : `${k!.error_pct}%`}</strong>
                </div>
                <div>
                  <span>Latencia p95</span>
                  <strong>{fmtMs(k!.p95_ms)}</strong>
                </div>
              </>
            )}
            <div>
              <span>Análisis terminados</span>
              <strong>{fmtNum(k!.scans)}</strong>
            </div>
            <div>
              <span>Análisis exitosos</span>
              <strong>{k!.scan_success_pct === null ? '—' : `${k!.scan_success_pct}%`}</strong>
            </div>
            <div>
              <span>Duración típica</span>
              <strong>{k!.scan_median_minutes === null ? '—' : `${k!.scan_median_minutes} min`}</strong>
            </div>
          </section>

          <div className={data.platform_view ? 'ob-charts' : 'ob-charts ob-charts--single'}>
            {data.platform_view && (
            <div className="card">
              <h3>Tráfico y latencia de la API</h3>
              <div className="ob-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eaeef2" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
                    <YAxis yAxisId="req" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis yAxisId="ms" orientation="right" tick={{ fontSize: 11 }} unit=" ms" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="req" dataKey="requests" name="Peticiones" fill="#54aeff" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="req" dataKey="errors" name="Errores" fill="#cf222e" radius={[3, 3, 0, 0]} />
                    <Line yAxisId="ms" type="monotone" dataKey="p95_ms" name="p95 (ms)" stroke="#8250df" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            )}
            <div className="card">
              <h3>Análisis y su duración</h3>
              <div className="ob-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eaeef2" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
                    <YAxis yAxisId="n" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis yAxisId="min" orientation="right" tick={{ fontSize: 11 }} unit=" min" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="n" dataKey="scans_ok" name="Exitosos" stackId="s" fill="#2da44e" />
                    <Bar yAxisId="n" dataKey="scans_failed" name="Fallidos" stackId="s" fill="#cf222e" radius={[3, 3, 0, 0]} />
                    <Line yAxisId="min" type="monotone" dataKey="scan_minutes" name="Duración media (min)" stroke="#bf8700" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="ob-grid">
            <div className="card">
              <h3>Motores de análisis</h3>
              <div className="table-container">
                <table className="custom-table ob-table">
                  <thead>
                    <tr>
                      <th>Motor</th>
                      <th>Ejecuciones</th>
                      <th>Éxito</th>
                      <th>Media</th>
                      <th>p95</th>
                      <th>Última</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.engines.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <span className="ob-dot" style={{ background: e.available ? '#1a7f37' : '#cf222e' }} />
                          {e.name}
                        </td>
                        <td>{e.runs}</td>
                        <td className={e.failures ? 'is-bad' : ''}>{e.success_pct === null ? '—' : `${e.success_pct}%`}</td>
                        <td>{fmtSecs(e.avg_s)}</td>
                        <td>{fmtSecs(e.p95_s)}</td>
                        <td className="ob-muted">{e.last_run ? timeAgo(e.last_run) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {k!.clone_avg_s !== null && <small className="ob-muted">Descarga del repositorio: {fmtSecs(k!.clone_avg_s)} de media.</small>}
            </div>

            {data.platform_view && (
            <div className="card">
              <div className="ob-card-head">
                <h3>Rutas de la API</h3>
                <div className="vl-ranges ob-mini-tabs" role="group" aria-label="Ordenar rutas">
                  {(
                    [
                      ['count', 'Más usadas'],
                      ['p95', 'Más lentas'],
                      ['errors', 'Con errores'],
                    ] as const
                  ).map(([id, label]) => (
                    <button key={id} type="button" className={`vl-range ${routeSort === id ? 'is-active' : ''}`} onClick={() => setRouteSort(id)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {routes.length ? (
                <div className="table-container">
                  <table className="custom-table ob-table">
                    <thead>
                      <tr>
                        <th>Ruta</th>
                        <th>Peticiones</th>
                        <th>p95</th>
                        <th>Errores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routes.map((r) => (
                        <tr key={`${r.method} ${r.path}`}>
                          <td className="ob-route">
                            <code>{r.method}</code> {r.path === 'unmatched' ? 'Rutas inexistentes' : r.path}
                          </td>
                          <td>{fmtNum(r.count)}</td>
                          <td className={(r.p95_ms ?? 0) > 1000 ? 'is-warn' : ''}>{fmtMs(r.p95_ms)}</td>
                          <td className={r.error_pct ? 'is-bad' : ''}>{r.error_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="ob-muted">Aún no hay peticiones registradas en el periodo.</p>
              )}
            </div>
            )}

            <div className="card">
              <h3>Incidentes recientes</h3>
              {data.incidents.length ? (
                <ul className="ob-incidents">
                  {data.incidents.map((i, idx) => (
                    <li key={`${i.at}-${idx}`} className={`is-${i.severity}`}>
                      {i.severity === 'error' ? <XCircle size={15} /> : <AlertTriangle size={15} />}
                      <div>
                        <strong>
                          {i.title}
                          {i.target ? ` · ${i.target}` : ''}
                        </strong>
                        {i.detail && <small>{i.detail}</small>}
                      </div>
                      <time title={formatDateTime(i.at)}>{timeAgo(i.at)}</time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ob-ok">
                  <CheckCircle2 size={15} /> Sin incidentes en el periodo.
                </p>
              )}
            </div>
          </div>

          {data.platform_view && (
          <div className="ob-grid">
            <div className="card ob-connect">
              <h3>
                <Server size={15} /> Prometheus y Grafana
              </h3>
              <p>
                La plataforma publica sus métricas en formato Prometheus. Con ellas puedes guardar el historial completo, crear alertas y
                armar tus propios paneles en Grafana.
              </p>
              <div className="ob-connect-status">
                <span className="ob-dot" style={{ background: data.integrations.prometheus ? '#1a7f37' : '#8c959f' }} />
                {data.integrations.prometheus ? 'Métricas publicadas en ' : 'Métricas desactivadas. Pide al administrador que las habilite para '}
                <code>{data.integrations.metrics_url}</code>
              </div>
              <pre className="ob-code">{scrapeConfig}</pre>
              <div className="ob-connect-actions">
                <button type="button" className="btn btn-secondary" onClick={copyConfig}>
                  <Copy size={15} /> {copied ? 'Copiado' : 'Copiar configuración'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => download('sspillowy-grafana.json', buildGrafanaDashboard())}>
                  <Download size={15} /> Panel para Grafana
                </button>
              </div>
              <small className="ob-muted">El panel se importa en Grafana desde Dashboards → New → Import y se conecta a tu fuente de Prometheus.</small>
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
};
