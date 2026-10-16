import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import PageSkeleton from '../components/PageSkeleton';
import { Finding, TRACE_REF_KEY, fetchFindings, updateFindingStatus, clearFindings } from '../api/client';
import {
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  FileCode,
  ChevronRight,
  ChevronDown,
  CircleSlash,
  Flag,
  Eye,
  Trash2,
  Search,
  Layers,
  List,
  Package,
  Clock,
  ArrowUpCircle,
  History,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { formatFilePath } from '../utils/formatFilePath';
import { formatDateTime } from '../utils/formatDateTime';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  FindingGroup,
  SEVERITIES,
  SEVERITY_LABEL,
  SEVERITY_COLOR,
  SLA_DAYS,
  Severity,
  SlaState,
  groupFindings,
  slaState,
  slaRemaining,
  ageDays,
  packageOf,
} from '../utils/findingGroups';
import { usePillowPageContext } from '../config/pillowContext';
import '../styles/findings.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const ENGINE_LABEL: Record<Finding['engine'], string> = {
  semgrep: 'Semgrep · SAST',
  trivy: 'Trivy · SCA/IaC',
  gitleaks: 'GitLeaks · Secretos',
  owasp_zap: 'ZAP · DAST',
};

const STATUS_STYLE: Record<Finding['status'], { label: string; bg: string; fg: string; border: string }> = {
  OPEN: { label: 'Abierto', bg: '#ffebe9', fg: '#cf222e', border: '#ff818266' },
  IN_REVIEW: { label: 'En revisión', bg: '#ddf4ff', fg: '#0969da', border: '#54aeff66' },
  FIXED: { label: 'Corregido', bg: '#dafbe1', fg: '#1a7f37', border: '#4ac26b66' },
  FALSE_POSITIVE: { label: 'Falso positivo', bg: '#f6f8fa', fg: '#656d76', border: '#d0d7de' },
  ACCEPTED_RISK: { label: 'Riesgo aceptado', bg: '#fff8c5', fg: '#9a6700', border: '#d4a72c66' },
  SUPERSEDED: { label: 'Reemplazado', bg: '#f6f8fa', fg: '#8c959f', border: '#d0d7de' },
};

const SLA_STYLE: Record<SlaState, { label: string; color: string }> = {
  breached: { label: 'Vencido', color: '#cf222e' },
  due: { label: 'Por vencer', color: '#bf8700' },
  ok: { label: 'En plazo', color: '#1a7f37' },
  closed: { label: 'Cerrado', color: '#8c959f' },
};

const PAGE_SIZE = 50;

const SeverityBadge: React.FC<{ severity: Severity }> = ({ severity }) => (
  <span
    className="fm-sev"
    style={{ color: SEVERITY_COLOR[severity], borderColor: `${SEVERITY_COLOR[severity]}55`, background: `${SEVERITY_COLOR[severity]}12` }}
  >
    {SEVERITY_LABEL[severity]}
  </span>
);

const StatusBadge: React.FC<{ status: Finding['status'] }> = ({ status }) => {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.OPEN;
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
};

const SlaBadge: React.FC<{ state: SlaState; days?: number }> = ({ state, days }) => {
  const s = SLA_STYLE[state];
  return (
    <span className="fm-sla" style={{ color: s.color }}>
      <Clock size={12} />
      {s.label}
      {days !== undefined && state !== 'closed' ? ` · ${days >= 0 ? `${days}d` : `${-days}d atraso`}` : ''}
    </span>
  );
};

const SeverityStack: React.FC<{ counts: Record<Severity, number> }> = ({ counts }) => {
  const total = SEVERITIES.reduce((n, s) => n + (counts[s] ?? 0), 0) || 1;
  return (
    <div className="fm-stack" title={SEVERITIES.filter((s) => counts[s]).map((s) => `${SEVERITY_LABEL[s]}: ${counts[s]}`).join(' · ')}>
      {SEVERITIES.filter((s) => counts[s]).map((s) => (
        <span key={s} style={{ width: `${(counts[s] / total) * 100}%`, background: SEVERITY_COLOR[s] }} />
      ))}
    </div>
  );
};

