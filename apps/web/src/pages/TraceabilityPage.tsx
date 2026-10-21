import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileJson,
  Flag,
  GitCommitHorizontal,
  History,
  KeyRound,
  Repeat,
  RotateCcw,
  ScrollText,
  Search,
  ShieldOff,
  Sparkles,
  UserRound,
  Workflow,
  X,
} from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import PageSkeleton from '../components/PageSkeleton';
import {
  AuditTrail,
  AuditTrailFilters,
  TRACE_REF_KEY,
  TraceCommit,
  TraceDetail,
  TraceEvent,
  TraceIssueFilters,
  TraceIssueList,
  fetchAuditTrail,
  fetchTraceDetail,
  fetchTraceEvidence,
  fetchTraceIssues,
} from '../api/client';
import { usePillowPageContext } from '../config/pillowContext';
import { SEVERITY_COLOR, SEVERITY_LABEL, Severity } from '../utils/findingGroups';
import { formatDateTime } from '../utils/formatDateTime';
import { timeAgo } from '../utils/timeAgo';
import { useI18n } from '../i18n/I18nProvider';
import '../styles/velocity.css';
import '../styles/traceability.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

type View = 'findings' | 'events';

const PAGE_SIZE = 50;
const EVENTS_PAGE = 100;
const EXPORT_LIMIT = 2000;

const STATUS_TABS: { id: NonNullable<TraceIssueFilters['status']>; label: string; count: keyof TraceIssueList['counts'] }[] = [
  { id: 'all', label: 'Todos', count: 'all' },
  { id: 'open', label: 'Abiertos', count: 'open' },
  { id: 'fixed', label: 'Corregidos', count: 'fixed' },
  { id: 'decided', label: 'Decididos', count: 'decided' },
];

const STATUS_TONE: Record<string, string> = {
  OPEN: 'is-bad',
  IN_REVIEW: 'is-warn',
  FIXED: 'is-good',
  FALSE_POSITIVE: 'is-muted',
  ACCEPTED_RISK: 'is-warn',
};

const EVENT_ICON: Record<TraceEvent['type'], typeof History> = {
  DETECTED: AlertTriangle,
  REAPPEARED: RotateCcw,
  SEEN: Eye,
  SEVERITY_CHANGED: Flag,
  FIXED: CheckCircle2,
  STATUS: UserRound,
  PILLOW: Sparkles,
  PILLOW_DECISION: Sparkles,
  BYPASS_REQUESTED: ShieldOff,
  BYPASS_DECIDED: ShieldOff,
  SECRET: KeyRound,
  RUNBOOK: Workflow,
  SLA: Clock,
};

const ENGINES = [
  { id: 'semgrep', label: 'Semgrep' },
  { id: 'gitleaks', label: 'Gitleaks' },
  { id: 'trivy', label: 'Trivy' },
  { id: 'owasp_zap', label: 'OWASP ZAP' },
];
const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const sevColor = (s: string) => SEVERITY_COLOR[s as Severity] ?? '#6e7781';
const sevLabel = (s: string) => SEVERITY_LABEL[s as Severity] ?? s;

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDays(v: number | null | undefined) {
  if (v === null || v === undefined) return '—';
  if (v < 1) return 'menos de 1 día';
  return `${Math.round(v)} ${Math.round(v) === 1 ? 'día' : 'días'}`;
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function csv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\n');
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'hallazgo';

const CommitLink: React.FC<{ commit: TraceCommit | null | undefined; withMessage?: boolean }> = ({ commit, withMessage }) => {
  if (!commit) return <span className="tr-muted">sin commit registrado</span>;
  const label = (
    <>
      <GitCommitHorizontal size={13} />
      <code>{commit.short}</code>
      {withMessage && commit.message ? <span className="tr-commit-msg">{commit.message}</span> : null}
    </>
  );
  return commit.url ? (
    <a className="tr-commit" href={commit.url} target="_blank" rel="noreferrer noopener" title={commit.author ? `Autor: ${commit.author}` : undefined}>
      {label}
    </a>
  ) : (
    <span className="tr-commit" title={commit.author ? `Autor: ${commit.author}` : undefined}>{label}</span>
  );
};

type TimelineItem = { kind: 'event'; event: TraceEvent } | { kind: 'seen'; events: TraceEvent[] };

function groupTimeline(events: TraceEvent[]): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (e.type === 'SEEN') {
      if (last && last.kind === 'seen') last.events.push(e);
      else out.push({ kind: 'seen', events: [e] });
    } else {
      out.push({ kind: 'event', event: e });
    }
  }
  return out;
}

