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
import { ArrowDownRight, ArrowRight, ArrowUpRight, Gauge, Info, RefreshCw, Timer, TrendingUp } from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Repository, VelocityData, fetchRepositories, fetchVelocity } from '../api/client';
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../utils/findingGroups';
import { formatDateTime } from '../utils/formatDateTime';
import { usePillowPageContext } from '../config/pillowContext';
import { useI18n } from '../i18n/I18nProvider';
import PageSkeleton from '../components/PageSkeleton';
import '../styles/velocity.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const RANGES = [7, 30, 90, 180] as const;
const RANGE_KEY = 'sspillowy_velocity_range';

const ENGINE_LABEL: Record<string, string> = {
  semgrep: 'Semgrep (código)',
  trivy: 'Trivy (dependencias)',
  gitleaks: 'Gitleaks (secretos)',
  owasp_zap: 'OWASP ZAP (app web)',
};

const days = (v: number | null | undefined) => {
  if (v === null || v === undefined) return '—';
  if (v < 1) return '<1 d';
  const r = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
  return `${r} d`;
};
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

function Delta({ cur, prev, lowerIsBetter = false, unit = '' }: { cur: number | null; prev: number | null; lowerIsBetter?: boolean; unit?: string }) {
  if (cur === null || prev === null) return <span className="vl-delta is-flat">sin periodo anterior para comparar</span>;
  const diff = Math.round((cur - prev) * 10) / 10;
  if (diff === 0) return <span className="vl-delta is-flat">igual que el periodo anterior</span>;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`vl-delta ${good ? 'is-good' : 'is-bad'}`}>
      <Icon size={13} />
      {diff > 0 ? '+' : ''}
      {diff}
      {unit} vs periodo anterior
    </span>
  );
}

const ChartTooltip: React.FC<{ active?: boolean; label?: string; payload?: { name: string; value: number; color: string }[] }> = ({
  active,
  label,
  payload,
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="vl-tooltip">
      <strong>Semana del {label}</strong>
      {payload.map((p) => (
        <span key={p.name}>
          <i style={{ background: p.color }} />
          {p.name}: <b>{p.value}</b>
        </span>
      ))}
    </div>
  );
};