export const FindingsPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
}) => {
  const { t } = useI18n();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [view, setView] = useState<'grouped' | 'list'>('grouped');
  const [query, setQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('all');
  const [selectedEngine, setSelectedEngine] = useState('all');
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [onlyBreached, setOnlyBreached] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = (type: ToastMessage['type'], title: string, message: string) =>
    setToast({ id: Date.now().toString(), type, title, message });

  const loadFindings = () => {
    setLoading(true);
    const statusFilter = selectedStatus === 'active' || selectedStatus === 'all' ? undefined : selectedStatus;
    fetchFindings(undefined, undefined, statusFilter)
      .then((data) => setFindings(data || []))
      .catch((err) => {
        setFindings([]);
        notify('error', 'Error', err instanceof Error ? err.message : 'No se pudieron cargar los hallazgos.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFindings();
  }, [selectedStatus]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, selectedRepo, selectedEngine, selectedSeverities, selectedStatus, onlyBreached, view]);

  const repos = useMemo(
    () => [...new Set(findings.map((f) => f.repository_name || f.repository_id))].sort(),
    [findings],
  );

  const now = useMemo(() => Date.now(), [findings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return findings.filter((f) => {
      if (selectedStatus === 'active' && f.status !== 'OPEN' && f.status !== 'IN_REVIEW') return false;
      if (selectedRepo !== 'all' && (f.repository_name || f.repository_id) !== selectedRepo) return false;
      if (selectedEngine !== 'all' && f.engine !== selectedEngine) return false;
      if (selectedSeverities.length && !selectedSeverities.includes(f.severity)) return false;
      if (onlyBreached && slaState(f, now) !== 'breached') return false;
      if (q) {
        const hay = `${f.title} ${f.description} ${f.file_path ?? ''} ${f.cwe ?? ''} ${f.repository_name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [findings, query, selectedRepo, selectedEngine, selectedSeverities, selectedStatus, onlyBreached, now]);

  const groups = useMemo(() => groupFindings(filtered, now), [filtered, now]);

  const summary = useMemo(() => {
    const base = findings.filter((f) => selectedStatus !== 'active' || f.status === 'OPEN' || f.status === 'IN_REVIEW');
    const bySev = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
    let breached = 0;
    let fixable = 0;
    for (const f of base) {
      bySev[f.severity] += 1;
      if (slaState(f, now) === 'breached') breached += 1;
      if (packageOf(f)?.fix) fixable += 1;
    }
    return { bySev, breached, fixable, total: base.length };
  }, [findings, selectedStatus, now]);

  const pillowContext = useMemo(
    () => ({
      summary,
      top_findings: filtered.slice(0, 15).map((f) => ({
        title: f.title,
        severity: f.severity,
        engine: f.engine,
        status: f.status,
        file: f.file_path,
      })),
    }),
    [summary, filtered],
  );
  usePillowPageContext('findings', loading ? null : pillowContext);

  const toggleSeverity = (s: Severity) =>
    setSelectedSeverities((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const hasFilters =
    query || selectedRepo !== 'all' || selectedEngine !== 'all' || selectedSeverities.length || onlyBreached;

  const resetFilters = () => {
    setQuery('');
    setSelectedRepo('all');
    setSelectedEngine('all');
    setSelectedSeverities([]);
    setOnlyBreached(false);
  };

  const handleClearMatrix = async () => {
    setClearing(true);
    try {
      const res = await clearFindings();
      setFindings([]);
      setConfirmClear(false);
      notify('success', 'Matriz vaciada', `Se eliminaron ${res.deleted} hallazgos. Ejecute un escaneo de nuevo desde Repositorios.`);
    } catch (err) {
      notify('error', 'No se pudo vaciar', err instanceof Error ? err.message : 'Error de API');
    } finally {
      setClearing(false);
    }
  };

  const applyStatus = async (status: Finding['status']) => {
    if (!activeFinding) return;
    try {
      await updateFindingStatus(activeFinding.id, status, `Acción HITL: ${status}`);
      setFindings((prev) => prev.map((f) => (f.id === activeFinding.id ? { ...f, status } : f)));
      notify('success', STATUS_STYLE[status].label, activeFinding.title);
      setActiveFinding(null);
    } catch (err) {
      notify('error', 'No se actualizó el hallazgo', err instanceof Error ? err.message : 'Error de API');
    }
  };

  const applyGroupStatus = async (group: FindingGroup, status: Finding['status']) => {
    const targets = group.findings.filter((f) => f.status === 'OPEN' || f.status === 'IN_REVIEW');
    if (!targets.length) return;
    setBusyGroup(group.key);
    const results = await Promise.allSettled(
      targets.map((f) => updateFindingStatus(f.id, status, `Acción HITL masiva (${group.label}): ${status}`)),
    );
    const okIds = new Set(targets.filter((_, i) => results[i].status === 'fulfilled').map((f) => f.id));
    setFindings((prev) => prev.map((f) => (okIds.has(f.id) ? { ...f, status } : f)));
    setBusyGroup(null);
    const failed = targets.length - okIds.size;
    if (failed) notify('error', 'Actualización parcial', `${okIds.size} actualizados, ${failed} con error (¿sesión expirada?).`);
    else notify('success', STATUS_STYLE[status].label, `${okIds.size} hallazgos de ${group.label}`);
  };

  const renderFindingRow = (f: Finding, nested = false) => (
    <tr key={f.id} className={nested ? 'fm-nested' : undefined}>
      <td>
        <SeverityBadge severity={f.severity} />
      </td>
      <td>
        <div className="fm-title">{f.title}</div>
        {!nested && (
          <div className="fm-sub">
            {f.repository_name || f.repository_id}
            {f.iso_control ? ` · ${f.iso_control}` : ''}
          </div>
        )}
      </td>
      {!nested && (
        <td>
          <span className="badge badge-engine">{f.engine.toUpperCase()}</span>
        </td>
      )}
      <td>
        <StatusBadge status={f.status} />
      </td>
      <td>
        <span className="fm-path">
          {formatFilePath(f.file_path) || t('findings.apiEndpoint')}
          {f.line_number ? `:${f.line_number}` : ''}
        </span>
      </td>
      <td>
        <SlaBadge state={slaState(f, now)} days={slaRemaining(f, now)} />
      </td>
      <td>
        <button className="btn btn-secondary fm-btn-sm" onClick={() => setActiveFinding(f)}>
          <span>{t('findings.inspect')}</span>
          <ChevronRight size={14} />
        </button>
      </td>
    </tr>
  );

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <Header
        title={t('pages.findings.title')}
        subtitle={t('pages.findings.subtitle')}
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      <div className="fm-summary">
        {SEVERITIES.filter((s) => s !== 'INFO' || summary.bySev.INFO > 0).map((s) => (
          <button
            key={s}
            type="button"
            className={`fm-summary-card ${selectedSeverities.includes(s) ? 'is-active' : ''}`}
            style={{ ['--sev' as string]: SEVERITY_COLOR[s] }}
            onClick={() => toggleSeverity(s)}
          >
            <span className="fm-summary-label">{SEVERITY_LABEL[s]}</span>
            <span className="fm-summary-value">{summary.bySev[s]}</span>
            <span className="fm-summary-hint">plazo {SLA_DAYS[s]} días</span>
          </button>
        ))}
        <button
          type="button"
          className={`fm-summary-card ${onlyBreached ? 'is-active' : ''}`}
          style={{ ['--sev' as string]: '#cf222e' }}
          onClick={() => setOnlyBreached((v) => !v)}
        >
          <span className="fm-summary-label">Plazo vencido</span>
          <span className="fm-summary-value">{summary.breached}</span>
          <span className="fm-summary-hint">fuera de SLA</span>
        </button>
        <div className="fm-summary-card is-static" style={{ ['--sev' as string]: '#1a7f37' }}>
          <span className="fm-summary-label">Con parche</span>
          <span className="fm-summary-value">{summary.fixable}</span>
          <span className="fm-summary-hint">actualizar dependencia</span>
        </div>
      </div>

      <div className="card fm-toolbar">
        <div className="fm-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar CVE, paquete, regla, archivo…"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
              <X size={14} />
            </button>
          )}
        </div>

        <select value={selectedRepo} onChange={(e) => setSelectedRepo(e.target.value)} className="filter-select">
          <option value="all">Todos los repos</option>
          {repos.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select value={selectedEngine} onChange={(e) => setSelectedEngine(e.target.value)} className="filter-select">
          <option value="all">{t('findings.allEngines')}</option>
          {(Object.keys(ENGINE_LABEL) as Finding['engine'][]).map((e) => (
            <option key={e} value={e}>
              {ENGINE_LABEL[e]}
            </option>
          ))}
        </select>

        <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="filter-select">
          <option value="active">Activos (abiertos + en revisión)</option>
          <option value="all">Todos (sin reemplazados)</option>
          {(Object.keys(STATUS_STYLE) as Finding['status'][]).map((s) => (
            <option key={s} value={s}>
              {STATUS_STYLE[s].label}
            </option>
          ))}
        </select>

        {hasFilters ? (
          <button type="button" className="btn btn-secondary fm-btn-sm" onClick={resetFilters}>
            <X size={13} />
            <span>Limpiar filtros</span>
          </button>
        ) : null}

        <div className="fm-view-toggle">
          <button type="button" className={view === 'grouped' ? 'is-active' : ''} onClick={() => setView('grouped')}>
            <Layers size={14} />
            <span>Agrupado</span>
          </button>
          <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>
            <List size={14} />
            <span>Lista</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldAlert size={20} color="#0969da" />
            <span>
              {view === 'grouped'
                ? `${groups.length} grupos · ${filtered.length} hallazgos`
                : `${filtered.length} hallazgos`}
            </span>
          </div>
          <button
            className="btn btn-secondary"
            style={{ color: '#cf222e', borderColor: '#ff8182' }}
            disabled={clearing || findings.length === 0}
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 size={14} />
            <span>{clearing ? t('common.loading') : 'Vaciar matriz'}</span>
          </button>
        </div>

        {loading ? (
          <PageSkeleton variant="table" rows={7} embedded />
        ) : findings.length === 0 ? (
          <div className="fm-empty">Sin hallazgos. Ejecute un escaneo desde Repositorios.</div>
        ) : filtered.length === 0 ? (
          <div className="fm-empty">Ningún hallazgo coincide con los filtros.</div>
        ) : view === 'grouped' ? (
          <div className="table-container">
            <table className="custom-table fm-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th>Severidad</th>
                  <th>Componente / regla</th>
                  <th>Motor</th>
                  <th>Repositorio</th>
                  <th>Hallazgos</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {groups.slice(0, visible).map((g) => {
                  const open = expanded.has(g.key);
                  return (
                    <React.Fragment key={g.key}>
                      <tr className={`fm-group ${open ? 'is-open' : ''}`} onClick={() => toggleExpanded(g.key)}>
                        <td>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                        <td>
                          <SeverityBadge severity={g.maxSeverity} />
                        </td>
                        <td>
                          <div className="fm-title">
                            {g.kind === 'package' && <Package size={14} />}
                            {g.label}
                          </div>
                          <div className="fm-sub">
                            {g.kind === 'package' && g.fixVersion ? (
                              <span className="fm-fix">
                                <ArrowUpCircle size={12} /> Actualizar a {g.fixVersion}
                              </span>
                            ) : (
                              g.sublabel.slice(0, 140)
                            )}
                            {g.files.length ? ` · ${formatFilePath(g.files[0])}${g.files.length > 1 ? ` (+${g.files.length - 1})` : ''}` : ''}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-engine">{g.engine.toUpperCase()}</span>
                        </td>
                        <td className="fm-sub">{g.repositoryName}</td>
                        <td>
                          <div className="fm-count">
                            <b>{g.findings.length}</b>
                            <SeverityStack counts={g.counts} />
                          </div>
                        </td>
                        <td>
                          <SlaBadge state={g.worstSla} />
                        </td>
                      </tr>
                      {open && (
                        <tr className="fm-expand">
                          <td colSpan={7}>
                            <div className="fm-bulk">
                              <span>
                                {g.activeCount} activos en este grupo
                                {g.kind === 'package' && g.fixVersion
                                  ? ` · una sola actualización a ${g.fixVersion} corrige ${g.findings.length} CVE`
                                  : ''}
                              </span>
                              <div className="fm-bulk-actions">
                                <button
                                  className="btn btn-secondary fm-btn-sm"
                                  disabled={!g.activeCount || busyGroup === g.key}
                                  onClick={() => applyGroupStatus(g, 'IN_REVIEW')}
                                >
                                  <Eye size={13} /> En revisión
                                </button>
                                <button
                                  className="btn btn-secondary fm-btn-sm"
                                  disabled={!g.activeCount || busyGroup === g.key}
                                  onClick={() => applyGroupStatus(g, 'FALSE_POSITIVE')}
                                >
                                  <CircleSlash size={13} /> Falso positivo
                                </button>
                                <button
                                  className="btn btn-secondary fm-btn-sm"
                                  disabled={!g.activeCount || busyGroup === g.key}
                                  onClick={() => applyGroupStatus(g, 'ACCEPTED_RISK')}
                                >
                                  <Flag size={13} /> Aceptar riesgo
                                </button>
                                <button
                                  className="btn btn-primary fm-btn-sm"
                                  disabled={!g.activeCount || busyGroup === g.key}
                                  onClick={() => applyGroupStatus(g, 'FIXED')}
                                >
                                  <CheckCircle2 size={13} /> Corregido
                                </button>
                              </div>
                            </div>
                            <table className="custom-table fm-inner">
                              <tbody>{g.findings.map((f) => renderFindingRow(f, true))}</tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table fm-table">
              <thead>
                <tr>
                  <th>{t('findings.severity')}</th>
                  <th>{t('findings.titleCol')}</th>
                  <th>{t('findings.engine')}</th>
                  <th>{t('findings.statusHitl')}</th>
                  <th>{t('findings.fileEndpoint')}</th>
                  <th>SLA</th>
                  <th>{t('findings.action')}</th>
                </tr>
              </thead>
              <tbody>{filtered.slice(0, visible).map((f) => renderFindingRow(f))}</tbody>
            </table>
          </div>
        )}

        {!loading && (view === 'grouped' ? groups.length : filtered.length) > visible && (
          <div className="fm-more">
            <button className="btn btn-secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Mostrar {PAGE_SIZE} más ({(view === 'grouped' ? groups.length : filtered.length) - visible} restantes)
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmClear}
        title="Vaciar matriz de hallazgos"
        message="Se eliminarán todos los hallazgos. Puede volver a escanear los repositorios después. Esta acción no se puede deshacer."
        confirmLabel="Vaciar matriz"
        cancelLabel={t('common.cancel')}
        danger
        busy={clearing}
        onCancel={() => !clearing && setConfirmClear(false)}
        onConfirm={handleClearMatrix}
      />

      {activeFinding && (
        <div className="modal-overlay" onClick={() => setActiveFinding(null)}>
          <div className="modal-content" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <SeverityBadge severity={activeFinding.severity} />
                <span style={{ marginLeft: '0.5rem' }}>
                  <StatusBadge status={activeFinding.status} />
                </span>
                <span style={{ marginLeft: '0.5rem' }}>
                  <SlaBadge state={slaState(activeFinding, now)} days={slaRemaining(activeFinding, now)} />
                </span>
                <h2 style={{ fontSize: '1.15rem', marginTop: '0.5rem', color: '#1f2328', fontWeight: 700, wordBreak: 'break-word' }}>
                  {activeFinding.title}
                </h2>
              </div>
              <span className="badge badge-engine">{activeFinding.engine.toUpperCase()}</span>
            </div>

            <p style={{ color: '#656d76', fontSize: '0.875rem', marginBottom: '1rem', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
              {activeFinding.description}
            </p>

            <div className="fm-detail-box">
              <div className="fm-detail-path">
                <FileCode size={16} />
                <span>
                  {formatFilePath(activeFinding.file_path) || t('findings.apiEndpoint')}
                  {activeFinding.line_number ? ` (${t('findings.line', { n: activeFinding.line_number })})` : ''}
                </span>
              </div>
              <div className="fm-detail-grid">
                <div><strong>Repo:</strong> {activeFinding.repository_name || activeFinding.repository_id}</div>
                <div><strong>Detectado:</strong> {formatDateTime(activeFinding.created_at)} ({ageDays(activeFinding, now)} días)</div>
                <div><strong>Plazo de corrección:</strong> {SLA_DAYS[activeFinding.severity]} días para severidad {SEVERITY_LABEL[activeFinding.severity].toLowerCase()}</div>
                <div><strong>Usuario / origen:</strong> {activeFinding.triggered_by || 'web_hub'}</div>
                {activeFinding.cwe ? <div><strong>CWE:</strong> {activeFinding.cwe}</div> : null}
                {activeFinding.iso_control ? <div><strong>ISO 27001:</strong> {activeFinding.iso_control}</div> : null}
              </div>
            </div>

            {activeFinding.ai_summary && (
              <div className="ai-card">
                <div className="ai-card-title">
                  <Sparkles size={16} />
                  <span>Análisis de IA & Propuesta de Parche (Human-in-the-Loop)</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#1f2328', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                  {activeFinding.ai_summary}
                </p>
                <div className="code-block">{activeFinding.ai_remediation}</div>
                <p style={{ fontSize: '0.75rem', color: '#656d76', marginTop: '0.75rem' }}>
                  La IA no cierra ni descarta hallazgos. Un auditor debe validar el diagnóstico.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.55rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setActiveFinding(null)}>{t('findings.close')}</button>
              {onNavigate && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    localStorage.setItem(TRACE_REF_KEY, activeFinding.id);
                    onNavigate('traceability');
                  }}
                >
                  <History size={14} />
                  <span>Ver historia</span>
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => applyStatus('IN_REVIEW')}>
                <Eye size={14} />
                <span>{t('findings.inReview')}</span>
              </button>
              <button className="btn btn-secondary" onClick={() => applyStatus('FALSE_POSITIVE')}>
                <CircleSlash size={14} />
                <span>{t('findings.falsePositive')}</span>
              </button>
              <button className="btn btn-secondary" onClick={() => applyStatus('ACCEPTED_RISK')}>
                <Flag size={14} />
                <span>{t('findings.acceptRisk')}</span>
              </button>
              <button className="btn btn-primary" onClick={() => applyStatus('FIXED')}>
                <CheckCircle2 size={16} />
                <span>{t('findings.approveFixed')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
