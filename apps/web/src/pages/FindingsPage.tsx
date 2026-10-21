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
  RotateCcw,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { formatFilePath } from '../utils/formatFilePath';
import { formatDateTime } from '../utils/formatDateTime';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  FindingGroup,
  SEVERITIES,
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

const STATUS_STYLE: Record<Finding['status'], { bg: string; fg: string; border: string }> = {
  OPEN: { bg: '#ffebe9', fg: '#cf222e', border: '#ff818266' },
  IN_REVIEW: { bg: '#ddf4ff', fg: '#0969da', border: '#54aeff66' },
  FIXED: { bg: '#dafbe1', fg: '#1a7f37', border: '#4ac26b66' },
  FALSE_POSITIVE: { bg: '#f6f8fa', fg: '#656d76', border: '#d0d7de' },
  ACCEPTED_RISK: { bg: '#fff8c5', fg: '#9a6700', border: '#d4a72c66' },
  SUPERSEDED: { bg: '#f6f8fa', fg: '#8c959f', border: '#d0d7de' },
};

const SLA_COLOR: Record<SlaState, string> = {
  breached: '#cf222e',
  due: '#bf8700',
  ok: '#1a7f37',
  closed: '#8c959f',
};

const TEST_PATH_RE = /(^|\/)(tests?|__tests__|spec|specs|fixtures?|examples?|samples?|demo|mocks?|testdata)(\/|$)|(\.|_|-)(test|spec)\.[a-z0-9]+$/i;

function isCandidateFalsePositive(f: Finding): boolean {
  if (f.ai_verdict === 'LIKELY_FALSE_POSITIVE') return true;
  if (f.file_path && TEST_PATH_RE.test(f.file_path.replace(/\\/g, '/'))) return true;
  return false;
}

const PAGE_SIZE = 50;

const SeverityBadge: React.FC<{ severity: Severity }> = ({ severity }) => {
  const { t } = useI18n();
  return (
    <span
      className="fm-sev"
      style={{ color: SEVERITY_COLOR[severity], borderColor: `${SEVERITY_COLOR[severity]}55`, background: `${SEVERITY_COLOR[severity]}12` }}
    >
      {t(`severity.${severity}`)}
    </span>
  );
};

const StatusBadge: React.FC<{ status: Finding['status'] }> = ({ status }) => {
  const { t } = useI18n();
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.OPEN;
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}>
      {t(`status.${status}`)}
    </span>
  );
};

const SlaBadge: React.FC<{ state: SlaState; days?: number }> = ({ state, days }) => {
  const { t } = useI18n();
  const color = SLA_COLOR[state];
  return (
    <span className="fm-sla" style={{ color }}>
      <Clock size={12} />
      {t(`sla.${state}`)}
      {days !== undefined && state !== 'closed'
        ? ` · ${days >= 0 ? `${days}d` : t('sla.overdueDays', { days: -days })}`
        : ''}
    </span>
  );
};

const AiVerdictBadge: React.FC<{ finding: Finding }> = ({ finding }) => {
  const { t } = useI18n();
  if (finding.ai_verdict === 'LIKELY_FALSE_POSITIVE') {
    return (
      <span className="fm-ai-pill fm-ai-pill--fp" title={finding.ai_summary || t('findings.aiVerdict_LIKELY_FALSE_POSITIVE')}>
        <Sparkles size={11} />
        {t('findings.aiVerdict_LIKELY_FALSE_POSITIVE')}
      </span>
    );
  }
  if (finding.ai_verdict === 'LIKELY_REAL') {
    return (
      <span className="fm-ai-pill fm-ai-pill--real" title={finding.ai_summary || t('findings.aiVerdict_LIKELY_REAL')}>
        <Sparkles size={11} />
        {t('findings.aiVerdict_LIKELY_REAL')}
      </span>
    );
  }
  if (finding.ai_verdict === 'NEEDS_REVIEW') {
    return (
      <span className="fm-ai-pill fm-ai-pill--review" title={finding.ai_summary || t('findings.aiVerdict_NEEDS_REVIEW')}>
        <Sparkles size={11} />
        {t('findings.aiVerdict_NEEDS_REVIEW')}
      </span>
    );
  }
  if (isCandidateFalsePositive(finding)) {
    return (
      <span className="fm-ai-pill fm-ai-pill--fp">
        <CircleSlash size={11} />
        Test / Mock
      </span>
    );
  }
  return null;
};

