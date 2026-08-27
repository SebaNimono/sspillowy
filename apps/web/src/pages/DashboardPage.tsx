import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { HeatmapCalendar } from '../components/HeatmapCalendar';
import { DashboardStats, HeatmapData, AuditEvent, fetchStats, fetchHeatmap, fetchAuditLog } from '../api/client';
import { buildFallbackHeatmap, FALLBACK_AUDIT } from '../api/fallbacks';
import { KeyRound, Cpu, ShieldCheck, CheckCircle2, AlertOctagon, Terminal, Layers, Activity, Flame } from 'lucide-react';

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
  trend_7d: [3, 5, 2, 8, 4, 6, 3],
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

const ENGINE_META: Array<{ key: string; label: string; color: string }> = [
  { key: 'semgrep', label: 'Semgrep (SAST - Código)', color: '#0969da' },
  { key: 'trivy', label: 'Trivy (SCA / IaC / CVEs)', color: '#9a6700' },
  { key: 'gitleaks', label: 'GitLeaks (Secretos & Keys)', color: '#cf222e' },
  { key: 'owasp_zap', label: 'OWASP ZAP (DAST - APIs)', color: '#8250df' },
];

const actionColor = (action: string) => {
  if (action.includes('SECRET') || action.includes('GATE_BLOCK')) return '#cf222e';
  if (action.includes('AI')) return '#8250df';
  if (action.includes('SCAN')) return '#0969da';
  return '#656d76';
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

  const engineTotal = Object.values(stats.findings_by_engine || {}).reduce((a, b) => a + b, 0) || 1;
  const trend = stats.trend_7d && stats.trend_7d.length ? stats.trend_7d : DEFAULT_STATS.trend_7d!;
  const trendMax = Math.max(...trend, 1);

  return (
    <div>
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

      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">Repositorios Monitoreados</div>
            <div className="stat-value">{stats.monitored_repos}</div>
          </div>
          <div className="stat-icon" style={{ color: '#0969da' }}>
            <Cpu size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Vulnerabilidades Críticas</div>
            <div className="stat-value" style={{ color: '#cf222e' }}>{stats.critical_findings}</div>
          </div>
          <div className="stat-icon" style={{ color: '#cf222e' }}>
            <AlertOctagon size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Secretos Prevenidos</div>
            <div className="stat-value" style={{ color: '#1a7f37' }}>{stats.secrets_leaked_prevented}</div>
          </div>
          <div className="stat-icon" style={{ color: '#1a7f37' }}>
            <KeyRound size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Total Escaneos Ejecutados</div>
            <div className="stat-value">{stats.total_scans_run}</div>
          </div>
          <div className="stat-icon" style={{ color: '#8250df' }}>
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      <div className="split-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Layers size={18} color="#0969da" />
              <span>Distribución por Motores de Detección</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            {ENGINE_META.map((engine) => {
              const count = stats.findings_by_engine?.[engine.key] || 0;
              const width = Math.max(6, Math.round((count / engineTotal) * 100));
              return (
                <div key={engine.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#1f2328', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{engine.label}</span>
                    <span style={{ color: engine.color, fontWeight: 600 }}>{count} hallazgos</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${width}%`, height: '100%', background: engine.color }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Terminal size={18} color="#8250df" />
              <span>Estado de la Arquitectura Orquestadora</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f6f8fa', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #d0d7de' }}>
              <CheckCircle2 color="#1a7f37" size={18} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1f2328' }}>FastAPI Gateway Core</div>
                <div style={{ color: '#656d76', fontSize: '0.75rem' }}>Enrutamiento REST asíncrono en puerto 8000</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f6f8fa', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #d0d7de' }}>
              <CheckCircle2 color="#1a7f37" size={18} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1f2328' }}>PostgreSQL 16 Engine</div>
                <div style={{ color: '#656d76', fontSize: '0.75rem' }}>Persistencia de esquemas relacionales unificados</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f6f8fa', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #d0d7de' }}>
              <CheckCircle2 color="#1a7f37" size={18} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1f2328' }}>Redis + ARQ Workers</div>
                <div style={{ color: '#656d76', fontSize: '0.75rem' }}>Ejecución paralela de escáneres multihilo</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f6f8fa', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #d0d7de' }}>
              <CheckCircle2 color="#0969da" size={18} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0969da' }}>Capa Agéntica de IA (LLM Router)</div>
                <div style={{ color: '#656d76', fontSize: '0.75rem' }}>Triaje de alcanzabilidad y remediación en tiempo real</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="split-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Flame size={18} color="#cf222e" />
              <span>Mapa de calor de hallazgos (12 semanas)</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#656d76', fontWeight: 600 }}>
              Intensidad = volumen de detección
            </span>
          </div>
          <HeatmapCalendar data={heatmap} />
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={18} color="#0969da" />
              <span>Bitácora de eventos</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#656d76', fontWeight: 600 }}>Tendencia 7 días</span>
                <span style={{ fontSize: '0.75rem', color: '#656d76' }}>hallazgos / día</span>
              </div>
              <div className="trend-bars">
                {trend.map((value, idx) => (
                  <div key={idx} className="trend-col">
                    <div className="trend-bar" style={{ height: `${Math.max(12, (value / trendMax) * 72)}px` }} />
                    <span className="trend-label">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="activity-item">
                <span className="activity-dot" style={{ background: actionColor(event.action) }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, color: actionColor(event.action) }}>
                      {event.action}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#1f2328', fontWeight: 600 }}>{event.target}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#656d76', marginTop: '0.15rem' }}>{event.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
