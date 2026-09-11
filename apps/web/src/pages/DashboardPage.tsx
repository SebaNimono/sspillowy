import React, { useEffect, useMemo, useState } from 'react';
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
import { PillowAgent } from '../components/PillowAgent';
import { PillowWidgetBoard } from '../components/PillowWidgetBoard';
import { useI18n } from '../i18n/I18nProvider';
import { DashboardStats, HeatmapData, AuditEvent, fetchStats, fetchHeatmap, fetchAuditLog } from '../api/client';
import {
  ALERT_COLORS,
  DashboardConfig,
  healthAlert,
  loadDashboardConfig,
  metricAlert,
} from '../config/dashboardConfig';
import { PlacedPillowWidget, loadPlacedWidgets, savePlacedWidgets } from '../config/pillowWidgets';
import {
  KeyRound,
  Cpu,
  ShieldCheck,
  AlertOctagon,
  Terminal,
  Layers,
  Activity,
  Flame,
  Database,
} from 'lucide-react';

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
  trend_7d: [0, 0, 0, 0, 0, 0, 0],
};

const EMPTY_HEATMAP: HeatmapData = {
  cells: [],
  max_count: 0,
  total_findings_period: 0,
  weeks: 12,
};

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const ENGINE_META = [
  { key: 'semgrep', short: 'Semgrep', label: 'Semgrep · SAST', color: '#0969da' },
  { key: 'trivy', short: 'Trivy', label: 'Trivy · SCA/IaC', color: '#9a6700' },
  { key: 'gitleaks', short: 'GitLeaks', label: 'GitLeaks · Secretos', color: '#cf222e' },
  { key: 'owasp_zap', short: 'ZAP', label: 'OWASP ZAP · DAST', color: '#8250df' },
] as const;

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const actionColor = (action: string) => {
  if (action.includes('SECRET') || action.includes('GATE_BLOCK')) return '#cf222e';
  if (action.includes('AI')) return '#8250df';
  if (action.includes('SCAN')) return '#0969da';
  return '#656d76';
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      <strong>{label}</strong>
      {payload.map((p) => (
        <div key={p.name ?? String(p.value)}>
          <i style={{ background: p.color }} />
          <span>{p.name ?? 'valor'}</span>
          <b>{p.value}</b>
        </div>
      ))}
    </div>
  );
};

