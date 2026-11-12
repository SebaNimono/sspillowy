import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  Cell,
  PolarAngleAxis,
} from 'recharts';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { HeatmapCalendar } from '../components/HeatmapCalendar';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { DashboardSettings } from '../components/DashboardSettings';
import { PillowWidgetBoard } from '../components/PillowWidgetBoard';
import { SingleFileScanModal } from '../components/SingleFileScanModal';
import {
  CustomQueryWidget,
  CustomQueryWidgetCard,
  PillowyAgentRoadmapCard,
  QueryWidgetBuilderModal,
  loadCustomQueryWidgets,
  saveCustomQueryWidgets,
} from '../components/QueryWidgetBuilderModal';
import PageSkeleton from '../components/PageSkeleton';
import { useI18n } from '../i18n/I18nProvider';
import {
  DashboardStats,
  HeatmapData,
  AuditEvent,
  Finding,
  Scan,
  Repository,
  DashboardView,
  fetchStats,
  fetchHeatmap,
  fetchAuditLog,
  fetchFindings,
  fetchScans,
  fetchRepositories,
  updateDashboardView,
} from '../api/client';
import {
  ALERT_COLORS,
  PASTEL_GATE,
  PASTEL_SEVERITY,
  DashboardConfig,
  DashboardWidgetId,
  MetricAlert,
  WIDGET_SPAN_OPTIONS,
  WidgetSpan,
  healthAlert,
  loadDashboardConfig,
  mergeDashboardConfig,
  metricAlert,
  moveLayoutItem,
  normalizeLayout,
  saveDashboardConfig,
  setLayoutSpan,
  syncDashboardConfigToUrl,
} from '../config/dashboardConfig';
import {
  PILLOW_WIDGETS_EVENT,
  PlacedPillowWidget,
  loadPlacedWidgets,
  savePlacedWidgets,
  setPillowWidgetSink,
} from '../config/pillowWidgets';
import { usePillowPageContext } from '../config/pillowContext';
import {
  SEVERITIES,
  SLA_DAYS,
  Severity,
  ageDays,
  groupFindings,
  isActive,
  riskScore,
  slaState,
} from '../utils/findingGroups';
import {
  AlertOctagon,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Database,
  Download,
  FileSpreadsheet,
  Flame,
  GitPullRequest,
  GripVertical,
  Hourglass,
  Info,
  Layers,
  MoreHorizontal,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trophy,
  Filter as FunnelIcon,
  Timer,
  ScanLine,
  LayoutGrid,
  FolderGit2,
  Plus,
  FileCode2,
} from 'lucide-react';
import '../styles/dashboards.css';
import '../styles/workspaces.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
  /** Dashboard guardado; null = General (toda la organización). */
  view?: DashboardView | null;
  onOpenList?: () => void;
  onViewSaved?: (view: DashboardView) => void;
}

type RangeDays = 7 | 30 | 90;
const RANGES: RangeDays[] = [7, 30, 90];
const RANGE_KEY = 'sspillowy_dashboard_range';
const REFRESH_MS = 60_000;
const DAY_MS = 86_400_000;

const EMPTY_STATS: DashboardStats = {
  overall_health_score: 0,
  monitored_repos: 0,
  total_scans_run: 0,
  total_open_findings: 0,
  critical_findings: 0,
  high_findings: 0,
  medium_findings: 0,
  low_findings: 0,
  secrets_leaked_prevented: 0,
  findings_by_engine: {},
  trend_7d: [],
};

const EMPTY_HEATMAP: HeatmapData = { cells: [], max_count: 0, total_findings_period: 0, weeks: 12 };

const ENGINES: { key: Finding['engine']; label: string }[] = [
  { key: 'semgrep', label: 'Semgrep · SAST' },
  { key: 'trivy', label: 'Trivy · SCA/IaC' },
  { key: 'gitleaks', label: 'GitLeaks · Secretos' },
  { key: 'owasp_zap', label: 'ZAP · DAST' },
];

type GateKey = 'PASSED' | 'BLOCKED' | 'BYPASSED' | 'OTHER';

const GATE_META: Record<GateKey, { label: string; color: string }> = {
  PASSED: { label: 'Aprobado', color: PASTEL_GATE.PASSED },
  BLOCKED: { label: 'Bloqueado', color: PASTEL_GATE.BLOCKED },
  BYPASSED: { label: 'Bypass CISO', color: PASTEL_GATE.BYPASSED },
  OTHER: { label: 'Sin gate', color: PASTEL_GATE.OTHER },
};

const STATUS_FUNNEL: { key: Finding['status']; color: string }[] = [
  { key: 'OPEN', color: '#e5484d' },
  { key: 'IN_REVIEW', color: '#3b82f6' },
  { key: 'FIXED', color: '#2da44e' },
  { key: 'FALSE_POSITIVE', color: '#64748b' },
  { key: 'ACCEPTED_RISK', color: '#eab308' },
];

const AGE_BUCKETS = [
  { label: '0–7 d', min: 0, max: 7, color: '#2da44e' },
  { label: '8–30 d', min: 8, max: 30, color: '#eab308' },
  { label: '31–90 d', min: 31, max: 90, color: '#f76b15' },
  { label: '+90 d', min: 91, max: Infinity, color: '#e5484d' },
];

