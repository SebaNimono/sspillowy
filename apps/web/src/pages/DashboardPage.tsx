import React, { useEffect, useState } from 'react';
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
import { DashboardStats, HeatmapData, AuditEvent, fetchStats, fetchHeatmap, fetchAuditLog } from '../api/client';
import { buildFallbackHeatmap, FALLBACK_AUDIT } from '../api/fallbacks';
import {
  KeyRound,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  Terminal,
  Layers,
  Activity,
  Flame,
  Radio,
} from 'lucide-react';

const DEFAULT_STATS: DashboardStats = {
  overall_health_score: 82,
  monitored_repos: 3,
  total_scans_run: 48,
  total_open_findings: 6,
  critical_findings: 3,
  high_findings: 3,
  medium_findings: 1,
  low_findings: 0,
  secrets_leaked_prevented: 14,
  findings_by_engine: {
    semgrep: 2,
    trivy: 1,
    gitleaks: 2,
    owasp_zap: 2,
  },
  trend_7d: [2, 2, 1, 9, 4, 10, 5],
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

const ARCH = [
  { name: 'FastAPI Gateway Core', detail: 'Enrutamiento REST asíncrono · :8000', ok: true, live: false },
  { name: 'PostgreSQL 16 Engine', detail: 'Persistencia de esquemas unificados', ok: true, live: false },
  { name: 'Redis + ARQ Workers', detail: 'Escáneres en paralelo', ok: true, live: true },
  { name: 'LLM Router (HITL)', detail: 'Triaje de alcanzabilidad · no cierra', ok: true, live: true, accent: true },
];

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

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) => {
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

export const DashboardPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
}) => {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [heatmap, setHeatmap] = useState<HeatmapData>(buildFallbackHeatmap());
  const [events, setEvents] = useState<AuditEvent[]>(FALLBACK_AUDIT);
  const [liveTick, setLiveTick] = useState(0);

  useEffect(() => {
    fetchStats()
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => setStats(DEFAULT_STATS));

    fetchHeatmap()
      .then((data) => {
        if (data?.cells?.length) setHeatmap(data);
      })
      .catch(() => setHeatmap(buildFallbackHeatmap()));

    fetchAuditLog()
      .then((data) => {
        if (data?.length) setEvents(data);
      })
      .catch(() => setEvents(FALLBACK_AUDIT));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setLiveTick((n) => n + 1), 2400);
    return () => window.clearInterval(id);
  }, []);

  const trend = stats.trend_7d?.length ? stats.trend_7d : DEFAULT_STATS.trend_7d!;
  const trendData = trend.map((value, i) => ({ day: DAYS[i] ?? `D${i + 1}`, hallazgos: value }));

  const engineData = ENGINE_META.map((engine) => ({
    name: engine.short,
    full: engine.label,
    hallazgos: stats.findings_by_engine?.[engine.key] || 0,
    fill: engine.color,
  }));

  const severityData = [
    { name: 'Críticas', value: stats.critical_findings, fill: '#cf222e' },
    { name: 'Altas', value: stats.high_findings, fill: '#bf8700' },
    { name: 'Medias', value: stats.medium_findings, fill: '#0969da' },
    { name: 'Bajas', value: stats.low_findings, fill: '#6e7781' },
  ];

  const healthData = [{ name: 'health', value: stats.overall_health_score, fill: '#0969da' }];

  const kpi = [
    { label: 'Repositorios monitoreados', value: stats.monitored_repos, color: '#0969da', icon: Cpu, hint: 'activos' },
    { label: 'Vulnerabilidades críticas', value: stats.critical_findings, color: '#cf222e', icon: AlertOctagon, hint: 'abiertas' },
    { label: 'Secretos prevenidos', value: stats.secrets_leaked_prevented, color: '#1a7f37', icon: KeyRound, hint: 'bloqueados' },
    { label: 'Escaneos ejecutados', value: stats.total_scans_run, color: '#8250df', icon: ShieldCheck, hint: 'histórico' },
  ];

  return (
    <div className="dash">
      <Header
        title="Dashboard General DevSecOps"
        subtitle="Centro de comando unificado, triaje agéntico con IA y observabilidad en tiempo real"
        healthScore={stats.overall_health_score}
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      <motion.div className="dash-livebar" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <span className="dash-live-dot" />
        <strong>LIVE</strong>
        <em>orquestación activa</em>
        <span className="dash-live-sep" />
        <span>tick #{liveTick + 1}</span>
        <span className="dash-live-sep" />
        <span>{stats.total_open_findings} hallazgos abiertos</span>
      </motion.div>

      <motion.div className="stats-grid" variants={stagger} initial="hidden" animate="show">
        {kpi.map((item) => {
          const Icon = item.icon;
          return (
            <motion.div key={item.label} className="stat-card dash-stat" variants={fadeUp} whileHover={{ y: -3 }}>
              <div>
                <div className="stat-label">{item.label}</div>
                <div className="stat-value" style={{ color: item.color }}>
                  <AnimatedNumber value={item.value} />
                </div>
                <div className="dash-stat-hint">{item.hint}</div>
              </div>
              <div className="stat-icon" style={{ color: item.color, borderColor: `${item.color}33` }}>
                <Icon size={20} />
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="split-grid dash-split-3">
        <motion.div className="card dash-card" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <div className="card-header">
            <div className="card-title">
              <Layers size={18} color="#0969da" />
              <span>Hallazgos por motor</span>
            </div>
            <span className="dash-chip">interactivo</span>
          </div>
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
        </motion.div>

        <motion.div className="card dash-card" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <div className="card-header">
            <div className="card-title">
              <Activity size={18} color="#8250df" />
              <span>Tendencia 7 días</span>
            </div>
            <span className="dash-chip">área</span>
          </div>
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
        </motion.div>

        <motion.div className="card dash-card" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <div className="card-header">
            <div className="card-title">
              <ShieldCheck size={18} color="#1a7f37" />
              <span>Health Score</span>
            </div>
          </div>
          <div className="dash-health">
            <div className="dash-chart" style={{ height: 160, width: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="72%"
                  outerRadius="100%"
                  data={healthData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" background={{ fill: '#eaeef2' }} cornerRadius={8} animationDuration={1000}>
                    <Cell fill={stats.overall_health_score >= 80 ? '#1a7f37' : stats.overall_health_score >= 60 ? '#bf8700' : '#cf222e'} />
                  </RadialBar>
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="dash-health-center">
                <AnimatedNumber value={stats.overall_health_score} className="dash-health-score" />
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
      </div>

      <div className="split-grid">
        <motion.div className="card dash-card" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <div className="card-header">
            <div className="card-title">
              <Terminal size={18} color="#8250df" />
              <span>Estado de la arquitectura</span>
            </div>
            <span className="dash-chip is-live">
              <Radio size={12} />
              sync
            </span>
          </div>
          <div className="dash-arch">
            {ARCH.map((item, i) => (
              <motion.div
                key={item.name}
                className={`dash-arch-row ${item.accent ? 'is-accent' : ''} ${item.live ? 'is-live' : ''}`}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ x: 3 }}
              >
                <CheckCircle2 color={item.accent ? '#0969da' : '#1a7f37'} size={18} />
                <div>
                  <div className="dash-arch-name">{item.name}</div>
                  <div className="dash-arch-detail">{item.detail}</div>
                </div>
                {item.live && <span className="dash-pulse" aria-hidden="true" />}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div className="card dash-card" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <div className="card-header">
            <div className="card-title">
              <Flame size={18} color="#cf222e" />
              <span>Mapa de calor (12 semanas)</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#656d76', fontWeight: 600 }}>
              Intensidad = volumen
            </span>
          </div>
          <HeatmapCalendar data={heatmap} />
        </motion.div>
      </div>

      <motion.div className="card dash-card" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
        <div className="card-header">
          <div className="card-title">
            <Activity size={18} color="#0969da" />
            <span>Bitácora de eventos</span>
          </div>
          <span className="dash-chip">últimos {Math.min(events.length, 6)}</span>
        </div>
        <div className="dash-events">
          {events.slice(0, 6).map((event, i) => {
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
      </motion.div>
    </div>
  );
};
