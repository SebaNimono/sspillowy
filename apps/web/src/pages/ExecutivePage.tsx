import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  Gavel,
  Info,
  Minus,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { ExecCompare, ExecTone, ExecutiveData, Repository, fetchExecutive, fetchRepositories } from '../api/client';
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../utils/findingGroups';
import { formatDateTime } from '../utils/formatDateTime';
import { usePillowPageContext } from '../config/pillowContext';
import { useI18n } from '../i18n/I18nProvider';
import PageSkeleton from '../components/PageSkeleton';
import '../styles/velocity.css';
import '../styles/executive.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const RANGES: { days: number; label: string }[] = [
  { days: 30, label: 'Último mes' },
  { days: 90, label: 'Trimestre' },
  { days: 180, label: 'Semestre' },
  { days: 365, label: 'Año' },
];
const RANGE_KEY = 'sspillowy_executive_range';

const TONE_COLOR: Record<ExecTone, string> = {
  good: '#1a7f37',
  warn: '#9a6700',
  bad: '#cf222e',
  neutral: '#57606a',
  info: '#0969da',
};

const STATUS_TEXT: Record<ExecTone, string> = {
  good: 'Bajo control',
  warn: 'Requiere atención',
  bad: 'En riesgo',
  neutral: 'Sin datos suficientes',
  info: 'Informativo',
};

const fmtDate = (d: Date) => d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

const periodLabel = (data: ExecutiveData) => {
  const end = new Date(data.generated_at);
  const start = new Date(end.getTime() - data.range_days * 864e5);
  return `${fmtDate(start)} – ${fmtDate(end)}`;
};

const fmtDays = (v: number | null) => (v === null ? '—' : v < 1 ? '<1 día' : `${Math.round(v)} ${Math.round(v) === 1 ? 'día' : 'días'}`);
const fmtPct = (v: number | null) => (v === null ? '—' : `${v}%`);

function Trend({ c, lowerIsBetter = false, format }: { c: ExecCompare; lowerIsBetter?: boolean; format: (v: number | null) => string }) {
  if (c.now === null || c.before === null) return <span className="ex-trend is-flat">sin dato anterior</span>;
  const diff = c.now - c.before;
  if (Math.abs(diff) < 0.5) {
    return (
      <span className="ex-trend is-flat">
        <Minus size={12} /> igual que antes ({format(c.before)})
      </span>
    );
  }
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`ex-trend ${good ? 'is-good' : 'is-bad'}`}>
      <Icon size={12} /> antes {format(c.before)}
    </span>
  );
}