function hasDashboardData(stats: DashboardStats, heatmap: HeatmapData, events: AuditEvent[]): boolean {
  return (
    stats.monitored_repos > 0 ||
    stats.total_scans_run > 0 ||
    stats.total_open_findings > 0 ||
    (heatmap.total_findings_period ?? 0) > 0 ||
    events.length > 0
  );
}

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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pillowWidgets, setPillowWidgets] = useState<PlacedPillowWidget[]>(() => loadPlacedWidgets());

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);

    Promise.all([fetchStats(), fetchHeatmap(), fetchAuditLog()])
      .then(([statsData, heatmapData, auditData]) => {
        if (cancelled) return;
        setStats(statsData ?? EMPTY_STATS);
        setHeatmap(heatmapData?.cells?.length ? heatmapData : EMPTY_HEATMAP);
        setEvents(auditData ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setStats(EMPTY_STATS);
        setHeatmap(EMPTY_HEATMAP);
        setEvents([]);
        setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedStats = stats ?? EMPTY_STATS;
  const resolvedHeatmap = heatmap ?? EMPTY_HEATMAP;
  const resolvedEvents = events ?? [];
  const loading = stats === null;
  const dataReady = hasDashboardData(resolvedStats, resolvedHeatmap, resolvedEvents);

  const { thresholds } = config;

  const kpi = useMemo(
    () => [
      {
        id: 'repos',
        label: 'Repositorios monitoreados',
        value: resolvedStats.monitored_repos,
        icon: Cpu,
        hint: 'activos',
        alert: metricAlert(resolvedStats.monitored_repos, 0),
        invert: true,
      },
      {
        id: 'critical',
        label: 'Vulnerabilidades críticas',
        value: resolvedStats.critical_findings,
        icon: AlertOctagon,
        hint: `umbral ≤ ${thresholds.critical_max}`,
        alert: metricAlert(resolvedStats.critical_findings, thresholds.critical_max),
      },
      {
        id: 'secrets',
        label: 'Secretos mitigados',
        value: resolvedStats.secrets_leaked_prevented,
        icon: KeyRound,
        hint: 'resueltos',
        alert: 'ok' as const,
      },
      {
        id: 'scans',
        label: 'Escaneos ejecutados',
        value: resolvedStats.total_scans_run,
        icon: ShieldCheck,
        hint: 'histórico',
        alert: 'ok' as const,
      },
    ],
    [resolvedStats, thresholds.critical_max],
  );

  const trend = resolvedStats.trend_7d?.length ? resolvedStats.trend_7d : EMPTY_STATS.trend_7d!;
  const trendData = trend.map((value, i) => ({ day: DAYS[i] ?? `D${i + 1}`, hallazgos: value }));
  const trendHasData = trend.some((v) => v > 0);

  const engineData = ENGINE_META.map((engine) => ({
    name: engine.short,
    full: engine.label,
    hallazgos: resolvedStats.findings_by_engine?.[engine.key] || 0,
    fill: engine.color,
  }));
  const enginesHasData = engineData.some((e) => e.hallazgos > 0);

  const severityData = [
    {
      name: 'Críticas',
      value: resolvedStats.critical_findings,
      fill: ALERT_COLORS[metricAlert(resolvedStats.critical_findings, thresholds.critical_max)],
    },
    {
      name: 'Altas',
      value: resolvedStats.high_findings,
      fill: ALERT_COLORS[metricAlert(resolvedStats.high_findings, thresholds.high_max)],
    },
    { name: 'Medias', value: resolvedStats.medium_findings, fill: '#0969da' },
    { name: 'Bajas', value: resolvedStats.low_findings, fill: '#6e7781' },
  ];

  const healthAlertLevel = healthAlert(resolvedStats.overall_health_score, thresholds.health_min);
  const healthColor = ALERT_COLORS[healthAlertLevel];
  const healthData = [{ name: 'health', value: resolvedStats.overall_health_score, fill: healthColor }];

  const openAlert = metricAlert(resolvedStats.total_open_findings, thresholds.open_max);

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

      <div className="dash-toolbar">
        <DashboardSettings config={config} onChange={setConfig} />
        {!loading && dataReady && (
          <span className={`dash-status-pill dash-status-pill--${openAlert}`}>
            {resolvedStats.total_open_findings} hallazgos abiertos
          </span>
        )}
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
            El dashboard solo muestra información cuando hay repositorios, escaneos o hallazgos en la base de datos.
            Registra un repo o ejecuta un escaneo para ver métricas aquí.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('repositories')}>
            Ir a repositorios
          </button>
        </div>
      )}

      {!loading && dataReady && config.widgets.kpis && (
        <motion.div className="stats-grid" variants={stagger} initial="hidden" animate="show">
          {kpi.map((item) => {
            const Icon = item.icon;
            const color =
              item.id === 'repos' && item.value === 0
                ? '#656d76'
                : item.alert === 'danger'
                  ? ALERT_COLORS.danger
                  : item.alert === 'warn'
                    ? ALERT_COLORS.warn
                    : item.id === 'critical'
                      ? ALERT_COLORS[metricAlert(item.value, thresholds.critical_max)]
                      : '#0969da';
            return (
              <motion.div
                key={item.id}
                className={`stat-card dash-stat ${item.alert === 'danger' ? 'dash-stat--danger' : ''}`}
                variants={fadeUp}
                whileHover={{ y: -3 }}
              >
                <div>
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-value" style={{ color }}>
                    <AnimatedNumber value={item.value} />
                  </div>
                  <div className="dash-stat-hint">{item.hint}</div>
                </div>
                <div className="stat-icon" style={{ color, borderColor: `${color}33` }}>
                  <Icon size={20} />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {!loading && dataReady && (config.widgets.engines || config.widgets.trend || config.widgets.health) && (
        <div className="split-grid dash-split-3">
          {config.widgets.engines && (
            <motion.div className="card dash-card" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <div className="card-header">
                <div className="card-title">
                  <Layers size={18} color="#0969da" />
                  <span>Hallazgos por motor</span>
                </div>
              </div>
              {enginesHasData ? (
                <div className="dash-chart" style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={engineData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eaeef2" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#656d76', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(9,105,218,0.06)' }} />
                      <Bar dataKey="hallazgos" radius={[6, 6, 0, 0]} animationDuration={900}>
                        {engineData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="dash-panel-empty">No hay hallazgos abiertos por motor.</p>
              )}
            </motion.div>
          )}

          {config.widgets.trend && (
            <motion.div className="card dash-card" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <div className="card-header">
                <div className="card-title">
                  <Activity size={18} color="#8250df" />
                  <span>Tendencia 7 días</span>
                </div>
              </div>
              {trendHasData ? (
                <div className="dash-chart" style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0969da" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#0969da" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eaeef2" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: '#656d76', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#656d76', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="hallazgos"
                        stroke="#0969da"
                        strokeWidth={2.5}
                        fill="url(#trendFill)"
                        animationDuration={1100}
                        activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="dash-panel-empty">Sin actividad de hallazgos en los últimos 7 días.</p>
              )}
            </motion.div>
          )}

          {config.widgets.health && (
            <motion.div className="card dash-card" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <div className="card-header">
                <div className="card-title">
                  <ShieldCheck size={18} color={healthColor} />
                  <span>Health Score</span>
                </div>
                <span className={`dash-chip dash-chip--${healthAlertLevel}`}>mín. {thresholds.health_min}</span>
              </div>
              <div className="dash-health">
                <div className="dash-chart" style={{ height: 160, width: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="72%" outerRadius="100%" data={healthData} startAngle={90} endAngle={-270}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" background={{ fill: '#eaeef2' }} cornerRadius={8} animationDuration={1000}>
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
                  {severityData.map((s) => (
                    <div key={s.name} className="dash-severity-row">
                      <span style={{ background: s.fill }} />
                      <em>{s.name}</em>
                      <b>{s.value}</b>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {!loading && dataReady && config.widgets.heatmap && (
        <div className="split-grid">
          <motion.div className="card dash-card" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <div className="card-header">
              <div className="card-title">
                <Flame size={18} color="#cf222e" />
                <span>Mapa de calor (12 semanas)</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#656d76', fontWeight: 600 }}>
                {resolvedHeatmap.total_findings_period} hallazgos en el periodo
              </span>
            </div>
            {resolvedHeatmap.cells.length > 0 && resolvedHeatmap.total_findings_period > 0 ? (
              <HeatmapCalendar data={resolvedHeatmap} />
            ) : (
              <p className="dash-panel-empty">Sin actividad registrada en las últimas 12 semanas.</p>
            )}
          </motion.div>
        </div>
      )}

      {!loading && dataReady && config.widgets.audit && (
        <motion.div className="card dash-card" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <div className="card-header">
            <div className="card-title">
              <Terminal size={18} color="#0969da" />
              <span>Bitácora de eventos</span>
            </div>
            <span className="dash-chip">últimos {Math.min(resolvedEvents.length, 6)}</span>
          </div>
          {resolvedEvents.length > 0 ? (
            <div className="dash-events">
              {resolvedEvents.slice(0, 6).map((event, i) => {
                const color = actionColor(event.action);
                return (
                  <motion.div
                    key={event.id}
                    className="dash-event"
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -2, borderColor: color }}
                  >
                    <span className="dash-event-dot" style={{ background: color }} />
                    <div className="dash-event-body">
                      <div className="dash-event-top">
                        <strong style={{ color }}>{event.action}</strong>
                        <span>{event.target}</span>
                      </div>
                      <p>{event.detail}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="dash-panel-empty">La bitácora se llenará cuando registres repos, escaneos o cambios HITL.</p>
          )}
        </motion.div>
      )}

      <PillowWidgetBoard widgets={pillowWidgets} stats={stats} onRemove={handleRemovePillowWidget} />

      <PillowAgent
        userEmail={user?.email}
        dashboardContext={stats}
        onAddWidget={handleAddPillowWidget}
      />
    </div>
  );
};