const TREND_SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const actionColor = (action: string) => {
  if (action.includes('SECRET') || action.includes('GATE_BLOCK') || action.includes('FAILED')) return '#cf222e';
  if (action.includes('BYPASS') || action.includes('AI')) return '#8250df';
  if (action.includes('SCAN')) return '#0969da';
  return '#656d76';
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function buildDays(range: number, offset = 0): { key: string; label: string }[] {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = range - 1 + offset; i >= offset; i -= 1) {
    const d = new Date(today.getTime() - i * DAY_MS);
    out.push({ key: dayKey(d), label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` });
  }
  return out;
}

function inWindow(iso: string, range: number, offset = 0): boolean {
  const t = new Date(iso).getTime();
  const end = Date.now() - offset * DAY_MS;
  return t <= end && t > end - range * DAY_MS;
}

function gateBucket(scan: Scan): GateKey {
  const g = (scan.gate_status || '').toUpperCase();
  if (g === 'PASSED' || g === 'BLOCKED' || g === 'BYPASSED') return g;
  return 'OTHER';
}

function loadRange(): RangeDays {
  const n = Number(localStorage.getItem(RANGE_KEY));
  return (RANGES as number[]).includes(n) ? (n as RangeDays) : 30;
}

const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string; payload?: { fill?: string } }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      {label ? <strong>{label}</strong> : null}
      {payload.map((p) => (
        <div key={`${p.name}-${p.value}`}>
          <i style={{ background: p.color ?? p.payload?.fill }} />
          <span>{p.name ?? 'valor'}</span>
          <b>{p.value}</b>
        </div>
      ))}
    </div>
  );
};

const Delta: React.FC<{ value: number | null; suffix?: string; goodWhenUp?: boolean }> = ({ value, suffix = '%', goodWhenUp = false }) => {
  const { t } = useI18n();
  if (value === null || !Number.isFinite(value)) return <span className="dw-delta dw-delta--flat">{t('dashboard.noPrevPeriod')}</span>;
  if (Math.round(value) === 0) return <span className="dw-delta dw-delta--flat">{t('dashboard.samePrevPeriod')}</span>;
  const up = value > 0;
  const good = up === goodWhenUp;
  return (
    <span className={`dw-delta ${good ? 'dw-delta--good' : 'dw-delta--bad'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(Math.round(value))}
      {suffix} {t('dashboard.vsPrevPeriod')}
    </span>
  );
};

const Widget: React.FC<{
  title: string;
  icon: React.ReactNode;
  span: WidgetSpan;
  chip?: React.ReactNode;
  onOpen?: () => void;
  children: React.ReactNode;
  arranging?: boolean;
  widgetId?: DashboardWidgetId;
  dragOver?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onSpanChange?: (span: WidgetSpan) => void;
}> = ({
  title,
  icon,
  span,
  chip,
  onOpen,
  children,
  arranging,
  widgetId,
  dragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onSpanChange,
}) => {
  const { t } = useI18n();
  return (
    <motion.section
      className={`card dw-widget dw-span-${span}${arranging ? ' is-arranging' : ''}${dragOver ? ' is-drag-over' : ''}`}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.28 }}
      onDragOver={arranging ? onDragOver : undefined}
      onDrop={arranging ? onDrop : undefined}
    >
      <header className="dw-head">
        <div className="card-title">
          {icon}
          <span>{title}</span>
        </div>
        <div className="dw-head-right">
          {arranging && widgetId && (
            <div className="dw-arrange">
              <button
                type="button"
                className="dw-drag-handle"
                draggable
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                title={t('dashboard.move')}
                aria-label={title}
              >
                <GripVertical size={14} />
              </button>
              {widgetId !== 'kpis' && (
                <select
                  className="dw-span-select"
                  value={span}
                  onChange={(e) => onSpanChange?.(Number(e.target.value) as WidgetSpan)}
                  aria-label={title}
                >
                  {WIDGET_SPAN_OPTIONS.map((opt) => (
                    <option key={opt.span} value={opt.span}>
                      {opt.span === 12 ? t('dashboard.settingsSpanWide') : opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {!arranging && chip}
          {!arranging && onOpen && (
            <button type="button" className="dw-link" onClick={onOpen}>
              {t('dashboard.viewFindings')}
            </button>
          )}
        </div>
      </header>
      <div className="dw-body">{children}</div>
    </motion.section>
  );
};

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="dash-panel-empty">{text}</p>;

const GetStarted: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { t } = useI18n();
  const steps = [
    {
      title: t('dashboard.step1Title'),
      text: t('dashboard.step1Text'),
      action: t('dashboard.step1Action'),
      tab: 'repositories',
    },
    {
      title: t('dashboard.step2Title'),
      text: t('dashboard.step2Text'),
      action: t('dashboard.step2Action'),
      tab: 'scans',
    },
    {
      title: t('dashboard.step3Title'),
      text: t('dashboard.step3Text'),
      action: t('dashboard.step3Action'),
      tab: 'gates',
    },
  ];
  return (
    <div className="ws-start">
      <Database size={36} color="#8250df" />
      <h2>{t('dashboard.startTitle')}</h2>
      <p>{t('dashboard.startDesc')}</p>
      <ol className="ws-start-steps">
        {steps.map((s, i) => (
          <li key={s.tab}>
            <span className="ws-start-num">{i + 1}</span>
            <div>
              <strong>{s.title}</strong>
              <p>{s.text}</p>
              <button
                type="button"
                className={i === 0 ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => onNavigate?.(s.tab)}
              >
                {s.action}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

export const DashboardPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
  view = null,
  onOpenList,
  onViewSaved,
}) => {
  const { t } = useI18n();
  const [config, setConfig] = useState<DashboardConfig>(() =>
    view ? mergeDashboardConfig(view.config as Partial<DashboardConfig> | null) : loadDashboardConfig(),
  );
  const [arranging, setArranging] = useState(false);
  const [dragId, setDragId] = useState<DashboardWidgetId | null>(null);
  const [range, setRange] = useState<RangeDays>(() => (view ? view.range_days : loadRange()));
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData>(EMPTY_HEATMAP);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceTagFilter, setServiceTagFilter] = useState<string>('ALL');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'GATE' | 'SCAN' | 'AI'>('ALL');
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [showSingleFileModal, setShowSingleFileModal] = useState(false);
  const [customQueryWidgets, setCustomQueryWidgets] = useState<CustomQueryWidget[]>(() => loadCustomQueryWidgets());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [pillowWidgets, setPillowWidgets] = useState<PlacedPillowWidget[]>(() =>
    view ? (view.pillow_widgets as PlacedPillowWidget[]) : loadPlacedWidgets(),
  );

  const scopeKey = view?.repository_ids.join(',') ?? '';
  const load = useCallback(async () => {
    const scope = scopeKey ? scopeKey.split(',') : undefined;
    const inScope = (repoId: string) => !scope || scope.includes(repoId);
    setRefreshing(true);
    const [s, h, a, f, sc, rp] = await Promise.allSettled([
      fetchStats(scope),
      fetchHeatmap(scope),
      fetchAuditLog(scope),
      fetchFindings(),
      fetchScans(),
      fetchRepositories(),
    ]);
    setStats(s.status === 'fulfilled' && s.value ? s.value : EMPTY_STATS);
    setHeatmap(h.status === 'fulfilled' && h.value?.cells?.length ? h.value : EMPTY_HEATMAP);
    setEvents(a.status === 'fulfilled' ? a.value ?? [] : []);
    setFindings(f.status === 'fulfilled' ? (f.value ?? []).filter((x) => inScope(x.repository_id)) : []);
    setScans(sc.status === 'fulfilled' ? (sc.value ?? []).filter((x) => inScope(x.repository_id)) : []);
    setRepositories(rp.status === 'fulfilled' ? (rp.value ?? []).filter((x) => inScope(x.id)) : []);
    const failed = [s, h, a, f, sc].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    setLoadError(failed ? (failed.reason instanceof Error ? failed.reason.message : 'No se pudo cargar parte del dashboard.') : null);
    setUpdatedAt(new Date());
    setRefreshing(false);
  }, [scopeKey]);

  const persistView = useCallback(
    (patch: Parameters<typeof updateDashboardView>[1]) => {
      if (!view) return;
      updateDashboardView(view.id, patch)
        .then((saved) => onViewSaved?.(saved))
        .catch(() => undefined);
    },
    [view, onViewSaved],
  );

  const savePillowWidgets = useCallback(
    (next: PlacedPillowWidget[]) => {
      if (view) persistView({ pillow_widgets: next });
      else savePlacedWidgets(next);
    },
    [view, persistView],
  );

  useEffect(() => {
    setPillowWidgetSink((widget) =>
      setPillowWidgets((prev) => {
        const next = [...prev, widget];
        savePillowWidgets(next);
        return next;
      }),
    );
    return () => setPillowWidgetSink(null);
  }, [savePillowWidgets]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onWidgets = () => setPillowWidgets(loadPlacedWidgets());
    window.addEventListener(PILLOW_WIDGETS_EVENT, onWidgets);
    return () => window.removeEventListener(PILLOW_WIDGETS_EVENT, onWidgets);
  }, []);

  const pillowContext = useMemo(
    () =>
      stats
        ? {
            dashboard: view ? view.name : 'General (toda la organización)',
            repositories_in_scope: view?.repository_names.length ? view.repository_names : 'todos',
            stats,
          }
        : null,
    [stats, view],
  );
  usePillowPageContext('dashboard', pillowContext);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  const changeRange = (r: RangeDays) => {
    setRange(r);
    if (view) persistView({ range_days: r });
    else localStorage.setItem(RANGE_KEY, String(r));
  };

  const changeConfig = (next: DashboardConfig) => {
    const normalized = { ...next, layout: normalizeLayout(next.layout) };
    setConfig(normalized);
    if (view) persistView({ config: normalized as unknown as DashboardView['config'] });
    else {
      saveDashboardConfig(normalized);
      syncDashboardConfigToUrl(normalized);
    }
  };

  const resolvedStats = stats ?? EMPTY_STATS;
  const loading = stats === null;
  const { thresholds, widgets, layout } = config;
  const visibleLayout = layout.filter((item) => widgets[item.id]);
  const now = updatedAt?.getTime() ?? Date.now();
  const goFindings = () => onNavigate?.('findings');

  const active = useMemo(() => findings.filter(isActive), [findings]);

  const dataReady =
    resolvedStats.monitored_repos > 0 || scans.length > 0 || findings.length > 0 || events.length > 0;

  const derived = useMemo(() => {
    const days = buildDays(range);
    const scansIn = scans.filter((s) => inWindow(s.created_at, range));
    const scansPrev = scans.filter((s) => inWindow(s.created_at, range, range));

    const perDay = new Map(days.map((d) => [d.key, { scans: 0, total: 0, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }]));
    for (const s of scansIn) {
      const row = perDay.get(dayKey(new Date(s.created_at)));
      if (!row) continue;
      row.scans += 1;
      row.total += s.total_findings || 0;
      row.CRITICAL += s.critical_count || 0;
      row.HIGH += s.high_count || 0;
      row.MEDIUM += s.medium_count || 0;
      row.LOW += s.low_count || 0;
    }
    const series = days.map((d) => ({ label: d.label, ...perDay.get(d.key)! }));

    const gateCounts: Record<GateKey, number> = { PASSED: 0, BLOCKED: 0, BYPASSED: 0, OTHER: 0 };
    for (const s of scansIn) gateCounts[gateBucket(s)] += 1;
    const gated = gateCounts.PASSED + gateCounts.BLOCKED + gateCounts.BYPASSED;
    const passRate = gated ? ((gateCounts.PASSED + gateCounts.BYPASSED) / gated) * 100 : null;
    const prevGated = scansPrev.filter((s) => gateBucket(s) !== 'OTHER');
    const prevPass = prevGated.length
      ? (prevGated.filter((s) => gateBucket(s) !== 'BLOCKED').length / prevGated.length) * 100
      : null;

    const detected = scansIn.reduce((n, s) => n + (s.total_findings || 0), 0);
    const detectedPrev = scansPrev.reduce((n, s) => n + (s.total_findings || 0), 0);
    const pct = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : null);

    const breached = active.filter((f) => slaState(f, now) === 'breached').length;
    const sevActive = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
    for (const f of active) sevActive[f.severity] += 1;

    return {
      series,
      gateCounts,
      passRate,
      passDelta: passRate !== null && prevPass !== null ? passRate - prevPass : null,
      scansCount: scansIn.length,
      scansDelta: pct(scansIn.length, scansPrev.length),
      detected,
      detectedDelta: pct(detected, detectedPrev),
      breached,
      sevActive,
    };
  }, [scans, range, active, now]);

  const slaData = useMemo(
    () =>
      TREND_SEVERITIES.map((sev) => {
        const row = { name: t(`severity.${sev}`), ok: 0, due: 0, breached: 0 };
        for (const f of active) {
          if (f.severity !== sev) continue;
          const st = slaState(f, now);
          if (st === 'ok') row.ok += 1;
          else if (st === 'due') row.due += 1;
          else if (st === 'breached') row.breached += 1;
        }
        return row;
      }),
    [active, now, t],
  );
  const slaCompliance = active.length
    ? Math.round(((active.length - derived.breached) / active.length) * 100)
    : 100;

  const agingData = useMemo(
    () =>
      AGE_BUCKETS.map((b) => ({
        name: b.label,
        hallazgos: active.filter((f) => {
          const a = ageDays(f, now);
          return a >= b.min && a <= b.max;
        }).length,
        fill: b.color,
      })),
    [active, now],
  );

  const topRepos = useMemo(() => {
    const map = new Map<string, Record<Severity, number>>();
    for (const f of active) {
      const key = f.repository_name || f.repository_id;
      const row = map.get(key) ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
      row[f.severity] += 1;
      map.set(key, row);
    }
    return [...map.entries()]
      .map(([name, counts]) => ({ name, counts, score: riskScore(counts), total: SEVERITIES.reduce((n, s) => n + counts[s], 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [active]);

  const topComponents = useMemo(
    () =>
      groupFindings(active, now)
        .map((g) => ({ ...g, score: riskScore(g.counts) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 7),
    [active, now],
  );

  const falsePositivesCount = useMemo(
    () => findings.filter((f) => f.status === 'FALSE_POSITIVE').length,
    [findings],
  );

  const funnel = useMemo(() => {
    const total = findings.length || 1;
    return STATUS_FUNNEL.map((s) => {
      const value = findings.filter((f) => f.status === s.key).length;
      return { ...s, label: t(`status.${s.key}`), value, pct: Math.round((value / total) * 100) };
    });
  }, [findings, t]);
  const triaged = findings.length ? Math.round((findings.filter((f) => f.status !== 'OPEN').length / findings.length) * 100) : 0;

  const engineMatrix = useMemo(() => {
    const rows = ENGINES.map((e) => {
      const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
      for (const f of active) if (f.engine === e.key) counts[f.severity] += 1;
      return { ...e, counts, total: SEVERITIES.reduce((n, s) => n + counts[s], 0) };
    });
    const max = Math.max(1, ...rows.flatMap((r) => SEVERITIES.map((s) => r.counts[s])));
    return { rows, max };
  }, [active]);

  const healthLevel = healthAlert(resolvedStats.overall_health_score, thresholds.health_min);
  const healthColor = ALERT_COLORS[healthLevel];
  const openAlert = metricAlert(active.length, thresholds.open_max);

  const criticalAlert = metricAlert(derived.sevActive.CRITICAL, thresholds.critical_max);
  const slaAlert: MetricAlert = derived.breached ? 'danger' : 'ok';
  const gateAlert: MetricAlert =
    derived.passRate === null ? 'warn' : derived.passRate >= 70 ? 'ok' : 'danger';

  const formatBadge = (
    delta: number | null,
    goodWhenUp = false,
    fallbackText = 'Estable',
    fallbackTone: 'good' | 'bad' | 'neutral' = 'neutral',
  ): { text: string; tone: 'good' | 'bad' | 'neutral'; dir: 'up' | 'down' | 'flat' } => {
    if (delta === null || !Number.isFinite(delta) || Math.round(delta) === 0) {
      return { text: fallbackText, tone: fallbackTone, dir: 'flat' };
    }
    const up = delta > 0;
    const good = up === goodWhenUp;
    const sign = up ? '+' : '-';
    return {
      text: `${sign}${Math.abs(Math.round(delta))}%`,
      tone: good ? 'good' : 'bad',
      dir: up ? 'up' : 'down',
    };
  };

  const kpis: {
    id: string;
    label: string;
    value: number | null;
    suffix?: string;
    color: string;
    tone: MetricAlert | 'info';
    spark: number[];
    foot: React.ReactNode;
    hint: string;
    badge: { text: string; tone: 'good' | 'bad' | 'neutral'; dir: 'up' | 'down' | 'flat' };
    targetTab: string;
  }[] = [
    {
      id: 'active',
      label: t('dashboard.kpiActive'),
      value: active.length,
      color: ALERT_COLORS[openAlert],
      tone: openAlert,
      spark: derived.series.map((d) => d.total),
      foot: <Delta value={derived.detectedDelta} />,
      hint:
        falsePositivesCount > 0
          ? `${t('dashboard.kpiDetectedInDays', { count: derived.detected, days: range })} · ${t('dashboard.kpiFalsePositives', { count: falsePositivesCount })}`
          : t('dashboard.kpiDetectedInDays', { count: derived.detected, days: range }),
      badge: formatBadge(
        derived.detectedDelta,
        false,
        active.length === 0 ? '0 abiertos' : `${derived.detected} en ${range}d`,
        active.length <= thresholds.open_max ? 'good' : 'bad',
      ),
      targetTab: 'findings',
    },
    {
      id: 'critical',
      label: t('dashboard.kpiCritical'),
      value: derived.sevActive.CRITICAL,
      color: ALERT_COLORS[criticalAlert],
      tone: criticalAlert,
      spark: derived.series.map((d) => d.CRITICAL),
      foot: <span className="dw-delta dw-delta--flat">{t('dashboard.kpiThresholdLe', { max: thresholds.critical_max })}</span>,
      hint: t('dashboard.kpiHighsMediums', { high: derived.sevActive.HIGH, medium: derived.sevActive.MEDIUM }),
      badge: {
        text: derived.sevActive.CRITICAL > thresholds.critical_max ? `>${thresholds.critical_max} umbral` : `≤${thresholds.critical_max} OK`,
        tone: derived.sevActive.CRITICAL > thresholds.critical_max ? 'bad' : 'good',
        dir: derived.sevActive.CRITICAL > thresholds.critical_max ? 'up' : 'down',
      },
      targetTab: 'findings',
    },
    {
      id: 'sla',
      label: t('dashboard.kpiSla'),
      value: derived.breached,
      color: ALERT_COLORS[slaAlert],
      tone: slaAlert,
      spark: [],
      foot: <span className="dw-delta dw-delta--flat">{t('dashboard.kpiSlaCompliant', { pct: slaCompliance })}</span>,
      hint: t('dashboard.kpiSlaHint', { crit: SLA_DAYS.CRITICAL, high: SLA_DAYS.HIGH }),
      badge: {
        text: `${slaCompliance}% SLA`,
        tone: slaCompliance >= 85 ? 'good' : 'bad',
        dir: slaCompliance >= 85 ? 'up' : 'down',
      },
      targetTab: 'findings',
    },
    {
      id: 'gate',
      label: t('dashboard.kpiGate'),
      value: derived.passRate === null ? null : Math.round(derived.passRate),
      suffix: '%',
      color: derived.passRate === null ? '#8c959f' : ALERT_COLORS[gateAlert],
      tone: gateAlert,
      spark: [],
      foot: <Delta value={derived.passDelta} suffix=" pp" goodWhenUp />,
      hint: t('dashboard.kpiGateBlocks', { count: derived.gateCounts.BLOCKED, days: range }),
      badge: formatBadge(
        derived.passDelta,
        true,
        derived.passRate !== null && derived.passRate >= 80 ? 'Operativo' : 'Revisión',
        derived.passRate !== null && derived.passRate >= 70 ? 'good' : 'bad',
      ),
      targetTab: 'gates',
    },
    {
      id: 'scans',
      label: t('dashboard.kpiScans'),
      value: derived.scansCount,
      color: '#0969da',
      tone: 'info',
      spark: derived.series.map((d) => d.scans),
      foot: <Delta value={derived.scansDelta} goodWhenUp />,
      hint: t('dashboard.kpiMonitoredRepos', { count: resolvedStats.monitored_repos }),
      badge: formatBadge(derived.scansDelta, true, `${resolvedStats.monitored_repos} repos`, 'good'),
      targetTab: 'scans',
    },
  ];

  const peakTrendIndex = useMemo(() => {
    let bestIdx = -1;
    let bestVal = 0;
    derived.series.forEach((d, idx) => {
      if (d.total >= bestVal && d.total > 0) {
        bestVal = d.total;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }, [derived.series]);

  const allRepoTags = useMemo(
    () => Array.from(new Set(repositories.flatMap((r) => (Array.isArray(r.tags) ? r.tags : [])))).sort(),
    [repositories],
  );

  const serviceRows = useMemo(() => {
    const filteredRepos =
      serviceTagFilter === 'ALL'
        ? repositories
        : repositories.filter((r) => (r.tags || []).includes(serviceTagFilter));

    const repoRows = filteredRepos.map((repo) => {
      const repoFindings = active.filter((f) => f.repository_id === repo.id);
      const crit = repoFindings.filter((f) => f.severity === 'CRITICAL').length;
      const high = repoFindings.filter((f) => f.severity === 'HIGH').length;
      const totalOpen = repoFindings.length;
      const repoScans = scans.filter((s) => s.repository_id === repo.id);
      const lastScan = repoScans[0];
      const status: 'up' | 'degraded' | 'down' =
        crit > 0 || lastScan?.gate_status === 'BLOCKED'
          ? 'down'
          : high > 0
            ? 'degraded'
            : 'up';
      const statusLabel = status === 'up' ? 'Activo' : status === 'degraded' ? 'Degradado' : 'Bloqueado';
      return {
        id: `repo-${repo.id}`,
        status,
        statusLabel,
        service: repo.name,
        tags: repo.tags || [],
        url: repo.url || `branch: ${repo.branch || 'main'}`,
        uptime: `${Math.max(0, Math.min(100, repo.health_score ?? 100))}%`,
        uptimeTone: (repo.health_score ?? 100) >= 80 ? 'good' : (repo.health_score ?? 100) >= 55 ? 'warn' : 'bad',
        response: crit > 0 ? `${crit} crít · ${totalOpen} hallazgos` : `${totalOpen} abiertos · ${repo.branch || 'main'}`,
        responseTone: crit > 0 ? 'bad' : high > 0 ? 'warn' : 'good',
        tab: 'repositories',
      };
    });

    const engineRows =
      serviceTagFilter !== 'ALL'
        ? []
        : ENGINES.map((eng) => {
            const engFindings = active.filter((f) => f.engine === eng.key);
            const crit = engFindings.filter((f) => f.severity === 'CRITICAL').length;
            const high = engFindings.filter((f) => f.severity === 'HIGH').length;
            const status: 'up' | 'degraded' | 'down' = crit > 0 ? 'degraded' : 'up';
            const cleanPct = active.length ? Math.max(65, Math.round((1 - engFindings.length / Math.max(active.length, 10)) * 100)) : 100;
            return {
              id: `eng-${eng.key}`,
              status,
              statusLabel: status === 'up' ? 'Activo' : 'Con alertas',
              service: eng.label,
              tags: [] as string[],
              url: `motor://${eng.key}.sspillowy.local`,
              uptime: `${cleanPct}%`,
              uptimeTone: crit === 0 ? 'good' : 'warn',
              response: `${engFindings.length} activos (${crit} C / ${high} H)`,
              responseTone: crit > 0 ? 'bad' : high > 0 ? 'warn' : 'good',
              tab: 'findings',
            };
          });

    const combined = [...repoRows, ...engineRows];
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return combined;
    return combined.filter(
      (r) =>
        r.service.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        r.statusLabel.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [repositories, active, scans, serviceSearch, serviceTagFilter]);

  const exportDashboardCsv = () => {
    const headers = ['Estado', 'Servicio / Repositorio', 'URL / Endpoint', 'Health / Cumplimiento', 'Detalle / Hallazgos'];
    const lines = [
      headers.join(','),
      ...serviceRows.map((r) =>
        [r.statusLabel, r.service, r.url, r.uptime, r.response]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sspillowy-dashboard-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const gateLabels: Record<GateKey, string> = {
    PASSED: t('dashboard.gatePassed'),
    BLOCKED: t('dashboard.gateBlocked'),
    BYPASSED: t('dashboard.gateBypassed'),
    OTHER: t('dashboard.gateOther'),
  };

  const gatePie = (Object.keys(GATE_META) as GateKey[])
    .map((k) => ({ name: gateLabels[k], value: derived.gateCounts[k], fill: GATE_META[k].color }))
    .filter((d) => d.value > 0);

  const handleRemovePillowWidget = (id: string) => {
    setPillowWidgets((prev) => {
      const next = prev.filter((w) => w.id !== id);
      savePillowWidgets(next);
      return next;
    });
  };

  const handleAddQueryWidget = (w: CustomQueryWidget) => {
    setCustomQueryWidgets((prev) => {
      const next = [w, ...prev];
      saveCustomQueryWidgets(next);
      return next;
    });
  };

  const handleDeleteQueryWidget = (id: string) => {
    setCustomQueryWidgets((prev) => {
      const next = prev.filter((w) => w.id !== id);
      saveCustomQueryWidgets(next);
      return next;
    });
  };

  const filteredAuditEvents = useMemo(() => {
    if (auditFilter === 'ALL') return events;
    return events.filter((ev) => {
      const act = (ev.action || '').toUpperCase();
      if (auditFilter === 'GATE') return act.includes('GATE');
      if (auditFilter === 'SCAN') return act.includes('SCAN') || act.includes('FINDING');
      if (auditFilter === 'AI') return act.includes('BYPASS') || act.includes('AI') || act.includes('PILLOW');
      return true;
    });
  }, [events, auditFilter]);

  const scopeLabel = !view?.repository_names.length
    ? t('dashboard.orgWide')
    : view.repository_names.length <= 2
      ? view.repository_names.join(', ')
      : t('dashboard.reposScope', { count: view.repository_names.length });

  return (
    <div className="dash ss-dash">
      <Header
        title={view ? view.name : t('pages.dashboard.title')}
        subtitle={view ? view.description || t('dashboard.dashboardOf', { scope: scopeLabel.toLowerCase() }) : t('pages.dashboard.subtitle')}
        healthScore={dataReady ? resolvedStats.overall_health_score : undefined}
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      <div className="dw-toolbar ss-toolbar">
        <div className="ss-toolbar-left">
          <DashboardSettings
            config={config}
            onChange={changeConfig}
            persistLocal={!view}
            arranging={arranging}
            onArrangingChange={setArranging}
          />
          <button
            type="button"
            className="dw-tool-btn ss-pill-btn"
            onClick={() => setShowQueryModal(true)}
            title="Crear un widget personalizado a partir de una consulta"
          >
            <Plus size={14} />
            <span>Crear Widget</span>
          </button>
          <button
            type="button"
            className="dw-tool-btn ss-pill-btn"
            onClick={() => setShowSingleFileModal(true)}
            title="Analizar un archivo único o snippet al instante"
          >
            <FileCode2 size={14} />
            <span>Analizar 1 archivo</span>
          </button>
          {onOpenList && (
            <button type="button" className="dw-tool-btn ss-pill-btn" onClick={onOpenList} title={t('dashboard.viewAllDashboards')}>
              <LayoutGrid size={14} />
              <span>{t('dashboard.dashboardsBtn')}</span>
            </button>
          )}
          <span className="dw-scope" title={view?.repository_names.join(', ') || t('dashboard.orgWide')}>
            <FolderGit2 size={13} />
            {scopeLabel}
          </span>
        </div>

        <div className="dw-toolbar-right ss-toolbar-right">
          <button
            type="button"
            className="ss-last-update"
            onClick={load}
            disabled={refreshing}
            title={t('dashboard.refresh')}
          >
            <RefreshCw size={14} className={refreshing ? 'dw-spin' : ''} />
            <span>
              {updatedAt
                ? `Última actualización ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : t('dashboard.refresh')}
            </span>
          </button>

          <label className={`dw-live ${autoRefresh ? 'is-on' : ''}`}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            <span className="dw-live-dot" />
            <span>{t('dashboard.live')}</span>
          </label>

          <div className="ss-range-pill">
            <Calendar size={13} />
            <select
              value={range}
              onChange={(e) => changeRange(Number(e.target.value) as RangeDays)}
              aria-label="Periodo del dashboard"
            >
              {RANGES.map((r) => (
                <option key={r} value={r}>
                  Últimos {r} días
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="ss-export-btn" onClick={exportDashboardCsv}>
            <Download size={14} />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {loading && <PageSkeleton variant="dashboard" />}

      {!loading && loadError && (
        <div className="dash-empty dash-empty--warn">
          <p>{loadError}</p>
        </div>
      )}

      {!loading && !dataReady && <GetStarted onNavigate={onNavigate} />}

      {!loading && dataReady && arranging && (
        <p className="dw-arrange-hint">{t('dashboard.arrangeHint')}</p>
      )}

      {!loading && dataReady && (
        <div className="dw-grid ss-grid">
          {visibleLayout.map((item) => {
            const dragProps = {
              arranging,
              widgetId: item.id,
              dragOver: dragId !== null && dragId !== item.id,
              onDragStart: () => setDragId(item.id),
              onDragEnd: () => setDragId(null),
              onDragOver: (e: React.DragEvent) => e.preventDefault(),
              onDrop: () => {
                if (!dragId) return;
                changeConfig({ ...config, layout: moveLayoutItem(config.layout, dragId, item.id) });
                setDragId(null);
              },
              onSpanChange: (span: WidgetSpan) =>
                changeConfig({ ...config, layout: setLayoutSpan(config.layout, item.id, span) }),
            };

            if (item.id === 'kpis') {
              return (
                <div
                  key="kpis"
                  className={`dw-kpi-band ss-kpi-band${arranging ? ' is-arranging' : ''}`}
                  onDragOver={arranging ? (e) => e.preventDefault() : undefined}
                  onDrop={
                    arranging
                      ? () => {
                          if (!dragId) return;
                          changeConfig({ ...config, layout: moveLayoutItem(config.layout, dragId, 'kpis') });
                          setDragId(null);
                        }
                      : undefined
                  }
                >
                  {arranging && (
                    <div className="dw-arrange" style={{ gridColumn: '1 / -1', marginBottom: '0.25rem' }}>
                      <button
                        type="button"
                        className="dw-drag-handle"
                        draggable
                        onDragStart={() => setDragId('kpis')}
                        onDragEnd={() => setDragId(null)}
                        title="KPIs"
                      >
                        <GripVertical size={14} />
                      </button>
                      <span style={{ fontSize: '0.75rem', color: '#656d76', fontWeight: 600 }}>KPIs</span>
                    </div>
                  )}
                  {kpis.map((k) => (
                    <motion.section
                      key={k.id}
                      className="ss-kpi-frame"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22 }}
                    >
                      <div className="ss-kpi-top">
                        <span className="ss-kpi-title">{k.label}</span>
                        <button
                          type="button"
                          className="ss-kpi-more"
                          onClick={() => onNavigate?.(k.targetTab)}
                          title={k.label}
                          aria-label={k.label}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </div>
                      <div className="ss-kpi-box">
                        <div className="ss-kpi-main">
                          <span className="ss-kpi-number">
                            {k.value === null ? '—' : <AnimatedNumber value={k.value} />}
                            {k.value !== null && k.suffix ? <small>{k.suffix}</small> : null}
                          </span>
                          <span className="ss-kpi-sub" title={k.hint}>
                            {k.hint}
                          </span>
                        </div>
                        <span className={`ss-trend-pill ss-trend-pill--${k.badge.tone}`}>
                          {k.badge.dir === 'up' ? (
                            <ArrowUpRight size={12} />
                          ) : k.badge.dir === 'down' ? (
                            <ArrowDownRight size={12} />
                          ) : null}
                          {k.badge.text}
                        </span>
                      </div>
                    </motion.section>
                  ))}
                </div>
              );
            }

            if (item.id === 'trend') {
              return (
                <Widget
                  key="trend"
                  title={t('dashboard.wTrendTitle', { days: range })}
                  icon={<Activity size={17} color="#2563eb" />}
                  span={item.span}
                  chip={
                    <span className="ss-chart-pill">
                      <Calendar size={12} />
                      <span>Últimos {range} días · {derived.detected} hallazgos</span>
                    </span>
                  }
                  {...dragProps}
                >
                  {derived.series.some((d) => d.total > 0) ? (
                    <div className="dash-chart" style={{ height: 245 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={derived.series} margin={{ top: 14, right: 12, left: -6, bottom: 0 }}>
                          <defs>
                            <linearGradient id="ssTrendBlue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.26} />
                              <stop offset="75%" stopColor="#60a5fa" stopOpacity={0.07} />
                              <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={18} />
                          <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="total"
                            name="Volumen de hallazgos"
                            stroke="#2563eb"
                            fill="url(#ssTrendBlue)"
                            strokeWidth={2.4}
                            dot={(dotProps: { cx?: number; cy?: number; index?: number }) => {
                              if (dotProps.index !== peakTrendIndex || dotProps.cx === undefined || dotProps.cy === undefined) {
                                return <g key={`dot-${dotProps.index}`} />;
                              }
                              return (
                                <g key={`peak-${dotProps.index}`}>
                                  <circle cx={dotProps.cx} cy={dotProps.cy} r={9} fill="rgba(37, 99, 235, 0.14)" />
                                  <circle cx={dotProps.cx} cy={dotProps.cy} r={5.5} fill="#ffffff" stroke="#2563eb" strokeWidth={2.5} />
                                </g>
                              );
                            }}
                            activeDot={{ r: 5.5, fill: '#ffffff', stroke: '#2563eb', strokeWidth: 2.5 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <Empty text={t('dashboard.wTrendEmpty', { days: range })} />
                  )}
                </Widget>
              );
            }

            if (item.id === 'gates') {
              return (
                <React.Fragment key="gates">
                  <Widget
                    title="Actividad de Escaneos y Security Gate"
                    icon={<GitPullRequest size={17} color="#2563eb" />}
                    span={item.span}
                    chip={
                      <span className="ss-chart-pill">
                        <Calendar size={12} />
                        <span>
                          Últimos {range} días · {derived.passRate === null ? 'Sin gate' : `${Math.round(derived.passRate)}% aprobado`}
                        </span>
                      </span>
                    }
                    {...dragProps}
                  >
                    {derived.series.some((d) => d.total > 0 || d.scans > 0) || gatePie.length ? (
                      <div className="ss-response-wrap">
                        <div className="dash-chart" style={{ height: 205 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={derived.series} barGap={5} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                              <defs>
                                <linearGradient id="ssBarBlue" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                                  <stop offset="100%" stopColor="#bfdbfe" stopOpacity={0.35} />
                                </linearGradient>
                                <linearGradient id="ssBarGray" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.85} />
                                  <stop offset="100%" stopColor="#f1f5f9" stopOpacity={0.35} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
                              <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
                              <Bar dataKey="total" name="Hallazgos detectados" fill="url(#ssBarBlue)" radius={[6, 6, 3, 3]} maxBarSize={22} />
                              <Bar dataKey="scans" name="Escaneos ejecutados" fill="url(#ssBarGray)" radius={[6, 6, 3, 3]} maxBarSize={18} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="ss-gate-strip">
                          {gatePie.map((d) => (
                            <span key={d.name} className="ss-gate-pill">
                              <i style={{ background: d.fill }} />
                              <span>{d.name}:</span>
                              <b>{d.value}</b>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Empty text={t('dashboard.wGateEmpty')} />
                    )}
                  </Widget>

                  <section className="card dw-widget dw-span-12 ss-service-card">
                    <header className="ss-service-head">
                      <div className="ss-service-title">
                        <h3>Estado de Repositorios y Servicios</h3>
                        <span title="Estado en tiempo real de tus repositorios monitoreados y motores DevSecOps">
                          <Info size={14} />
                        </span>
                        {allRepoTags.length > 0 && (
                          <div className="ss-tag-filter-strip">
                            <button
                              type="button"
                              className={`ss-tag-chip ${serviceTagFilter === 'ALL' ? 'is-active' : ''}`}
                              onClick={() => setServiceTagFilter('ALL')}
                            >
                              Todos
                            </button>
                            {allRepoTags.map((tg) => (
                              <button
                                key={tg}
                                type="button"
                                className={`ss-tag-chip ${serviceTagFilter === tg ? 'is-active' : ''}`}
                                onClick={() => setServiceTagFilter(serviceTagFilter === tg ? 'ALL' : tg)}
                              >
                                #{tg}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="ss-service-actions">
                        <label className="ss-service-search">
                          <Search size={14} />
                          <input
                            type="search"
                            placeholder="Buscar repositorio, tag o motor..."
                            value={serviceSearch}
                            onChange={(e) => setServiceSearch(e.target.value)}
                          />
                        </label>
                        <button type="button" className="ss-download-btn" onClick={exportDashboardCsv}>
                          <FileSpreadsheet size={14} />
                          <span>Descargar datos</span>
                        </button>
                      </div>
                    </header>

                    <div className="ss-service-table-wrap">
                      <table className="ss-service-table">
                        <thead>
                          <tr>
                            <th>Estado</th>
                            <th>Servicio / Repositorio</th>
                            <th>URL / Rama</th>
                            <th>Health / Cumplimiento</th>
                            <th>Respuesta / Hallazgos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {serviceRows.map((row) => (
                            <tr key={row.id} onClick={() => onNavigate?.(row.tab)} style={{ cursor: 'pointer' }}>
                              <td>
                                <span className={`ss-status-dot ss-status-dot--${row.status}`}>
                                  <i />
                                  {row.statusLabel}
                                </span>
                              </td>
                              <td className="ss-service-name">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span>{row.service}</span>
                                  {row.tags.map((tg) => (
                                    <span key={tg} className="ss-repo-tag-badge">
                                      #{tg}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="ss-service-url">{row.url}</td>
                              <td>
                                <span className={`ss-metric-text ss-metric-text--${row.uptimeTone}`}>{row.uptime}</span>
                              </td>
                              <td>
                                <span className={`ss-metric-text ss-metric-text--${row.responseTone}`}>{row.response}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </React.Fragment>
              );
            }

            if (item.id === 'sla') {
              return (
                <Widget
                  key="sla"
                  title={t('dashboard.wSlaTitle')}
                  icon={<Timer size={18} color="#bf8700" />}
                  span={item.span}
                  chip={<span className={`dash-chip dash-chip--${slaCompliance >= 90 ? 'ok' : slaCompliance >= 70 ? 'warn' : 'danger'}`}>{t('dashboard.wSlaChip', { pct: slaCompliance })}</span>}
                  onOpen={goFindings}
                  {...dragProps}
                >
                  {active.length ? (
                    <>
                      <div className="dash-chart" style={{ height: 190 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={slaData} layout="vertical" barSize={16} margin={{ left: 4, right: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eaeef2" horizontal={false} />
                            <XAxis type="number" allowDecimals={false} tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fill: '#656d76', fontSize: 12 }} axisLine={false} tickLine={false} width={66} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(9,105,218,0.05)' }} />
                            <Bar dataKey="ok" name={t('sla.ok')} stackId="s" fill="#2da44e" />
                            <Bar dataKey="due" name={t('sla.due')} stackId="s" fill="#eab308" />
                            <Bar dataKey="breached" name={t('sla.breached')} stackId="s" fill="#e5484d" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="dw-foot">
                        {t('dashboard.wSlaFoot', {
                          crit: SLA_DAYS.CRITICAL,
                          high: SLA_DAYS.HIGH,
                          med: SLA_DAYS.MEDIUM,
                          low: SLA_DAYS.LOW,
                        })}
                      </p>
                    </>
                  ) : (
                    <Empty text={t('dashboard.wSlaEmpty')} />
                  )}
                </Widget>
              );
            }

            if (item.id === 'aging') {
              return (
                <Widget key="aging" title={t('dashboard.wAgingTitle')} icon={<Hourglass size={18} color="#bc4c00" />} span={item.span} {...dragProps}>
                  {active.length ? (
                    <div className="dash-chart" style={{ height: 210 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={agingData} barSize={26}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eaeef2" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(9,105,218,0.05)' }} />
                          <Bar dataKey="hallazgos" name={t('dashboard.wAgingBar')} radius={[5, 5, 0, 0]}>
                            {agingData.map((d) => (
                              <Cell key={d.name} fill={d.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <Empty text={t('dashboard.wAgingEmpty')} />
                  )}
                </Widget>
              );
            }

            if (item.id === 'health') {
              return (
                <Widget
                  key="health"
                  title={t('dashboard.wHealthTitle')}
                  icon={<ShieldCheck size={18} color={healthColor} />}
                  span={item.span}
                  chip={<span className={`dash-chip dash-chip--${healthLevel}`}>{t('dashboard.wHealthChip', { min: thresholds.health_min })}</span>}
                  {...dragProps}
                >
                  <div className="dash-health">
                    <div className="dash-chart" style={{ height: 150, width: 150 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                          innerRadius="72%"
                          outerRadius="100%"
                          data={[{ name: 'health', value: resolvedStats.overall_health_score }]}
                          startAngle={90}
                          endAngle={-270}
                        >
                          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                          <RadialBar dataKey="value" background={{ fill: '#eaeef2' }} cornerRadius={8}>
                            <Cell fill={healthColor} />
                          </RadialBar>
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <div className="dash-health-center">
                        <AnimatedNumber value={resolvedStats.overall_health_score} className="dash-health-score" />
                        <span>/100</span>
                      </div>
                    </div>
                    <div className="dash-severity">
                      {TREND_SEVERITIES.map((s) => (
                        <div key={s} className="dash-severity-row">
                          <span style={{ background: PASTEL_SEVERITY[s] }} />
                          <em>{t(`severity.${s}`)}</em>
                          <b>{derived.sevActive[s]}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </Widget>
              );
            }

            if (item.id === 'topRepos') {
              return (
                <Widget key="topRepos" title={t('dashboard.wTopReposTitle')} icon={<Trophy size={18} color="#cf222e" />} span={item.span} onOpen={goFindings} {...dragProps}>
                  {topRepos.length ? (
                    <ol className="dw-toplist">
                      {topRepos.map((r) => (
                        <li key={r.name}>
                          <div className="dw-toplist-top">
                            <span className="dw-toplist-name">{r.name}</span>
                            <span className="dw-toplist-meta">
                              {r.counts.CRITICAL ? <em style={{ color: PASTEL_SEVERITY.CRITICAL }}>{r.counts.CRITICAL} C</em> : null}
                              {r.counts.HIGH ? <em style={{ color: PASTEL_SEVERITY.HIGH }}>{r.counts.HIGH} H</em> : null}
                              <b>{r.score}</b>
                            </span>
                          </div>
                          <div className="dw-toplist-bar">
                            <span style={{ width: `${(r.score / topRepos[0].score) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Empty text={t('dashboard.wTopReposEmpty')} />
                  )}
                  <p className="dw-foot">{t('dashboard.wTopReposFoot')}</p>
                </Widget>
              );
            }

            if (item.id === 'topComponents') {
              return (
                <Widget key="topComponents" title={t('dashboard.wTopCompTitle')} icon={<Package size={18} color="#9a6700" />} span={item.span} onOpen={goFindings} {...dragProps}>
                  {topComponents.length ? (
                    <ol className="dw-toplist">
                      {topComponents.map((c) => (
                        <li key={c.key}>
                          <div className="dw-toplist-top">
                            <span className="dw-toplist-name" title={c.sublabel}>
                              {c.label}
                            </span>
                            <span className="dw-toplist-meta">
                              <em className="dw-engine">{c.engine}</em>
                              <b>{c.findings.length}</b>
                            </span>
                          </div>
                          <div className="dw-toplist-sub">
                            {c.fixVersion ? t('dashboard.wTopCompUpdate', { ver: c.fixVersion }) : c.repositoryName}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Empty text={t('dashboard.wTopCompEmpty')} />
                  )}
                </Widget>
              );
            }

            if (item.id === 'triage') {
              return (
                <Widget
                  key="triage"
                  title={t('dashboard.wTriageTitle')}
                  icon={<FunnelIcon size={18} color="#0969da" />}
                  span={item.span}
                  chip={<span className="dash-chip">{t('dashboard.wTriageChip', { pct: triaged })}</span>}
                  onOpen={goFindings}
                  {...dragProps}
                >
                  {findings.length ? (
                    <div className="dw-funnel">
                      {funnel.map((s) => (
                        <div key={s.key} className="dw-funnel-row">
                          <span className="dw-funnel-label">{s.label}</span>
                          <div className="dw-funnel-bar">
                            <span style={{ width: `${Math.max(s.pct, s.value ? 3 : 0)}%`, background: s.color }} />
                          </div>
                          <b>{s.value}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty text={t('dashboard.wTriageEmpty')} />
                  )}
                </Widget>
              );
            }

            if (item.id === 'engines') {
              return (
                <Widget
                  key="engines"
                  title={t('dashboard.wEnginesTitle')}
                  icon={<Layers size={17} color="#2563eb" />}
                  span={item.span}
                  chip={
                    <span className="ss-chart-pill">
                      <span>{active.length} activos</span>
                    </span>
                  }
                  onOpen={goFindings}
                  {...dragProps}
                >
                  <div className="ss-service-table-wrap">
                    <table className="ss-service-table ss-engine-matrix-table">
                      <thead>
                        <tr>
                          <th>{t('dashboard.wEnginesCol')}</th>
                          {TREND_SEVERITIES.map((s) => (
                            <th key={s} style={{ textAlign: 'center' }}>
                              {t(`severity.${s}`)}
                            </th>
                          ))}
                          <th style={{ textAlign: 'right' }}>{t('dashboard.wEnginesTotal')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {engineMatrix.rows.map((r) => (
                          <tr key={r.key} onClick={goFindings} style={{ cursor: 'pointer' }}>
                            <td className="ss-service-name">
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <ScanLine size={14} color="#2563eb" />
                                {r.label}
                              </span>
                            </td>
                            {TREND_SEVERITIES.map((s) => {
                              const v = r.counts[s];
                              return (
                                <td key={s} style={{ textAlign: 'center' }}>
                                  <span
                                    className={`ss-matrix-badge ${v > 0 ? `ss-matrix-badge--${s.toLowerCase()}` : 'ss-matrix-badge--zero'}`}
                                  >
                                    {v || '0'}
                                  </span>
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>{r.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Widget>
              );
            }

            if (item.id === 'heatmap') {
              const activeDaysCount = heatmap.cells.filter((c) => c.count > 0).length;
              return (
                <Widget
                  key="heatmap"
                  title={t('dashboard.wHeatmapTitle')}
                  icon={<Flame size={17} color="#ef4444" />}
                  span={item.span}
                  chip={
                    <span className="ss-chart-pill">
                      <Calendar size={12} />
                      <span>{t('dashboard.wHeatmapChip', { count: heatmap.total_findings_period })}</span>
                    </span>
                  }
                  {...dragProps}
                >
                  {heatmap.cells.length > 0 && heatmap.total_findings_period > 0 ? (
                    <div className="ss-heatmap-split">
                      <div className="ss-heatmap-cal">
                        <HeatmapCalendar data={heatmap} />
                      </div>
                      <div className="ss-heatmap-stats">
                        <div className="ss-heatmap-stat-box">
                          <span>Total periodo (12 sem.)</span>
                          <strong>{heatmap.total_findings_period}</strong>
                        </div>
                        <div className="ss-heatmap-stat-box">
                          <span>Pico diario máximo</span>
                          <strong>{heatmap.max_count} hallazgos</strong>
                        </div>
                        <div className="ss-heatmap-stat-box">
                          <span>Días con detecciones</span>
                          <strong>{activeDaysCount} días</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Empty text={t('dashboard.wHeatmapEmpty')} />
                  )}
                </Widget>
              );
            }

            if (item.id === 'audit') {
              return (
                <Widget
                  key="audit"
                  title={t('dashboard.wAuditTitle')}
                  icon={<Terminal size={17} color="#2563eb" />}
                  span={item.span}
                  chip={
                    <div className="ss-audit-tabs">
                      {(
                        [
                          { id: 'ALL' as const, label: 'Todos' },
                          { id: 'GATE' as const, label: 'Security Gate' },
                          { id: 'SCAN' as const, label: 'Escaneos' },
                          { id: 'AI' as const, label: 'IA / Bypass' },
                        ]
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          className={`ss-audit-tab ${auditFilter === tab.id ? 'is-active' : ''}`}
                          onClick={() => setAuditFilter(tab.id)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  }
                  {...dragProps}
                >
                  {filteredAuditEvents.length ? (
                    <div className="ss-service-table-wrap">
                      <table className="ss-service-table ss-audit-table">
                        <thead>
                          <tr>
                            <th>Evento</th>
                            <th>Repositorio / Destino</th>
                            <th>Detalle técnico</th>
                            <th>Hora</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAuditEvents.slice(0, 8).map((event) => {
                            const color = actionColor(event.action);
                            return (
                              <tr key={event.id}>
                                <td>
                                  <span className="ss-audit-action-pill" style={{ color, borderColor: `${color}33`, background: `${color}10` }}>
                                    <i style={{ background: color }} />
                                    {event.action}
                                  </span>
                                </td>
                                <td className="ss-service-name">{event.target}</td>
                                <td className="ss-service-url">{event.detail}</td>
                                <td className="ss-audit-time">
                                  {event.created_at
                                    ? new Date(event.created_at).toLocaleString('es-CL', {
                                        day: '2-digit',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : 'Reciente'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty text={t('dashboard.wAuditEmpty')} />
                  )}
                </Widget>
              );
            }

            return null;
          })}

          {customQueryWidgets.map((qw) => (
            <CustomQueryWidgetCard
              key={qw.id}
              widget={qw}
              findings={findings}
              scans={scans}
              repositories={repositories}
              onDelete={handleDeleteQueryWidget}
            />
          ))}
        </div>
      )}

      {!loading && dataReady && derived.sevActive.CRITICAL > thresholds.critical_max && (
        <div className="dw-alert ss-crit-banner">
          <div className="ss-crit-banner-left">
            <span className="ss-crit-icon">
              <AlertOctagon size={16} />
            </span>
            <div>
              <strong>Alerta de umbral crítico superado</strong>
              <span>
                {t('dashboard.critAlert', { count: derived.sevActive.CRITICAL, max: thresholds.critical_max })}
              </span>
            </div>
          </div>
          <button type="button" className="ss-export-btn" onClick={goFindings}>
            <span>{t('dashboard.goToMatrix')} →</span>
          </button>
        </div>
      )}

      <PillowWidgetBoard widgets={pillowWidgets} stats={stats} onRemove={handleRemovePillowWidget} />

      <PillowyAgentRoadmapCard onNavigate={onNavigate} />

      <QueryWidgetBuilderModal
        open={showQueryModal}
        onClose={() => setShowQueryModal(false)}
        onSave={handleAddQueryWidget}
        availableTags={allRepoTags}
        findings={findings}
        scans={scans}
        repositories={repositories}
      />

      {showSingleFileModal && (
        <SingleFileScanModal
          repositories={repositories}
          onClose={() => setShowSingleFileModal(false)}
          onCompleted={load}
        />
      )}
    </div>
  );
};