export const VelocityPage: React.FC<PageProps> = ({ onNavigate, ...headerProps }) => {
  const { t } = useI18n();
  const [range, setRange] = useState<number>(() => {
    const saved = Number(localStorage.getItem(RANGE_KEY));
    return (RANGES as readonly number[]).includes(saved) ? saved : 30;
  });
  const [repoId, setRepoId] = useState('');
  const [repos, setRepos] = useState<Repository[]>([]);
  const [data, setData] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchVelocity(range, repoId ? [repoId] : undefined));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron calcular las métricas');
    } finally {
      setLoading(false);
    }
  }, [range, repoId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchRepositories()
      .then((list) => setRepos([...list].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setRepos([]));
  }, []);

  const changeRange = (r: number) => {
    setRange(r);
    localStorage.setItem(RANGE_KEY, String(r));
  };

  const pillowContext = useMemo(
    () =>
      data
        ? {
            periodo_dias: data.range_days,
            kpis: data.kpis,
            periodo_anterior: data.previous,
            por_severidad: data.by_severity,
            repositorios: data.repositories.slice(0, 15).map((r) => ({
              nombre: r.name,
              abiertos: r.open,
              vencidos: r.overdue,
              nuevos: r.introduced,
              corregidos: r.fixed,
              mttr_dias: r.mttr_days,
            })),
            mas_antiguos: data.oldest_open,
          }
        : null,
    [data],
  );
  usePillowPageContext('velocity', pillowContext);

  const k = data?.kpis;
  const net = k ? k.fixed - k.introduced : 0;
  const maxSeverityScale = useMemo(
    () => Math.max(1, ...(data?.by_severity ?? []).filter((s) => s.mttr_days !== null || s.open).map((s) => Math.max(s.sla_days, s.mttr_days ?? 0))),
    [data],
  );
  const severityRows = (data?.by_severity ?? []).filter((s) => s.severity !== 'INFO' || s.fixed || s.open);

  return (
    <div>
      <Header
        title={t('pages.velocity.title')}
        subtitle={t('pages.velocity.subtitle')}
        onNavigate={onNavigate}
        {...headerProps}
      />

      <div className="card vl-toolbar">
        <div className="vl-ranges" role="group" aria-label="Periodo">
          {RANGES.map((r) => (
            <button key={r} type="button" className={`vl-range ${range === r ? 'is-active' : ''}`} onClick={() => changeRange(r)}>
              {r} días
            </button>
          ))}
        </div>
        <select className="vl-select" value={repoId} onChange={(e) => setRepoId(e.target.value)}>
          <option value="">Todos los repositorios</option>
          {repos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} title="Actualizar">
          <RefreshCw size={14} className={loading ? 'vl-spin' : ''} />
        </button>
        {data && <span className="vl-updated">Calculado {formatDateTime(data.generated_at)}</span>}
      </div>

      {!data && !error && <PageSkeleton variant="dashboard" />}

      {error && <div className="card vl-empty vl-error">{error}</div>}

      {data && k && (
        <>
          {!data.has_history && (
            <div className="vl-callout">
              <Info size={16} />
              <div>
                <strong>Aún no hay historial suficiente.</strong> Un hallazgo cuenta como corregido cuando un análisis posterior del
                mismo repositorio ya no lo encuentra. Vuelve a escanear tus repositorios después de corregir para empezar a medir.
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => onNavigate?.('scans')}>
                <span>Ir a Escaneos</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          <h3 className="vl-group-title">Corrección</h3>
          <div className="vl-kpis">
            <div className="vl-kpi" style={{ ['--c' as string]: '#8250df' }}>
              <span className="vl-kpi-label">Tiempo medio de corrección</span>
              <span className="vl-kpi-value">{days(k.mttr_days)}</span>
              <span className="vl-kpi-hint">mediana {days(k.median_days)} · MTTR</span>
              <Delta cur={k.mttr_days} prev={data.previous.mttr_days} lowerIsBetter unit=" d" />
            </div>
            <div className="vl-kpi" style={{ ['--c' as string]: '#1a7f37' }}>
              <span className="vl-kpi-label">Corregidos</span>
              <span className="vl-kpi-value">{k.fixed}</span>
              <span className="vl-kpi-hint">desaparecieron en un análisis posterior</span>
              <Delta cur={k.fixed} prev={data.previous.fixed} />
            </div>
            <div className="vl-kpi" style={{ ['--c' as string]: '#cf222e' }}>
              <span className="vl-kpi-label">Nuevos</span>
              <span className="vl-kpi-value">{k.introduced}</span>
              <span className="vl-kpi-hint">
                {k.regressions ? `${k.regressions} reaparecieron tras corregirse` : 'ninguno reapareció tras corregirse'}
              </span>
              <Delta cur={k.introduced} prev={data.previous.introduced} lowerIsBetter />
            </div>
            <div className="vl-kpi" style={{ ['--c' as string]: net >= 0 ? '#1a7f37' : '#bc4c00' }}>
              <span className="vl-kpi-label">Flujo neto</span>
              <span className="vl-kpi-value">
                {net > 0 ? '+' : ''}
                {net}
              </span>
              <span className="vl-kpi-hint">
                {net > 0 ? 'se corrige más de lo que entra' : net < 0 ? 'entra más de lo que se corrige' : 'entra lo mismo que se corrige'}
              </span>
            </div>
            <div className="vl-kpi" style={{ ['--c' as string]: '#bf8700' }}>
              <span className="vl-kpi-label">Corregidos en plazo</span>
              <span className="vl-kpi-value">{pct(k.sla_met_pct)}</span>
              <span className="vl-kpi-hint">dentro del SLA de su severidad</span>
              <Delta cur={k.sla_met_pct} prev={data.previous.sla_met_pct} unit=" pts" />
            </div>
            <div className="vl-kpi" style={{ ['--c' as string]: '#0969da' }}>
              <span className="vl-kpi-label">Abiertos hoy</span>
              <span className="vl-kpi-value">{k.open}</span>
              <span className="vl-kpi-hint">
                {k.overdue} vencidos · edad mediana {days(k.median_open_age_days)}
              </span>
            </div>
          </div>

          <h3 className="vl-group-title">Entrega</h3>
          <div className="vl-kpis">
            <div className="vl-kpi" style={{ ['--c' as string]: '#0969da' }}>
              <span className="vl-kpi-label">Análisis por semana</span>
              <span className="vl-kpi-value">{k.scans_per_week}</span>
              <span className="vl-kpi-hint">{k.scans} análisis en el periodo</span>
              <Delta cur={k.scans} prev={data.previous.scans} />
            </div>
            <div className="vl-kpi" style={{ ['--c' as string]: '#1a7f37' }}>
              <span className="vl-kpi-label">Aprobados por el gate</span>
              <span className="vl-kpi-value">{pct(k.gate.pass_rate)}</span>
              <span className="vl-kpi-hint">
                {k.gate.passed} aprobados · {k.gate.blocked} bloqueados · {k.gate.bypassed} con excepción
              </span>
              <Delta cur={k.gate.pass_rate} prev={data.previous.gate_pass_rate} unit=" pts" />
            </div>
            <div className="vl-kpi" style={{ ['--c' as string]: '#6e7781' }}>
              <span className="vl-kpi-label">Duración del análisis</span>
              <span className="vl-kpi-value">{k.scan_minutes === null ? '—' : `${k.scan_minutes} min`}</span>
              <span className="vl-kpi-hint">mediana, de inicio a resultado</span>
            </div>
            <div className="vl-kpi" style={{ ['--c' as string]: '#bc4c00' }}>
              <span className="vl-kpi-label">Excepciones al gate</span>
              <span className="vl-kpi-value">{k.bypass_approved}</span>
              <span className="vl-kpi-hint">aprobadas de {k.bypass_requests} solicitadas</span>
            </div>
          </div>

          <div className="vl-grid">
            <section className="card vl-panel vl-span-8">
              <header>
                <h3>
                  <TrendingUp size={16} color="#8250df" /> Nuevos vs corregidos por semana
                </h3>
                <span className="vl-chip">pendientes al cierre de cada semana</span>
              </header>
              {data.series.some((s) => s.introduced || s.fixed || s.backlog) ? (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eaeef2" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(9,105,218,0.05)' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="introduced" name="Nuevos" fill="#cf222e" radius={[4, 4, 0, 0]} barSize={14} />
                      <Bar dataKey="fixed" name="Corregidos" fill="#1a7f37" radius={[4, 4, 0, 0]} barSize={14} />
                      <Line dataKey="backlog" name="Pendientes" stroke="#0969da" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="vl-none">Sin actividad en este periodo.</p>
              )}
            </section>

            <section className="card vl-panel vl-span-4">
              <header>
                <h3>
                  <Timer size={16} color="#bf8700" /> Tiempo de corrección vs plazo
                </h3>
              </header>
              <ul className="vl-sla">
                {severityRows.map((s) => {
                  const over = s.mttr_days !== null && s.mttr_days > s.sla_days;
                  return (
                    <li key={s.severity}>
                      <div className="vl-sla-head">
                        <span className="vl-sev" style={{ ['--c' as string]: SEVERITY_COLOR[s.severity] }}>
                          {SEVERITY_LABEL[s.severity]}
                        </span>
                        <span className={over ? 'is-over' : ''}>
                          {s.mttr_days === null ? 'sin correcciones' : days(s.mttr_days)} <em>/ plazo {s.sla_days} d</em>
                        </span>
                      </div>
                      <div className="vl-sla-track">
                        {s.mttr_days !== null && (
                          <i
                            className={over ? 'is-over' : ''}
                            style={{ width: `${Math.min(100, (s.mttr_days / maxSeverityScale) * 100)}%` }}
                          />
                        )}
                        <b style={{ left: `${Math.min(100, (s.sla_days / maxSeverityScale) * 100)}%` }} title={`Plazo: ${s.sla_days} días`} />
                      </div>
                      <small>
                        {s.fixed} corregidos{s.sla_met_pct !== null ? ` · ${s.sla_met_pct}% en plazo` : ''} · {s.open} abiertos
                        {s.overdue ? ` · ${s.overdue} vencidos` : ''}
                      </small>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="card vl-panel vl-span-12 vl-table-card">
              <header>
                <h3>
                  <Gauge size={16} color="#0969da" /> Por repositorio
                </h3>
                <span className="vl-chip">últimos {data.range_days} días</span>
              </header>
              {data.repositories.length ? (
                <div className="vl-table-wrap">
                  <table className="vl-table">
                    <thead>
                      <tr>
                        <th>Repositorio</th>
                        <th>Abiertos</th>
                        <th>Nuevos</th>
                        <th>Corregidos</th>
                        <th>Flujo neto</th>
                        <th>Tiempo medio</th>
                        <th>En plazo</th>
                        <th>Análisis</th>
                        <th>Gate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.repositories]
                        .sort((a, b) => b.overdue - a.overdue || b.open - a.open)
                        .map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{r.name}</strong>
                              <small>{r.last_scan_at ? `último análisis ${formatDateTime(r.last_scan_at)}` : 'sin análisis'}</small>
                            </td>
                            <td>
                              {r.open}
                              {r.overdue > 0 && <span className="vl-overdue">{r.overdue} vencidos</span>}
                            </td>
                            <td>{r.introduced}</td>
                            <td>{r.fixed}</td>
                            <td className={r.net > 0 ? 'is-good' : r.net < 0 ? 'is-bad' : ''}>
                              {r.net > 0 ? '+' : ''}
                              {r.net}
                            </td>
                            <td>{days(r.mttr_days)}</td>
                            <td>{pct(r.sla_met_pct)}</td>
                            <td>{r.scans}</td>
                            <td>{pct(r.gate_pass_rate)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="vl-none">No hay repositorios registrados.</p>
              )}
            </section>

            <section className="card vl-panel vl-span-7">
              <header>
                <h3>Críticos y altos que más tiempo llevan abiertos</h3>
                <button type="button" className="vl-link" onClick={() => onNavigate?.('fixIntel')}>
                  Ver en Fix Intelligence <ArrowRight size={13} />
                </button>
              </header>
              {data.oldest_open.length ? (
                <ul className="vl-oldest">
                  {data.oldest_open.map((o, i) => {
                    const late = o.age_days > o.sla_days;
                    return (
                      <li key={`${o.title}-${i}`}>
                        <span className="vl-sev" style={{ ['--c' as string]: SEVERITY_COLOR[o.severity] }}>
                          {SEVERITY_LABEL[o.severity]}
                        </span>
                        <div>
                          <strong>{o.title}</strong>
                          <small>
                            {o.repository} · {ENGINE_LABEL[o.engine] ?? o.engine}
                          </small>
                        </div>
                        <span className={`vl-age ${late ? 'is-late' : ''}`}>
                          {days(o.age_days)}
                          <em>{late ? `vencido hace ${Math.round(o.age_days - o.sla_days)} d` : `plazo ${o.sla_days} d`}</em>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="vl-none">No hay hallazgos críticos ni altos abiertos.</p>
              )}
            </section>

            <section className="card vl-panel vl-span-5">
              <header>
                <h3>Por motor</h3>
              </header>
              {data.by_engine.length ? (
                <ul className="vl-engines">
                  {data.by_engine.map((e) => (
                    <li key={e.engine}>
                      <strong>{ENGINE_LABEL[e.engine] ?? e.engine}</strong>
                      <span>
                        <b>{e.introduced}</b> nuevos
                      </span>
                      <span>
                        <b>{e.fixed}</b> corregidos
                      </span>
                      <span>
                        <b>{days(e.mttr_days)}</b> medio
                      </span>
                      <span>
                        <b>{e.open}</b> abiertos
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="vl-none">Sin hallazgos registrados.</p>
              )}
              {k.decided > 0 && (
                <p className="vl-foot">
                  {k.decided} hallazgos marcados como falso positivo o riesgo aceptado no cuentan en estas métricas.
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};
