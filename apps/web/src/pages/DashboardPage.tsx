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
  PieChart,
  Pie,
} from 'recharts';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { HeatmapCalendar } from '../components/HeatmapCalendar';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { DashboardSettings } from '../components/DashboardSettings';
import { PillowAgent } from '../components/PillowAgent';
import { PillowWidgetBoard } from '../components/PillowWidgetBoard';
import { useI18n } from '../i18n/I18nProvider';
import {
  DashboardStats,
  HeatmapData,
  AuditEvent,
  Finding,
  Scan,
  fetchStats,
  fetchHeatmap,
  fetchAuditLog,
  fetchFindings,
  fetchScans,
} from '../api/client';
import { ALERT_COLORS, DashboardConfig, healthAlert, loadDashboardConfig, metricAlert } from '../config/dashboardConfig';
import { PlacedPillowWidget, loadPlacedWidgets, savePlacedWidgets } from '../config/pillowWidgets';
import {
  SEVERITIES,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
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
  Clock,
  Database,
  Flame,
  GitPullRequest,
  Hourglass,
  Layers,
  Package,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Trophy,
  Filter as FunnelIcon,
  Timer,
  ScanLine,
} from 'lucide-react';
import '../styles/dashboards.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
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
  PASSED: { label: 'Aprobado', color: '#1a7f37' },
  BLOCKED: { label: 'Bloqueado', color: '#cf222e' },
  BYPASSED: { label: 'Bypass CISO', color: '#8250df' },
  OTHER: { label: 'Sin gate', color: '#8c959f' },
};

const STATUS_FUNNEL: { key: Finding['status']; label: string; color: string }[] = [
  { key: 'OPEN', label: 'Abiertos', color: '#cf222e' },
  { key: 'IN_REVIEW', label: 'En revisión', color: '#0969da' },
  { key: 'FIXED', label: 'Corregidos', color: '#1a7f37' },
  { key: 'FALSE_POSITIVE', label: 'Falsos positivos', color: '#6e7781' },
  { key: 'ACCEPTED_RISK', label: 'Riesgo aceptado', color: '#9a6700' },
];