const SeverityStack: React.FC<{ counts: Record<Severity, number> }> = ({ counts }) => {
  const { t } = useI18n();
  const total = SEVERITIES.reduce((n, s) => n + (counts[s] ?? 0), 0) || 1;
  return (
    <div className="fm-stack" title={SEVERITIES.filter((s) => counts[s]).map((s) => `${t(`severity.${s}`)}: ${counts[s]}`).join(' · ')}>
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
  const [onlyAiFp, setOnlyAiFp] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);
  const [triageNote, setTriageNote] = useState('');
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = (type: ToastMessage['type'], title: string, message: string) =>
    setToast({ id: Date.now().toString(), type, title, message });

  const loadFindings = () => {
    setLoading(true);
    const statusFilter =
      selectedStatus === 'active' || selectedStatus === 'all' || selectedStatus === 'fp'
        ? undefined
        : selectedStatus;
    fetchFindings(undefined, undefined, statusFilter)
      .then((data) => setFindings(data || []))
      .catch((err) => {
        setFindings([]);
        notify('error', t('common.error'), err instanceof Error ? err.message : t('common.error'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFindings();
  }, [selectedStatus]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, selectedRepo, selectedEngine, selectedSeverities, selectedStatus, onlyBreached, onlyAiFp, view]);

  useEffect(() => {
    setTriageNote('');
  }, [activeFinding?.id]);

  const repos = useMemo(
    () => [...new Set(findings.map((f) => f.repository_name || f.repository_id))].sort(),
    [findings],
  );

  const now = useMemo(() => Date.now(), [findings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return findings.filter((f) => {
      if (selectedStatus === 'active' && f.status !== 'OPEN' && f.status !== 'IN_REVIEW') return false;
      if (selectedStatus === 'fp' && f.status !== 'FALSE_POSITIVE' && f.status !== 'ACCEPTED_RISK') return false;
      if (
        selectedStatus !== 'active' &&
        selectedStatus !== 'all' &&
        selectedStatus !== 'fp' &&
        f.status !== selectedStatus
      ) {
        return false;
      }
      if (selectedRepo !== 'all' && (f.repository_name || f.repository_id) !== selectedRepo) return false;
      if (selectedEngine !== 'all' && f.engine !== selectedEngine) return false;
      if (selectedSeverities.length && !selectedSeverities.includes(f.severity)) return false;
      if (onlyBreached && slaState(f, now) !== 'breached') return false;
      if (onlyAiFp && !isCandidateFalsePositive(f)) return false;
      if (q) {
        const hay = `${f.title} ${f.description} ${f.file_path ?? ''} ${f.cwe ?? ''} ${f.repository_name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [findings, query, selectedRepo, selectedEngine, selectedSeverities, selectedStatus, onlyBreached, onlyAiFp, now]);

  const groups = useMemo(() => groupFindings(filtered, now), [filtered, now]);

  const summary = useMemo(() => {
    const base = findings.filter((f) =>
      selectedStatus === 'active'
        ? f.status === 'OPEN' || f.status === 'IN_REVIEW'
        : selectedStatus === 'fp'
        ? f.status === 'FALSE_POSITIVE' || f.status === 'ACCEPTED_RISK'
        : true,
    );
    const bySev = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
    let breached = 0;
    let fixable = 0;
    for (const f of base) {
      bySev[f.severity] += 1;
      if (slaState(f, now) === 'breached') breached += 1;
      if (packageOf(f)?.fix) fixable += 1;
    }
    const fpCount = findings.filter((f) => f.status === 'FALSE_POSITIVE' || f.status === 'ACCEPTED_RISK').length;
    const acceptedRiskCount = findings.filter((f) => f.status === 'ACCEPTED_RISK').length;
    const aiFpCount = findings.filter(
      (f) => (f.status === 'OPEN' || f.status === 'IN_REVIEW') && isCandidateFalsePositive(f),
    ).length;
    return { bySev, breached, fixable, fpCount, acceptedRiskCount, aiFpCount, total: base.length };
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
    query ||
    selectedRepo !== 'all' ||
    selectedEngine !== 'all' ||
    selectedSeverities.length ||
    onlyBreached ||
    onlyAiFp ||
    selectedStatus === 'fp';

  const resetFilters = () => {
    setQuery('');
    setSelectedRepo('all');
    setSelectedEngine('all');
    setSelectedSeverities([]);
    setOnlyBreached(false);
    setOnlyAiFp(false);
    if (selectedStatus === 'fp') setSelectedStatus('active');
  };

  const handleClearMatrix = async () => {
    setClearing(true);
    try {
      const res = await clearFindings();
      setFindings([]);
      setConfirmClear(false);
      notify('success', t('findings.clearMatrix'), `${res.deleted}`);
    } catch (err) {
      notify('error', t('common.error'), err instanceof Error ? err.message : 'API Error');
    } finally {
      setClearing(false);
    }
  };

  const applyStatus = async (status: Finding['status']) => {
    if (!activeFinding) return;
    const cleanNote = triageNote.trim();
    const reason = cleanNote ? `${cleanNote} (HITL → ${status})` : `Acción HITL: ${status}`;
    try {
      await updateFindingStatus(activeFinding.id, status, reason);
      setFindings((prev) => prev.map((f) => (f.id === activeFinding.id ? { ...f, status } : f)));
      notify('success', t(`status.${status}`), activeFinding.title);
      setActiveFinding(null);
    } catch (err) {
      notify('error', t('common.error'), err instanceof Error ? err.message : 'API Error');
    }
  };

  const applyGroupStatus = async (group: FindingGroup, status: Finding['status']) => {
    const targets =
      status === 'OPEN'
        ? group.findings.filter((f) => f.status !== 'OPEN')
        : group.findings.filter((f) => f.status === 'OPEN' || f.status === 'IN_REVIEW');
    if (!targets.length) return;
    setBusyGroup(group.key);
    const results = await Promise.allSettled(
      targets.map((f) => updateFindingStatus(f.id, status, `Acción HITL masiva (${group.label}): ${status}`)),
    );
    const okIds = new Set(targets.filter((_, i) => results[i].status === 'fulfilled').map((f) => f.id));
    setFindings((prev) => prev.map((f) => (okIds.has(f.id) ? { ...f, status } : f)));
    setBusyGroup(null);
    const failed = targets.length - okIds.size;
    if (failed) notify('error', t('common.error'), `${okIds.size} OK, ${failed} error`);
    else notify('success', t(`status.${status}`), `${okIds.size} · ${group.label}`);
  };

  const renderFindingRow = (f: Finding, nested = false) => (
    <tr key={f.id} className={nested ? 'fm-nested' : undefined}>
      <td>
        <SeverityBadge severity={f.severity} />
      </td>
      <td>
        <div className="fm-title">
          <span>{f.title}</span>
          <AiVerdictBadge finding={f} />
        </div>
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
            <span className="fm-summary-label">{t(`severity.${s}`)}</span>
            <span className="fm-summary-value">{summary.bySev[s]}</span>
            <span className="fm-summary-hint">{t('findings.slaTargetDays', { days: SLA_DAYS[s] })}</span>
          </button>
        ))}
        <button
          type="button"
          className={`fm-summary-card ${onlyBreached ? 'is-active' : ''}`}
          style={{ ['--sev' as string]: '#cf222e' }}
          onClick={() => setOnlyBreached((v) => !v)}
        >
          <span className="fm-summary-label">{t('findings.breachedTitle')}</span>
          <span className="fm-summary-value">{summary.breached}</span>
          <span className="fm-summary-hint">{t('findings.breachedHint')}</span>
        </button>
        <div className="fm-summary-card is-static" style={{ ['--sev' as string]: '#1a7f37' }}>
          <span className="fm-summary-label">{t('findings.fixableTitle')}</span>
          <span className="fm-summary-value">{summary.fixable}</span>
          <span className="fm-summary-hint">{t('findings.fixableHint')}</span>
        </div>
        <button
          type="button"
          className={`fm-summary-card ${onlyAiFp ? 'is-active' : ''}`}
          style={{ ['--sev' as string]: '#8250df' }}
          onClick={() => {
            setOnlyAiFp((v) => !v);
            if (!onlyAiFp && selectedStatus === 'fp') setSelectedStatus('active');
          }}
        >
          <span className="fm-summary-label">{t('findings.aiFpTitle')}</span>
          <span className="fm-summary-value">{summary.aiFpCount}</span>
          <span className="fm-summary-hint">{t('findings.aiFpHint')}</span>
        </button>
        <button
          type="button"
          className={`fm-summary-card ${selectedStatus === 'fp' ? 'is-active' : ''}`}
          style={{ ['--sev' as string]: '#64748b' }}
          onClick={() => setSelectedStatus((s) => (s === 'fp' ? 'active' : 'fp'))}
        >
          <span className="fm-summary-label">{t('findings.fpTitle')}</span>
          <span className="fm-summary-value">{summary.fpCount}</span>
          <span className="fm-summary-hint">{t('findings.fpHint', { risk: summary.acceptedRiskCount })}</span>
        </button>
      </div>

      <div className="card fm-toolbar">
        <div className="fm-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('findings.searchPlaceholder')}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('findings.clearFilters')}>
              <X size={14} />
            </button>
          )}
        </div>

        <select value={selectedRepo} onChange={(e) => setSelectedRepo(e.target.value)} className="filter-select">
          <option value="all">{t('findings.allRepos')}</option>
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
          <option value="active">{t('findings.activeStatuses')}</option>
          <option value="fp">{t('findings.onlyFalsePositives')}</option>
          <option value="all">{t('findings.allStatuses')}</option>
          {(Object.keys(STATUS_STYLE) as Finding['status'][]).map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>

        {hasFilters ? (
          <button type="button" className="btn btn-secondary fm-btn-sm" onClick={resetFilters}>
            <X size={13} />
            <span>{t('findings.clearFilters')}</span>
          </button>
        ) : null}

        <div className="fm-view-toggle">
          <button type="button" className={view === 'grouped' ? 'is-active' : ''} onClick={() => setView('grouped')}>
            <Layers size={14} />
            <span>{t('findings.grouped')}</span>
          </button>
          <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>
            <List size={14} />
            <span>{t('findings.list')}</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldAlert size={20} color="#0969da" />
            <span>
              {view === 'grouped'
                ? t('findings.groupsAndFindings', { groups: groups.length, findings: filtered.length })
                : t('findings.findingsCountHeader', { count: filtered.length })}
            </span>
          </div>
          <button
            className="btn btn-secondary"
            style={{ color: '#cf222e', borderColor: '#ff8182' }}
            disabled={clearing || findings.length === 0}
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 size={14} />
            <span>{clearing ? t('common.loading') : t('findings.clearMatrix')}</span>
          </button>
        </div>

        {loading ? (
          <PageSkeleton variant="table" rows={7} embedded />
        ) : findings.length === 0 ? (
          <div className="fm-empty">{t('findings.emptyNoFindings')}</div>
        ) : filtered.length === 0 ? (
          <div className="fm-empty">{t('findings.emptyNoMatch')}</div>
        ) : view === 'grouped' ? (
          <div className="table-container">
            <table className="custom-table fm-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th>{t('findings.severity')}</th>
                  <th>{t('findings.componentRuleCol')}</th>
                  <th>{t('findings.engine')}</th>
                  <th>{t('findings.repoCol')}</th>
                  <th>{t('findings.findingsCol')}</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {groups.slice(0, visible).map((g) => {
                  const open = expanded.has(g.key);
                  const nonOpenCount = g.findings.filter((f) => f.status !== 'OPEN').length;
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
                                <ArrowUpCircle size={12} /> {t('findings.updateTo', { ver: g.fixVersion })}
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
                                {t('findings.activeInGroup', { count: g.activeCount })}
                                {g.kind === 'package' && g.fixVersion
                                  ? ` · ${t('findings.singleUpdateFixes', { ver: g.fixVersion, count: g.findings.length })}`
                                  : ''}
                              </span>
                              <div className="fm-bulk-actions">
                                {nonOpenCount > 0 && (
                                  <button
                                    className="btn btn-secondary fm-btn-sm"
                                    disabled={busyGroup === g.key}
                                    onClick={() => applyGroupStatus(g, 'OPEN')}
                                  >
                                    <RotateCcw size={13} /> {t('findings.reopen')}
                                  </button>
                                )}
                                <button
                                  className="btn btn-secondary fm-btn-sm"
                                  disabled={!g.activeCount || busyGroup === g.key}
                                  onClick={() => applyGroupStatus(g, 'IN_REVIEW')}
                                >
                                  <Eye size={13} /> {t('findings.inReview')}
                                </button>
                                <button
                                  className="btn btn-secondary fm-btn-sm"
                                  disabled={!g.activeCount || busyGroup === g.key}
                                  onClick={() => applyGroupStatus(g, 'FALSE_POSITIVE')}
                                >
                                  <CircleSlash size={13} /> {t('findings.falsePositive')}
                                </button>
                                <button
                                  className="btn btn-secondary fm-btn-sm"
                                  disabled={!g.activeCount || busyGroup === g.key}
                                  onClick={() => applyGroupStatus(g, 'ACCEPTED_RISK')}
                                >
                                  <Flag size={13} /> {t('findings.acceptRisk')}
                                </button>
                                <button
                                  className="btn btn-primary fm-btn-sm"
                                  disabled={!g.activeCount || busyGroup === g.key}
                                  onClick={() => applyGroupStatus(g, 'FIXED')}
                                >
                                  <CheckCircle2 size={13} /> {t('findings.approveFixed')}
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
              {t('findings.showMore', {
                step: PAGE_SIZE,
                remaining: (view === 'grouped' ? groups.length : filtered.length) - visible,
              })}
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmClear}
        title={t('findings.clearMatrixTitle')}
        message={t('findings.clearMatrixMsg')}
        confirmLabel={t('findings.clearMatrix')}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <SeverityBadge severity={activeFinding.severity} />
                  <StatusBadge status={activeFinding.status} />
                  <SlaBadge state={slaState(activeFinding, now)} days={slaRemaining(activeFinding, now)} />
                  <AiVerdictBadge finding={activeFinding} />
                </div>
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
                <div><strong>{t('findings.repoLabel')}</strong> {activeFinding.repository_name || activeFinding.repository_id}</div>
                <div>
                  <strong>{t('findings.detectedLabel')}</strong> {formatDateTime(activeFinding.created_at)} (
                  {t('findings.daysOld', { days: ageDays(activeFinding, now) })})
                </div>
                <div>
                  <strong>{t('findings.slaPolicyLabel')}</strong>{' '}
                  {t('findings.slaPolicyText', {
                    days: SLA_DAYS[activeFinding.severity],
                    sev: t(`severity.${activeFinding.severity}`).toLowerCase(),
                  })}
                </div>
                <div><strong>{t('findings.originLabel')}</strong> {activeFinding.triggered_by || 'web_hub'}</div>
                {activeFinding.cwe ? <div><strong>CWE:</strong> {activeFinding.cwe}</div> : null}
                {activeFinding.iso_control ? <div><strong>ISO 27001:</strong> {activeFinding.iso_control}</div> : null}
              </div>
            </div>

            {activeFinding.ai_summary && (
              <div className="ai-card">
                <div className="ai-card-title">
                  <Sparkles size={16} />
                  <span>{t('findings.aiAnalysisTitle')}</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#1f2328', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                  {activeFinding.ai_summary}
                </p>
                {activeFinding.ai_remediation && <div className="code-block">{activeFinding.ai_remediation}</div>}
                <p style={{ fontSize: '0.75rem', color: '#656d76', marginTop: '0.75rem' }}>
                  {t('findings.aiDisclaimer')}
                </p>
              </div>
            )}

            <div className="fm-triage-box">
              <label className="fm-triage-label" htmlFor="fm-triage-note-input">
                {t('findings.triageNoteLabel')}
              </label>
              <input
                id="fm-triage-note-input"
                type="text"
                className="fm-triage-input"
                value={triageNote}
                onChange={(e) => setTriageNote(e.target.value)}
                placeholder={t('findings.triageNotePlaceholder')}
              />
              <div className="fm-triage-hint">
                <CircleSlash size={12} />
                <span>{t('findings.fpRuleHint')}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.55rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
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
                  <span>{t('findings.viewHistory')}</span>
                </button>
              )}
              {(activeFinding.status === 'FALSE_POSITIVE' ||
                activeFinding.status === 'ACCEPTED_RISK' ||
                activeFinding.status === 'FIXED') && (
                <button className="btn btn-secondary" onClick={() => applyStatus('OPEN')}>
                  <RotateCcw size={14} />
                  <span>{t('findings.reopen')}</span>
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