export const ExecutivePage: React.FC<PageProps> = ({ onNavigate, ...headerProps }) => {
  const { t } = useI18n();
  const [range, setRange] = useState<number>(() => {
    const saved = Number(localStorage.getItem(RANGE_KEY));
    return RANGES.some((r) => r.days === saved) ? saved : 30;
  });
  const [repoId, setRepoId] = useState('');
  const [repos, setRepos] = useState<Repository[]>([]);
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchExecutive(range, repoId ? [repoId] : undefined));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el resumen');
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

  const changeRange = (days: number) => {
    setRange(days);
    localStorage.setItem(RANGE_KEY, String(days));
  };

  const scopeLabel = useMemo(() => {
    if (!data) return '';
    if (repoId) return repos.find((r) => r.id === repoId)?.name ?? '1 repositorio';
    return `Toda la organización · ${data.scope.repositories} ${data.scope.repositories === 1 ? 'repositorio' : 'repositorios'}`;
  }, [data, repoId, repos]);

  const pillowContext = useMemo(
    () =>
      data
        ? {
            periodo: periodLabel(data),
            alcance: scopeLabel,
            estado: STATUS_TEXT[data.status],
            postura: data.posture,
            mensajes: data.highlights.map((h) => h.text),
            indicadores: data.kpis,
            riesgos_principales: data.top_risks.map((r) => ({
              riesgo: r.title,
              repositorio: r.repository,
              severidad: r.severity,
              cantidad: r.count,
              fuera_de_plazo: r.overdue,
              accion: r.action,
            })),
            decisiones_pendientes: data.decisions.map((d) => d.title),
            logros: data.wins.map((w) => `${w.value} ${w.label}`),
            cumplimiento: data.compliance,
          }
        : null,
    [data, scopeLabel],
  );
  usePillowPageContext('executive', pillowContext);

  const copySummary = async () => {
    if (!data) return;
    const lines = [
      `Resumen ejecutivo de seguridad · ${scopeLabel}`,
      `Periodo: ${periodLabel(data)}`,
      `Estado: ${STATUS_TEXT[data.status]} · Postura ${data.posture.score ?? '—'}/100 (${data.posture.grade.letter}, ${data.posture.grade.label})`,
      '',
      ...data.highlights.map((h) => `• ${h.text}`),
    ];
    if (data.top_risks.length) {
      lines.push('', 'Riesgos principales:');
      data.top_risks.forEach((r, i) => lines.push(`${i + 1}. ${r.title} en ${r.repository}: ${r.action.toLowerCase()}.`));
    }
    if (data.decisions.length) {
      lines.push('', 'Decisiones pendientes:');
      data.decisions.forEach((d) => lines.push(`• ${d.title}`));
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const k = data?.kpis;
  const p = data?.posture;
  const scoreDiff = p && p.score !== null && p.score_start !== null ? p.score - p.score_start : null;
  const c = data?.compliance;

  return (
    <div className="ex-page">
      <Header
        title={t('pages.executive.title')}
        subtitle={t('pages.executive.subtitle')}
        onNavigate={onNavigate}
        {...headerProps}
      />

      <div className="card vl-toolbar ex-noprint">
        <div className="vl-ranges" role="group" aria-label="Periodo">
          {RANGES.map((r) => (
            <button key={r.days} type="button" className={`vl-range ${range === r.days ? 'is-active' : ''}`} onClick={() => changeRange(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
        <select className="vl-select" value={repoId} onChange={(e) => setRepoId(e.target.value)}>
          <option value="">Toda la organización</option>
          {repos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} title="Actualizar">
          <RefreshCw size={14} className={loading ? 'vl-spin' : ''} />
        </button>
        <span className="ex-toolbar-spacer" />
        <button type="button" className="btn btn-secondary" onClick={copySummary} disabled={!data}>
          {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copiado' : 'Copiar resumen'}</span>
        </button>
        <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!data}>
          <Download size={14} />
          <span>Descargar PDF</span>
        </button>
      </div>

      {!data && !error && <PageSkeleton variant="dashboard" />}

      {error && <div className="card vl-empty vl-error">{error}</div>}

      {data && k && p && c && (
        <article className="ex-sheet">
          <header className="ex-head">
            <div>
              <span className="ex-kicker">Resumen ejecutivo de seguridad</span>
              <h2>{scopeLabel}</h2>
              <p>
                {periodLabel(data)} · generado {formatDateTime(data.generated_at)}
              </p>
            </div>
            <span className="ex-status" style={{ ['--c' as string]: TONE_COLOR[data.status] }}>
              {STATUS_TEXT[data.status]}
            </span>
          </header>

          <section className="ex-hero">
            <div className="ex-grade" style={{ ['--c' as string]: TONE_COLOR[p.grade.tone] }}>
              <span className="ex-grade-letter">{p.grade.letter}</span>
              <span className="ex-grade-score">{p.score ?? '—'}/100</span>
              <span className="ex-grade-label">Postura {p.grade.label.toLowerCase()}</span>
              {scoreDiff !== null && (
                <span className={`ex-grade-diff ${scoreDiff > 0 ? 'is-good' : scoreDiff < 0 ? 'is-bad' : ''}`}>
                  {scoreDiff > 0 ? <ArrowUpRight size={13} /> : scoreDiff < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                  {scoreDiff > 0 ? '+' : ''}
                  {scoreDiff} pts desde {p.score_start}
                </span>
              )}
            </div>
            <ul className="ex-highlights">
              {data.highlights.length ? (
                data.highlights.map((h, i) => (
                  <li key={i} style={{ ['--c' as string]: TONE_COLOR[h.tone] }}>
                    {h.text}
                  </li>
                ))
              ) : (
                <li style={{ ['--c' as string]: TONE_COLOR.neutral }}>Aún no hay análisis suficientes para resumir este periodo.</li>
              )}
            </ul>
          </section>

          <section className="ex-kpis">
            <div className="ex-kpi">
              <span>Problemas graves abiertos</span>
              <strong>{k.exposure.now ?? 0}</strong>
              <small>
                {k.exposure.critical} {k.exposure.critical === 1 ? 'crítico' : 'críticos'} · {k.exposure.high}{' '}
                {k.exposure.high === 1 ? 'alto' : 'altos'}
              </small>
              <Trend c={k.exposure} lowerIsBetter format={(v) => String(v ?? '—')} />
            </div>
            <div className="ex-kpi">
              <span>Fuera de plazo</span>
              <strong>{k.overdue.now ?? 0}</strong>
              <small>superaron el tiempo acordado para corregirse</small>
              <Trend c={k.overdue} lowerIsBetter format={(v) => String(v ?? '—')} />
            </div>
            <div className="ex-kpi">
              <span>Tiempo medio de corrección</span>
              <strong>{fmtDays(k.mttr_days.now)}</strong>
              <small>desde que se detecta hasta que se corrige</small>
              <Trend c={k.mttr_days} lowerIsBetter format={fmtDays} />
            </div>
            <div className="ex-kpi">
              <span>Corregido a tiempo</span>
              <strong>{fmtPct(k.sla_met_pct.now)}</strong>
              <small>dentro del plazo según su gravedad</small>
              <Trend c={k.sla_met_pct} format={fmtPct} />
            </div>
            <div className="ex-kpi">
              <span>Entregas aprobadas</span>
              <strong>{fmtPct(k.gate_pass_rate.now)}</strong>
              <small>pasaron el control de seguridad sin excepciones</small>
              <Trend c={k.gate_pass_rate} format={fmtPct} />
            </div>
          </section>

          <div className="ex-cols">
            <section className="ex-block ex-chart">
              <h3>Evolución de la postura</h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="exArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0969da" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#0969da" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eaeef2" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip formatter={(v) => [`${v ?? '—'}/100`, 'Postura']} labelFormatter={(l) => `Al ${l}`} />
                    <Area dataKey="score" stroke="#0969da" strokeWidth={2} fill="url(#exArea)" type="monotone" isAnimationActive={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="ex-block">
              <h3>
                <Trophy size={15} color="#bf8700" /> Logros del periodo
              </h3>
              <ul className="ex-wins">
                {data.wins.map((w) => (
                  <li key={w.label}>
                    <strong>{w.value}</strong>
                    <div>
                      <span>{w.label}</span>
                      {w.detail && <small>{w.detail}</small>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="ex-block">
            <h3>
              <AlertTriangle size={15} color="#cf222e" /> Riesgos principales
            </h3>
            {data.top_risks.length ? (
              <ol className="ex-risks">
                {data.top_risks.map((r, i) => (
                  <li key={`${r.repository}-${r.category}`}>
                    <span className="ex-risk-n">{i + 1}</span>
                    <div className="ex-risk-body">
                      <div className="ex-risk-title">
                        <span className="ex-sev" style={{ ['--c' as string]: SEVERITY_COLOR[r.severity] }}>
                          {SEVERITY_LABEL[r.severity]}
                        </span>
                        <strong>{r.title}</strong>
                        <span className="ex-risk-repo">en {r.repository}</span>
                      </div>
                      <p>{r.impact}</p>
                      <small>
                        {r.count} {r.count === 1 ? 'problema' : 'problemas'}
                        {r.overdue ? ` · ${r.overdue} fuera de plazo` : ''} · el más antiguo hace {r.oldest_days}{' '}
                        {r.oldest_days === 1 ? 'día' : 'días'}
                      </small>
                    </div>
                    <button type="button" className="ex-action" onClick={() => onNavigate?.(r.tab)}>
                      {r.action}
                      <ArrowRight size={13} className="ex-noprint" />
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ex-none">No hay riesgos abiertos en este alcance.</p>
            )}
          </section>

          <section className="ex-block">
            <h3>
              <Gavel size={15} color="#8250df" /> Decisiones pendientes
            </h3>
            {data.decisions.length ? (
              <ul className="ex-decisions">
                {data.decisions.map((d) => (
                  <li key={d.kind} style={{ ['--c' as string]: TONE_COLOR[d.tone] }}>
                    <div>
                      <strong>{d.title}</strong>
                      <p>{d.detail}</p>
                    </div>
                    <button type="button" className="ex-link ex-noprint" onClick={() => onNavigate?.(d.tab)}>
                      Revisar <ArrowRight size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ex-none">Nada pendiente: no hay excepciones por aprobar ni problemas críticos fuera de plazo.</p>
            )}
          </section>

          <div className="ex-cols">
            <section className="ex-block">
              <h3>Repositorios</h3>
              {data.repositories.length ? (
                <table className="ex-table">
                  <thead>
                    <tr>
                      <th>Repositorio</th>
                      <th>Postura</th>
                      <th>Críticos</th>
                      <th>Altos</th>
                      <th>Fuera de plazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.repositories.map((r) => {
                      const diff = r.score_start === null ? null : r.score - r.score_start;
                      return (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.name}</strong>
                            <small>{r.last_scan_at ? `analizado ${formatDateTime(r.last_scan_at)}` : 'sin análisis'}</small>
                          </td>
                          <td>
                            <span className="ex-chip" style={{ ['--c' as string]: TONE_COLOR[r.grade.tone] }}>
                              {r.grade.letter}
                            </span>{' '}
                            {r.score}
                            {diff !== null && diff !== 0 && (
                              <em className={diff > 0 ? 'is-good' : 'is-bad'}>
                                {diff > 0 ? '+' : ''}
                                {diff}
                              </em>
                            )}
                          </td>
                          <td className={r.critical ? 'is-bad' : ''}>{r.critical}</td>
                          <td>{r.high}</td>
                          <td className={r.overdue ? 'is-bad' : ''}>{r.overdue}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="ex-none">No hay repositorios activos.</p>
              )}
            </section>

            <section className="ex-block">
              <h3>
                <ClipboardCheck size={15} color="#0969da" /> Cumplimiento normativo
              </h3>
              {c.frameworks.length ? (
                <>
                  <div className="ex-frameworks">
                    {c.frameworks.map((f) => {
                      const tone = f.score >= 80 ? '#1a7f37' : f.score >= 50 ? '#bf8700' : '#cf222e';
                      return (
                        <div key={f.id} className="ex-framework" title={f.name}>
                          <div>
                            <strong>{f.short}</strong>
                            <span style={{ color: tone }}>{f.score}%</span>
                          </div>
                          <div className="ex-framework-bar" aria-hidden>
                            <i style={{ width: `${f.score}%`, background: tone }} />
                          </div>
                          <small>
                            {f.compliant} de {f.total} requisitos cumplen
                          </small>
                        </div>
                      );
                    })}
                  </div>
                  {c.gaps.length > 0 && (
                    <>
                      <p className="ex-gaps-title">Lo que más frena el cumplimiento</p>
                      <ul className="ex-gaps">
                        {c.gaps.map((g) => (
                          <li key={g.id}>
                            <strong>{g.name}</strong>
                            <small>
                              {g.status === 'PENDING' ? 'Falta evidencia' : g.reason} · afecta a {g.frameworks.join(', ')}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <button type="button" className="ex-link ex-noprint" onClick={() => onNavigate?.('reports')}>
                    Ver el detalle y la evidencia en Compliance continuo <ArrowRight size={13} />
                  </button>
                </>
              ) : (
                <p className="ex-none">No hay marcos normativos activos.</p>
              )}
            </section>
          </div>

          <footer className="ex-foot">
            <Info size={13} />
            <span>
              Generado por SSPILLOWY a partir de los análisis automáticos de código, dependencias, secretos y aplicación publicada. La
              postura va de 0 a 100 y baja con cada problema abierto según su gravedad.
            </span>
          </footer>
        </article>
      )}
    </div>
  );
};