const AGE_BUCKETS = [
  { label: '0–7 d', min: 0, max: 7, color: '#1a7f37' },
  { label: '8–30 d', min: 8, max: 30, color: '#bf8700' },
  { label: '31–90 d', min: 31, max: 90, color: '#bc4c00' },
  { label: '+90 d', min: 91, max: Infinity, color: '#cf222e' },
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

const Sparkline: React.FC<{ data: number[]; color: string; id: string }> = ({ data, color, id }) => {
  if (!data.some((v) => v > 0)) return <div className="dw-spark dw-spark--flat" />;
  return (
    <div className="dw-spark">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#spark-${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const Delta: React.FC<{ value: number | null; suffix?: string; goodWhenUp?: boolean }> = ({ value, suffix = '%', goodWhenUp = false }) => {
  if (value === null || !Number.isFinite(value)) return <span className="dw-delta dw-delta--flat">sin periodo previo</span>;
  if (Math.round(value) === 0) return <span className="dw-delta dw-delta--flat">= periodo previo</span>;
  const up = value > 0;
  const good = up === goodWhenUp;
  return (
    <span className={`dw-delta ${good ? 'dw-delta--good' : 'dw-delta--bad'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(Math.round(value))}
      {suffix} vs periodo previo
    </span>
  );
};

const Widget: React.FC<{
  title: string;
  icon: React.ReactNode;
  span: 3 | 4 | 5 | 6 | 7 | 8 | 12;
  chip?: React.ReactNode;
  onOpen?: () => void;
  children: React.ReactNode;
}> = ({ title, icon, span, chip, onOpen, children }) => (
  <motion.section
    className={`card dw-widget dw-span-${span}`}
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.35 }}
  >
    <header className="dw-head">
      <div className="card-title">
        {icon}
        <span>{title}</span>
      </div>
      <div className="dw-head-right">
        {chip}
        {onOpen && (
          <button type="button" className="dw-link" onClick={onOpen}>
            Ver hallazgos →
          </button>
        )}
      </div>
    </header>
    <div className="dw-body">{children}</div>
  </motion.section>
);

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="dash-panel-empty">{text}</p>;

export const DashboardPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
}) => {
  const { t } = useI18n();
  const [config, setConfig] = useState<DashboardConfig>(() => loadDashboardConfig());
  const [range, setRange] = useState<RangeDays>(() => loadRange());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData>(EMPTY_HEATMAP);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [pillowWidgets, setPillowWidgets] = useState<PlacedPillowWidget[]>(() => loadPlacedWidgets());

  const load = useCallback(async () => {
    setRefreshing(true);
    const [s, h, a, f, sc] = await Promise.allSettled([
      fetchStats(),
      fetchHeatmap(),
      fetchAuditLog(),
      fetchFindings(),
      fetchScans(),
    ]);
    setStats(s.status === 'fulfilled' && s.value ? s.value : EMPTY_STATS);
    setHeatmap(h.status === 'fulfilled' && h.value?.cells?.length ? h.value : EMPTY_HEATMAP);
    setEvents(a.status === 'fulfilled' ? a.value ?? [] : []);
    setFindings(f.status === 'fulfilled' ? f.value ?? [] : []);
    setScans(sc.status === 'fulfilled' ? sc.value ?? [] : []);
    const failed = [s, h, a, f, sc].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    setLoadError(failed ? (failed.reason instanceof Error ? failed.reason.message : 'No se pudo cargar parte del dashboard.') : null);
    setUpdatedAt(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  const changeRange = (r: RangeDays) => {
    setRange(r);
    localStorage.setItem(RANGE_KEY, String(r));
  };

  const resolvedStats = stats ?? EMPTY_STATS;
  const loading = stats === null;
  const { thresholds, widgets } = config;
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
        const row = { name: SEVERITY_LABEL[sev], 'En plazo': 0, 'Por vencer': 0, Vencido: 0 };
        for (const f of active) {
          if (f.severity !== sev) continue;
          const st = slaState(f, now);
          if (st === 'ok') row['En plazo'] += 1;
          else if (st === 'due') row['Por vencer'] += 1;
          else if (st === 'breached') row.Vencido += 1;
        }
        return row;
      }),
    [active, now],
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

  const funnel = useMemo(() => {
    const total = findings.length || 1;
    return STATUS_FUNNEL.map((s) => {
      const value = findings.filter((f) => f.status === s.key).length;
      return { ...s, value, pct: Math.round((value / total) * 100) };
    });
  }, [findings]);
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

  const kpis = [
    {
      id: 'active',
      label: 'Hallazgos activos',
      value: active.length,
      color: ALERT_COLORS[openAlert],
      spark: derived.series.map((d) => d.total),
      foot: <Delta value={derived.detectedDelta} />,
      hint: `${derived.detected} detectados en ${range} días`,
    },
    {
      id: 'critical',
      label: 'Críticos activos',
      value: derived.sevActive.CRITICAL,
      color: ALERT_COLORS[metricAlert(derived.sevActive.CRITICAL, thresholds.critical_max)],
      spark: derived.series.map((d) => d.CRITICAL),
      foot: <span className="dw-delta dw-delta--flat">umbral ≤ {thresholds.critical_max}</span>,
      hint: `${derived.sevActive.HIGH} altos · ${derived.sevActive.MEDIUM} medios`,
    },
    {
      id: 'sla',
      label: 'Fuera de plazo',
      value: derived.breached,
      color: derived.breached ? ALERT_COLORS.danger : ALERT_COLORS.ok,
      spark: [],
      foot: <span className="dw-delta dw-delta--flat">{slaCompliance}% cumple SLA</span>,
      hint: `plazo crítico ${SLA_DAYS.CRITICAL} d · alto ${SLA_DAYS.HIGH} d`,
    },
    {
      id: 'gate',
      label: 'Gate aprobado',
      value: derived.passRate === null ? null : Math.round(derived.passRate),
      suffix: '%',
      color: derived.passRate === null ? '#8c959f' : derived.passRate >= 70 ? ALERT_COLORS.ok : ALERT_COLORS.danger,
      spark: [],
      foot: <Delta value={derived.passDelta} suffix=" pp" goodWhenUp />,
      hint: `${derived.gateCounts.BLOCKED} bloqueos en ${range} días`,
    },
    {
      id: 'scans',
      label: 'Escaneos',
      value: derived.scansCount,
      color: '#0969da',
      spark: derived.series.map((d) => d.scans),
      foot: <Delta value={derived.scansDelta} goodWhenUp />,
      hint: `${resolvedStats.monitored_repos} repos monitoreados`,
    },
  ];

  const gatePie = (Object.keys(GATE_META) as GateKey[])
    .map((k) => ({ name: GATE_META[k].label, value: derived.gateCounts[k], fill: GATE_META[k].color }))
    .filter((d) => d.value > 0);

  const handleAddPillowWidget = (widget: PlacedPillowWidget) => {
    setPillowWidgets((prev) => {
      const next = [...prev, widget];
      savePlacedWidgets(next);
      return next;
    });
  };

  const handleRemovePillowWidget = (id: string) => {
    setPillowWidgets((prev) => {
      const next = prev.filter((w) => w.id !== id);
      savePlacedWidgets(next);
      return next;
    });
  };

  return (
    <div className="dash">
      <Header
        title={t('pages.dashboard.title')}
        subtitle={t('pages.dashboard.subtitle')}
        healthScore={dataReady ? resolvedStats.overall_health_score : undefined}
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      <div className="dw-toolbar">
        <div className="dw-range" role="group" aria-label="Rango de tiempo">
          {RANGES.map((r) => (
            <button key={r} type="button" className={range === r ? 'is-active' : ''} onClick={() => changeRange(r)}>
              {r} días
            </button>
          ))}
        </div>
        <button type="button" className="dw-tool-btn" onClick={load} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'dw-spin' : ''} />
          <span>Actualizar</span>
        </button>
        <label className={`dw-live ${autoRefresh ? 'is-on' : ''}`}>
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          <span className="dw-live-dot" />
          <span>En vivo (60 s)</span>
        </label>
        {updatedAt && (
          <span className="dw-updated">
            <Clock size={12} /> {updatedAt.toLocaleTimeString()}
          </span>
        )}
        <div className="dw-toolbar-right">
          {!loading && dataReady && (
            <span className={`dash-status-pill dash-status-pill--${openAlert}`}>{active.length} hallazgos activos</span>
          )}
          <DashboardSettings config={config} onChange={setConfig} />
        </div>
      </div>

      {loading && (
        <div className="dash-empty">
          <p>Cargando métricas…</p>
        </div>
      )}

      {!loading && loadError && (
        <div className="dash-empty dash-empty--warn">
          <p>{loadError}</p>
        </div>
      )}

      {!loading && !dataReady && (
        <div className="dash-empty">
          <Database size={40} color="#656d76" />
          <h2>Sin datos todavía</h2>
          <p>
            Los dashboards se llenan con repositorios, escaneos y hallazgos reales. Registra un repo o ejecuta un escaneo
            para ver métricas aquí.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('repositories')}>
            Ir a repositorios
          </button>
        </div>
      )}

      {!loading && dataReady && (
        <div className="dw-grid">
          {widgets.kpis &&
            kpis.map((k) => (
              <motion.section
                key={k.id}
                className="card dw-kpi"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="dw-kpi-label">{k.label}</span>
                <div className="dw-kpi-row">
                  <span className="dw-kpi-value" style={{ color: k.color }}>
                    {k.value === null ? '—' : <AnimatedNumber value={k.value} />}
                    {k.value !== null && k.suffix ? <small>{k.suffix}</small> : null}
                  </span>
                  <Sparkline data={k.spark} color={k.color} id={k.id} />
                </div>
                {k.foot}
                <span className="dw-kpi-hint">{k.hint}</span>
              </motion.section>
            ))}

          {widgets.trend && (
            <Widget
              title={`Detección por severidad · ${range} días`}
              icon={<Activity size={18} color="#8250df" />}
              span={8}
              chip={<span className="dash-chip">{derived.detected} detectados</span>}
            >
              {derived.series.some((d) => d.total > 0) ? (
                <div className="dash-chart" style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={derived.series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eaeef2" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={18} />
                      <YAxis allowDecimals={false} tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip content={<ChartTooltip />} />
                      {TREND_SEVERITIES.map((sev) => (
                        <Area
                          key={sev}
                          type="monotone"
                          dataKey={sev}
                          name={SEVERITY_LABEL[sev]}
                          stackId="sev"
                          stroke={SEVERITY_COLOR[sev]}
                          fill={SEVERITY_COLOR[sev]}
                          fillOpacity={0.25}
                          strokeWidth={1.75}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty text={`Sin escaneos con hallazgos en los últimos ${range} días.`} />
              )}
            </Widget>
          )}

          {widgets.gates && (
            <Widget title="Security Gate" icon={<GitPullRequest size={18} color="#1a7f37" />} span={4} chip={<span className="dash-chip">{range} días</span>}>
              {gatePie.length ? (
                <div className="dw-donut">
                  <div className="dash-chart" style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={gatePie} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none">
                          {gatePie.map((d) => (
                            <Cell key={d.name} fill={d.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="dw-donut-center">
                      <b>{derived.passRate === null ? '—' : `${Math.round(derived.passRate)}%`}</b>
                      <span>aprobado</span>
                    </div>
                  </div>
                  <ul className="dw-legend">
                    {gatePie.map((d) => (
                      <li key={d.name}>
                        <i style={{ background: d.fill }} />
                        <span>{d.name}</span>
                        <b>{d.value}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Empty text="Sin escaneos evaluados por el gate en este rango." />
              )}
            </Widget>
          )}

          {widgets.sla && (
            <Widget
              title="Cumplimiento de plazos (SLA)"
              icon={<Timer size={18} color="#bf8700" />}
              span={5}
              chip={<span className={`dash-chip dash-chip--${slaCompliance >= 90 ? 'ok' : slaCompliance >= 70 ? 'warn' : 'danger'}`}>{slaCompliance}% en plazo</span>}
              onOpen={goFindings}
            >
              {active.length ? (
                <>
                  <div className="dash-chart" style={{ height: 190 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={slaData} layout="vertical" barSize={16} margin={{ left: 4, right: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eaeef2" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: '#656d76', fontSize: 12 }} axisLine={false} tickLine={false} width={60} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(9,105,218,0.05)' }} />
                        <Bar dataKey="En plazo" stackId="s" fill="#1a7f37" />
                        <Bar dataKey="Por vencer" stackId="s" fill="#bf8700" />
                        <Bar dataKey="Vencido" stackId="s" fill="#cf222e" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="dw-foot">
                    Plazos: crítico {SLA_DAYS.CRITICAL} d · alto {SLA_DAYS.HIGH} d · medio {SLA_DAYS.MEDIUM} d · bajo {SLA_DAYS.LOW} d
                  </p>
                </>
              ) : (
                <Empty text="No hay hallazgos activos. Todo en plazo." />
              )}
            </Widget>
          )}

          {widgets.aging && (
            <Widget title="Antigüedad de hallazgos activos" icon={<Hourglass size={18} color="#bc4c00" />} span={3}>
              {active.length ? (
                <div className="dash-chart" style={{ height: 210 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingData} barSize={26}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eaeef2" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(9,105,218,0.05)' }} />
                      <Bar dataKey="hallazgos" radius={[5, 5, 0, 0]}>
                        {agingData.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty text="Sin hallazgos activos." />
              )}
            </Widget>
          )}

          {widgets.health && (
            <Widget
              title="Health Score"
              icon={<ShieldCheck size={18} color={healthColor} />}
              span={4}
              chip={<span className={`dash-chip dash-chip--${healthLevel}`}>mín. {thresholds.health_min}</span>}
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
                      <span style={{ background: SEVERITY_COLOR[s] }} />
                      <em>{SEVERITY_LABEL[s]}</em>
                      <b>{derived.sevActive[s]}</b>
                    </div>
                  ))}
                </div>
              </div>
            </Widget>
          )}

          {widgets.topRepos && (
            <Widget title="Repos con más riesgo" icon={<Trophy size={18} color="#cf222e" />} span={4} onOpen={goFindings}>
              {topRepos.length ? (
                <ol className="dw-toplist">
                  {topRepos.map((r) => (
                    <li key={r.name}>
                      <div className="dw-toplist-top">
                        <span className="dw-toplist-name">{r.name}</span>
                        <span className="dw-toplist-meta">
                          {r.counts.CRITICAL ? <em style={{ color: SEVERITY_COLOR.CRITICAL }}>{r.counts.CRITICAL} C</em> : null}
                          {r.counts.HIGH ? <em style={{ color: SEVERITY_COLOR.HIGH }}>{r.counts.HIGH} A</em> : null}
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
                <Empty text="Ningún repo con hallazgos activos." />
              )}
              <p className="dw-foot">Riesgo = 10×crítico + 5×alto + 2×medio + bajo</p>
            </Widget>
          )}

          {widgets.topComponents && (
            <Widget title="Componentes más vulnerables" icon={<Package size={18} color="#9a6700" />} span={4} onOpen={goFindings}>
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
                        {c.fixVersion ? `→ actualizar a ${c.fixVersion}` : c.repositoryName}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty text="Sin componentes vulnerables activos." />
              )}
            </Widget>
          )}

          {widgets.triage && (
            <Widget
              title="Embudo de triage HITL"
              icon={<FunnelIcon size={18} color="#0969da" />}
              span={4}
              chip={<span className="dash-chip">{triaged}% triado</span>}
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
                <Empty text="Sin hallazgos para triar." />
              )}
            </Widget>
          )}

          {widgets.engines && (
            <Widget title="Motor × severidad (activos)" icon={<Layers size={18} color="#0969da" />} span={12} onOpen={goFindings}>
              <div className="dw-matrix-wrap">
                <table className="dw-matrix">
                  <thead>
                    <tr>
                      <th>Motor</th>
                      {TREND_SEVERITIES.map((s) => (
                        <th key={s}>{SEVERITY_LABEL[s]}</th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engineMatrix.rows.map((r) => (
                      <tr key={r.key}>
                        <td>
                          <ScanLine size={13} /> {r.label}
                        </td>
                        {TREND_SEVERITIES.map((s) => {
                          const v = r.counts[s];
                          const alpha = v ? 0.12 + (v / engineMatrix.max) * 0.6 : 0;
                          return (
                            <td
                              key={s}
                              className="dw-matrix-cell"
                              style={{
                                background: v ? `color-mix(in srgb, ${SEVERITY_COLOR[s]} ${Math.round(alpha * 100)}%, #ffffff)` : undefined,
                                color: alpha > 0.45 ? '#ffffff' : v ? SEVERITY_COLOR[s] : '#afb8c1',
                              }}
                            >
                              {v || '·'}
                            </td>
                          );
                        })}
                        <td className="dw-matrix-total">{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Widget>
          )}

          {widgets.heatmap && (
            <Widget
              title="Mapa de calor (12 semanas)"
              icon={<Flame size={18} color="#cf222e" />}
              span={12}
              chip={<span className="dash-chip">{heatmap.total_findings_period} hallazgos</span>}
            >
              {heatmap.cells.length > 0 && heatmap.total_findings_period > 0 ? (
                <HeatmapCalendar data={heatmap} />
              ) : (
                <Empty text="Sin actividad registrada en las últimas 12 semanas." />
              )}
            </Widget>
          )}

          {widgets.audit && (
            <Widget
              title="Bitácora de eventos"
              icon={<Terminal size={18} color="#0969da" />}
              span={12}
              chip={<span className="dash-chip">últimos {Math.min(events.length, 8)}</span>}
            >
              {events.length ? (
                <div className="dash-events">
                  {events.slice(0, 8).map((event) => {
                    const color = actionColor(event.action);
                    return (
                      <div key={event.id} className="dash-event">
                        <span className="dash-event-dot" style={{ background: color }} />
                        <div className="dash-event-body">
                          <div className="dash-event-top">
                            <strong style={{ color }}>{event.action}</strong>
                            <span>{event.target}</span>
                          </div>
                          <p>{event.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty text="La bitácora se llenará cuando registres repos, escaneos o cambios HITL." />
              )}
            </Widget>
          )}
        </div>
      )}

      {!loading && dataReady && derived.sevActive.CRITICAL > thresholds.critical_max && (
        <div className="dw-alert">
          <AlertOctagon size={16} />
          <span>
            {derived.sevActive.CRITICAL} críticos activos superan el umbral ({thresholds.critical_max}). Revisa la matriz de
            hallazgos.
          </span>
          <button type="button" className="btn btn-secondary fm-btn-sm" onClick={goFindings}>
            Ir a la matriz
          </button>
        </div>
      )}

      <PillowWidgetBoard widgets={pillowWidgets} stats={stats} onRemove={handleRemovePillowWidget} />

      <PillowAgent userEmail={user?.email} dashboardContext={stats} onAddWidget={handleAddPillowWidget} />
    </div>
  );
};