const EventBody: React.FC<{ e: TraceEvent }> = ({ e }) => (
  <>
    <div className="tr-ev-head">
      <strong>{e.title}</strong>
      <time title={formatDateTime(e.at)}>{formatDateTime(e.at)}</time>
    </div>
    {e.actor_label && (
      <div className={`tr-ev-actor ${e.person ? 'is-person' : ''}`}>
        <UserRound size={12} /> {e.actor_label}
      </div>
    )}
    {e.detail && <p className="tr-ev-detail">{e.detail}</p>}
    {e.scan && (
      <div className="tr-ev-meta">
        <CommitLink commit={e.scan.commit} withMessage />
        {e.scan.branch && <span className="tr-chip">rama {e.scan.branch}</span>}
        {e.scan.gate === 'BLOCKED' && <span className="tr-chip is-bad">el gate bloqueó este análisis</span>}
        {e.scan.gate === 'PASSED' && <span className="tr-chip is-good">gate aprobado</span>}
      </div>
    )}
  </>
);

const SeenGroup: React.FC<{ events: TraceEvent[] }> = ({ events }) => {
  const [open, setOpen] = useState(false);
  if (events.length === 1) return <EventBody e={events[0]} />;
  const first = events[0];
  const last = events[events.length - 1];
  return (
    <>
      <div className="tr-ev-head">
        <strong>Siguió presente en {events.length} análisis</strong>
        <time>
          {formatDate(first.at)} – {formatDate(last.at)}
        </time>
      </div>
      <button type="button" className="tr-link" onClick={() => setOpen((v) => !v)}>
        {open ? 'Ocultar detalle' : 'Ver cada análisis'}
      </button>
      {open && (
        <ul className="tr-seen-list">
          {events.map((e, i) => (
            <li key={i}>
              <time>{formatDateTime(e.at)}</time>
              <CommitLink commit={e.scan?.commit} />
              <span className="tr-muted">{e.actor_label}</span>
              {e.scan?.gate === 'BLOCKED' && <span className="tr-chip is-bad">gate bloqueó</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

function detailContext(data: TraceDetail) {
  const s = data.summary;
  return {
    hallazgo: `${s.title} (${sevLabel(s.severity)}) en ${s.repository_name} · ${s.file_path ?? 'sin archivo'}`,
    estado: s.status_label,
    detectado: formatDateTime(s.first_seen),
    commit_de_origen: s.introduced_in ? `${s.introduced_in.short} ${s.introduced_in.message ?? ''}`.trim() : 'sin commit registrado',
    corregido: s.closed_at ? `${formatDateTime(s.closed_at)}${s.fixed_in ? ` en commit ${s.fixed_in.short}` : ''}` : 'no',
    tiempo_de_correccion: s.time_to_fix_days !== null ? fmtDays(s.time_to_fix_days) : null,
    plazo: s.sla.overdue ? 'vencido' : s.sla.met === true ? 'cumplido' : s.sla.met === false ? 'incumplido' : `vence ${formatDate(s.sla.due_at)}`,
    personas: s.people,
    linea_de_tiempo: data.timeline
      .slice(-25)
      .map((e) => `${formatDateTime(e.at)} · ${e.title}${e.actor_label ? ` · ${e.actor_label}` : ''}${e.detail ? ` · ${e.detail.slice(0, 140)}` : ''}`),
  };
}

const IssueDetail: React.FC<{ refId: string; onClose: () => void; onLoaded: (d: TraceDetail | null) => void }> = ({
  refId,
  onClose,
  onLoaded,
}) => {
  const [data, setData] = useState<TraceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchTraceDetail(refId)
      .then((d) => {
        if (!alive) return;
        setData(d);
        onLoaded(d);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'No se pudo cargar la historia'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      onLoaded(null);
    };
  }, [refId, onLoaded]);

  const exportJson = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const evidence = await fetchTraceEvidence(data.summary.key);
      download(`historia-${slug(data.summary.title)}.json`, JSON.stringify(evidence, null, 2), 'application/json');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar');
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const s = data.summary;
    const rows: (string | number | null)[][] = [
      ['Fecha', 'Evento', 'Responsable', 'Detalle', 'Commit', 'Rama', 'Gate'],
      ...data.timeline.map((e) => [
        e.at,
        e.title,
        e.actor_label,
        e.detail,
        e.scan?.commit?.sha ?? '',
        e.scan?.branch ?? '',
        e.scan?.gate ?? '',
      ]),
    ];
    download(`historia-${slug(s.title)}.csv`, csv(rows), 'text/csv;charset=utf-8');
  };

  if (loading && !data) return <PageSkeleton variant="panel" rows={5} />;
  if (error && !data) return <div className="card tr-detail tr-error">{error}</div>;
  if (!data) return null;

  const s = data.summary;
  const items = groupTimeline(data.timeline);
  const slaText = s.sla.overdue
    ? `Vencido el ${formatDate(s.sla.due_at)}`
    : s.sla.met === true
      ? 'Corregido dentro del plazo'
      : s.sla.met === false
        ? 'Corregido fuera de plazo'
        : s.status === 'FALSE_POSITIVE' || s.status === 'ACCEPTED_RISK'
          ? 'No aplica (decidido)'
          : `Vence el ${formatDate(s.sla.due_at)}`;

  return (
    <div className="card tr-detail">
      <div className="tr-detail-head">
        <div>
          <div className="tr-badges">
            <span className="vl-sev" style={{ ['--c' as string]: sevColor(s.severity) }}>{sevLabel(s.severity)}</span>
            <span className={`tr-status ${STATUS_TONE[s.status] ?? ''}`}>{s.status_label}</span>
            <span className="tr-chip">{s.engine_label}</span>
            {s.regressions > 0 && (
              <span className="tr-chip is-bad">
                <Repeat size={11} /> reapareció {s.regressions} {s.regressions === 1 ? 'vez' : 'veces'}
              </span>
            )}
          </div>
          <h2>{s.title}</h2>
          <div className="tr-detail-path">
            {s.repository_name}
            {s.file_path ? ' · ' : ''}
            {s.file_path && (s.file_url ? (
              <a href={s.file_url} target="_blank" rel="noreferrer noopener">
                {s.file_path}
                {s.line ? `:${s.line}` : ''} <ExternalLink size={11} />
              </a>
            ) : (
              <span>{s.file_path}{s.line ? `:${s.line}` : ''}</span>
            ))}
            {s.cwe ? <span className="tr-muted"> · {s.cwe}</span> : null}
          </div>
        </div>
        <div className="tr-detail-actions">
          <button type="button" className="btn btn-secondary" onClick={exportCsv} title="Línea de tiempo en CSV">
            <Download size={14} /> CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={exportJson} disabled={exporting} title="Evidencia completa para auditoría">
            <FileJson size={14} /> {exporting ? 'Exportando…' : 'Exportar evidencia'}
          </button>
          <button type="button" className="btn btn-secondary tr-close" onClick={onClose} aria-label="Cerrar">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="tr-facts">
        <div>
          <span>Apareció</span>
          <strong>{formatDate(s.first_seen)}</strong>
          <CommitLink commit={s.introduced_in} />
        </div>
        <div>
          <span>{s.status === 'FIXED' ? 'Corregido' : 'Estado'}</span>
          <strong>{s.status === 'FIXED' ? formatDate(s.closed_at) : s.open_days !== null ? `Abierto hace ${fmtDays(s.open_days)}` : s.status_label}</strong>
          {s.status === 'FIXED' && <CommitLink commit={s.fixed_in} />}
        </div>
        <div>
          <span>Tiempo de corrección</span>
          <strong>{s.time_to_fix_days !== null ? fmtDays(s.time_to_fix_days) : '—'}</strong>
          <em>plazo de {s.sla.days} días</em>
        </div>
        <div className={s.sla.overdue || s.sla.met === false ? 'is-bad' : s.sla.met ? 'is-good' : ''}>
          <span>Plazo</span>
          <strong>{slaText}</strong>
          <em>
            {s.detections === 1 ? 'Lo detectó 1 análisis' : `Lo detectaron ${s.detections} análisis`}
          </em>
        </div>
      </div>

      {s.people.length > 0 && (
        <div className="tr-people">
          <span>Personas involucradas</span>
          {s.people.map((p) => (
            <span key={p} className="tr-person">
              <UserRound size={12} /> {p}
            </span>
          ))}
        </div>
      )}

      {s.description && (
        <details className="tr-desc">
          <summary>Descripción del hallazgo</summary>
          <p>{s.description}</p>
        </details>
      )}

      {error && <div className="tr-error">{error}</div>}

      <ol className="tr-timeline">
        {items.map((it, i) => {
          const e = it.kind === 'event' ? it.event : it.events[0];
          const Icon = it.kind === 'seen' ? Eye : EVENT_ICON[e.type] ?? History;
          const tone = it.kind === 'seen' ? 'neutral' : e.tone;
          return (
            <li key={i} className={`tr-ev is-${tone}`}>
              <span className="tr-ev-dot">
                <Icon size={13} />
              </span>
              <div className="tr-ev-body">{it.kind === 'seen' ? <SeenGroup events={it.events} /> : <EventBody e={e} />}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const FindingsView: React.FC<{ initialRef: string | null }> = ({ initialRef }) => {
  const [filters, setFilters] = useState<TraceIssueFilters>({ status: 'all' });
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState('');
  const [data, setData] = useState<TraceIssueList | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(initialRef);
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const onDetailLoaded = useCallback((d: TraceDetail | null) => setDetail(d), []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((f) => ({ ...f, q: query.trim() || undefined, person: person.trim() || undefined }));
      setLimit(PAGE_SIZE);
    }, 350);
    return () => window.clearTimeout(id);
  }, [query, person]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTraceIssues({ ...filters, limit })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'No se pudo cargar la trazabilidad'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [filters, limit]);

  const update = (patch: Partial<TraceIssueFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setLimit(PAGE_SIZE);
  };

  const hasFilters = Boolean(query || person || filters.repository_id || filters.severity || filters.engine || filters.from || filters.to);
  const clear = () => {
    setQuery('');
    setPerson('');
    setFilters({ status: filters.status });
    setLimit(PAGE_SIZE);
  };

  const pillowContext = useMemo(() => {
    if (!data) return null;
    return {
      vista: 'Historia de hallazgos',
      filtros: { ...filters, status: STATUS_TABS.find((t) => t.id === filters.status)?.label },
      totales: data.counts,
      hallazgos_listados: data.items.slice(0, 20).map(
        (i) => `${i.title} · ${i.repository_name} · ${i.status_label} · detectado ${formatDate(i.first_seen)}${i.closed_at ? ` · corregido ${formatDate(i.closed_at)}` : ''}`,
      ),
      hallazgo_abierto: detail ? detailContext(detail) : null,
    };
  }, [data, filters, detail]);
  usePillowPageContext('traceability', pillowContext);

  const exportList = async () => {
    try {
      const all = await fetchTraceIssues({ ...filters, limit: 500 });
      const rows: (string | number | null)[][] = [
        ['Hallazgo', 'Severidad', 'Motor', 'Repositorio', 'Archivo', 'Estado', 'Detectado', 'Corregido', 'Análisis', 'Reapariciones', 'Plazo (días)', 'Vence', 'Plazo cumplido'],
        ...all.items.map((i) => [
          i.title,
          sevLabel(i.severity),
          i.engine_label,
          i.repository_name,
          i.file_path,
          i.status_label,
          i.first_seen,
          i.closed_at,
          i.detections,
          i.regressions,
          i.sla.days,
          i.sla.due_at,
          i.sla.met === null ? (i.sla.overdue ? 'vencido' : '') : i.sla.met ? 'sí' : 'no',
        ]),
      ];
      download(`trazabilidad-hallazgos-${new Date().toISOString().slice(0, 10)}.csv`, csv(rows), 'text/csv;charset=utf-8');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar');
    }
  };

  return (
    <>
      <div className="card tr-filters">
        <label className="tr-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por regla, archivo, CWE o repositorio" />
        </label>
        <label className="tr-search tr-search-person">
          <UserRound size={15} />
          <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Persona (correo o usuario)" />
        </label>
        <select className="vl-select" value={filters.repository_id ?? ''} onChange={(e) => update({ repository_id: e.target.value || undefined })}>
          <option value="">Todos los repositorios</option>
          {data?.repositories.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select className="vl-select" value={filters.severity ?? ''} onChange={(e) => update({ severity: e.target.value || undefined })}>
          <option value="">Toda severidad</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{sevLabel(s)}</option>
          ))}
        </select>
        <select className="vl-select" value={filters.engine ?? ''} onChange={(e) => update({ engine: e.target.value || undefined })}>
          <option value="">Todos los motores</option>
          {ENGINES.map((e) => (
            <option key={e.id} value={e.id}>{e.label}</option>
          ))}
        </select>
        <label className="tr-date" title="Activos desde">
          Desde
          <input type="date" value={filters.from ?? ''} onChange={(e) => update({ from: e.target.value || undefined })} />
        </label>
        <label className="tr-date" title="Activos hasta">
          Hasta
          <input type="date" value={filters.to ?? ''} onChange={(e) => update({ to: e.target.value || undefined })} />
        </label>
        {hasFilters && (
          <button type="button" className="tr-link" onClick={clear}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="tr-statusbar">
        <div className="vl-ranges" role="group" aria-label="Estado">
          {STATUS_TABS.map((t) => (
            <button key={t.id} type="button" className={`vl-range ${filters.status === t.id ? 'is-active' : ''}`} onClick={() => update({ status: t.id })}>
              {t.label} {data ? <span className="tr-count">{data.counts[t.count]}</span> : null}
            </button>
          ))}
        </div>
        {data && data.counts.overdue > 0 && (
          <span className="tr-chip is-bad">
            <Clock size={11} /> {data.counts.overdue} fuera de plazo
          </span>
        )}
        <button type="button" className="btn btn-secondary tr-export" onClick={exportList} disabled={!data?.total}>
          <Download size={14} /> Exportar listado
        </button>
      </div>

      {error && <div className="card tr-error">{error}</div>}

      <div className={`tr-layout ${selected ? 'has-detail' : ''}`}>
        <div className="card tr-list">
          {loading && !data && <PageSkeleton variant="list" rows={7} embedded />}
          {data && data.items.length === 0 && (
            <div className="tr-empty">
              {hasFilters || filters.status !== 'all'
                ? 'No hay hallazgos con estos filtros.'
                : 'Aún no hay hallazgos. Cuando un análisis encuentre algo, su historia aparecerá aquí.'}
            </div>
          )}
          {data?.items.map((i) => (
            <button
              key={i.key}
              type="button"
              className={`tr-item ${selected === i.key || selected === i.finding_id ? 'is-active' : ''}`}
              onClick={() => setSelected(i.key)}
            >
              <span className="tr-item-sev" style={{ background: sevColor(i.severity) }} title={sevLabel(i.severity)} />
              <span className="tr-item-main">
                <span className="tr-item-title">{i.title}</span>
                <span className="tr-item-sub">
                  {i.repository_name}
                  {i.file_path ? ` · ${i.file_path}` : ''}
                </span>
                <span className="tr-item-meta">
                  Detectado {timeAgo(i.first_seen ?? '')} · {i.detections} análisis
                  {i.regressions ? ` · reapareció ${i.regressions}×` : ''}
                </span>
              </span>
              <span className="tr-item-side">
                <span className={`tr-status ${STATUS_TONE[i.status] ?? ''}`}>{i.status_label}</span>
                {i.sla.overdue && <span className="tr-overdue">fuera de plazo</span>}
              </span>
            </button>
          ))}
          {data && data.items.length < data.total && (
            <button type="button" className="tr-more" onClick={() => setLimit((l) => l + PAGE_SIZE)} disabled={loading}>
              {loading ? 'Cargando…' : `Ver más (${data.total - data.items.length} restantes)`}
            </button>
          )}
        </div>
        {selected ? (
          <IssueDetail key={selected} refId={selected} onClose={() => setSelected(null)} onLoaded={onDetailLoaded} />
        ) : (
          data && data.items.length > 0 && (
            <div className="card tr-detail tr-placeholder">
              <History size={28} />
              <p>Elige un hallazgo para ver su historia completa: en qué commit apareció, quién lo revisó, qué excepciones hubo y cuándo se corrigió.</p>
            </div>
          )
        )}
      </div>
    </>
  );
};

const EventsView: React.FC<{ onOpenFinding: (key: string) => void }> = ({ onOpenFinding }) => {
  const [filters, setFilters] = useState<AuditTrailFilters>({});
  const [query, setQuery] = useState('');
  const [data, setData] = useState<AuditTrail | null>(null);
  const [limit, setLimit] = useState(EVENTS_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((f) => ({ ...f, q: query.trim() || undefined }));
      setLimit(EVENTS_PAGE);
    }, 350);
    return () => window.clearTimeout(id);
  }, [query]);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    fetchAuditTrail({ ...filters, limit })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'No se pudo cargar la bitácora'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [filters, limit]);
  useEffect(() => load(), [load]);

  const update = (patch: Partial<AuditTrailFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setLimit(EVENTS_PAGE);
  };
  const hasFilters = Boolean(query || filters.actor || filters.category || filters.repository || filters.from || filters.to || filters.people_only);

  const pillowContext = useMemo(() => {
    if (!data) return null;
    return {
      vista: 'Bitácora de auditoría',
      filtros: filters,
      total_eventos: data.total,
      quienes_mas_actuan: data.actors.slice(0, 8).map((a) => `${a.label}: ${a.count}`),
      por_categoria: data.categories.filter((c) => c.count).map((c) => `${c.label}: ${c.count}`),
      ultimos_eventos: data.items.slice(0, 25).map((e) => `${formatDateTime(e.at)} · ${e.actor_label} · ${e.label} · ${e.target ?? ''}`),
    };
  }, [data, filters]);
  usePillowPageContext('traceability', pillowContext);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchAuditTrail({ ...filters, limit: EXPORT_LIMIT, offset: 0 });
      const rows: (string | number | null)[][] = [
        ['Fecha', 'Responsable', 'Cuenta', 'Acción', 'Código', 'Categoría', 'Sobre', 'Detalle'],
        ...all.items.map((e) => [e.at, e.actor_label, e.actor, e.label, e.action, e.category_label, e.target, e.detail]),
      ];
      download(`bitacora-auditoria-${new Date().toISOString().slice(0, 10)}.csv`, csv(rows), 'text/csv;charset=utf-8');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="card tr-filters">
        <label className="tr-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en acciones y detalles" />
        </label>
        <select className="vl-select" value={filters.actor ?? ''} onChange={(e) => update({ actor: e.target.value || undefined })}>
          <option value="">Todas las personas y sistemas</option>
          {data?.actors.map((a) => (
            <option key={a.actor} value={a.actor}>
              {a.label} ({a.count})
            </option>
          ))}
        </select>
        <select className="vl-select" value={filters.category ?? ''} onChange={(e) => update({ category: e.target.value || undefined })}>
          <option value="">Todas las categorías</option>
          {data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} ({c.count})
            </option>
          ))}
        </select>
        <select className="vl-select" value={filters.repository ?? ''} onChange={(e) => update({ repository: e.target.value || undefined })}>
          <option value="">Todos los repositorios</option>
          {data?.repositories.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <label className="tr-date">
          Desde
          <input type="date" value={filters.from ?? ''} onChange={(e) => update({ from: e.target.value || undefined })} />
        </label>
        <label className="tr-date">
          Hasta
          <input type="date" value={filters.to ?? ''} onChange={(e) => update({ to: e.target.value || undefined })} />
        </label>
        <label className="tr-check">
          <input type="checkbox" checked={Boolean(filters.people_only)} onChange={(e) => update({ people_only: e.target.checked || undefined })} />
          Solo personas
        </label>
        {hasFilters && (
          <button
            type="button"
            className="tr-link"
            onClick={() => {
              setQuery('');
              setFilters({});
              setLimit(EVENTS_PAGE);
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="tr-statusbar">
        <span className="tr-muted">
          {data ? `${data.total.toLocaleString('es-CL')} ${data.total === 1 ? 'evento' : 'eventos'}` : 'Cargando…'}
          {data && data.total > EXPORT_LIMIT ? ` · la exportación incluye los ${EXPORT_LIMIT.toLocaleString('es-CL')} más recientes` : ''}
        </span>
        <button type="button" className="btn btn-secondary tr-export" onClick={exportCsv} disabled={!data?.total || exporting}>
          <Download size={14} /> {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>

      {error && <div className="card tr-error">{error}</div>}

      <div className="card tr-table-wrap">
        <table className="tr-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Quién</th>
              <th>Qué hizo</th>
              <th>Sobre</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((e) => (
              <tr key={e.id}>
                <td className="tr-nowrap" title={formatDateTime(e.at)}>
                  {formatDateTime(e.at)}
                </td>
                <td>
                  <span className={`tr-actor ${e.person ? 'is-person' : ''}`}>{e.actor_label}</span>
                </td>
                <td>
                  <span className={`tr-cat tr-cat-${e.category}`}>{e.category_label}</span>
                  <div className="tr-action">{e.label}</div>
                </td>
                <td className="tr-target">{e.target ?? '—'}</td>
                <td className="tr-detail-cell">
                  {e.detail ?? ''}
                  {e.finding_key && (
                    <button type="button" className="tr-link" onClick={() => onOpenFinding(e.finding_key as string)}>
                      Ver historia del hallazgo
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && (
          <div className="tr-empty">{hasFilters ? 'No hay eventos con estos filtros.' : 'Aún no hay acciones registradas.'}</div>
        )}
        {data && data.items.length < data.total && (
          <button type="button" className="tr-more" onClick={() => setLimit((l) => l + EVENTS_PAGE)} disabled={loading}>
            {loading ? 'Cargando…' : `Ver más (${(data.total - data.items.length).toLocaleString('es-CL')} restantes)`}
          </button>
        )}
      </div>
    </>
  );
};

export const TraceabilityPage: React.FC<PageProps> = ({ onNavigate, ...headerProps }) => {
  const { t } = useI18n();
  const [initialRef] = useState<string | null>(() => {
    try {
      const ref = localStorage.getItem(TRACE_REF_KEY);
      if (ref) localStorage.removeItem(TRACE_REF_KEY);
      return ref;
    } catch {
      return null;
    }
  });
  const [view, setView] = useState<View>('findings');
  const [openRef, setOpenRef] = useState<string | null>(initialRef);

  return (
    <div className="tr-page">
      <Header
        title={t('pages.traceability.title')}
        subtitle={t('pages.traceability.subtitle')}
        onNavigate={onNavigate}
        {...headerProps}
      />

      <div className="tr-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view === 'findings'} className={view === 'findings' ? 'is-active' : ''} onClick={() => setView('findings')}>
          <History size={15} /> Historia de hallazgos
        </button>
        <button type="button" role="tab" aria-selected={view === 'events'} className={view === 'events' ? 'is-active' : ''} onClick={() => setView('events')}>
          <ScrollText size={15} /> Bitácora de auditoría
        </button>
      </div>

      {view === 'findings' ? (
        <FindingsView key={openRef ?? 'list'} initialRef={openRef} />
      ) : (
        <EventsView
          onOpenFinding={(key) => {
            setOpenRef(key);
            setView('findings');
          }}
        />
      )}
    </div>
  );
};
