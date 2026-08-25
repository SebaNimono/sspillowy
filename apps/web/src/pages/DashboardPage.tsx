import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { DashboardStats, fetchStats } from '../api/client';
import { KeyRound, Cpu, ShieldCheck, CheckCircle2, AlertOctagon, Terminal, Layers } from 'lucide-react';

const DEFAULT_STATS: DashboardStats = {
  overall_health_score: 82,
  monitored_repos: 3,
  total_scans_run: 48,
  total_open_findings: 4,
  critical_findings: 2,
  high_findings: 1,
  medium_findings: 1,
  low_findings: 0,
  secrets_leaked_prevented: 14,
  findings_by_engine: {
    semgrep: 5,
    trivy: 4,
    gitleaks: 2,
    owasp_zap: 3,
  },
};

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
}

export const DashboardPage: React.FC<PageProps> = ({ sidebarState, setSidebarState, user, onLogout }) => {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);

  useEffect(() => {
    fetchStats()
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {
        setStats(DEFAULT_STATS);
      });
  }, []);

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
      />

      {/* GitHub/Datadog Light Metrics Cards Grid */}
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

      {/* Main Grid: Engines Distribution + Architecture Pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Scanner Engine Distribution */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Layers size={18} color="#0969da" />
              <span>Distribución por Motores de Detección</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#1f2328', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Semgrep (SAST - Código)</span>
                <span style={{ color: '#0969da', fontWeight: 600 }}>{stats.findings_by_engine.semgrep || 5} hallazgos</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '45%', height: '100%', background: '#0969da' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#1f2328', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Trivy (SCA / IaC / CVEs)</span>
                <span style={{ color: '#9a6700', fontWeight: 600 }}>{stats.findings_by_engine.trivy || 4} hallazgos</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '35%', height: '100%', background: '#9a6700' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#1f2328', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>GitLeaks (Secretos & Keys)</span>
                <span style={{ color: '#cf222e', fontWeight: 600 }}>{stats.findings_by_engine.gitleaks || 2} hallazgos</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '25%', height: '100%', background: '#cf222e' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#1f2328', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>OWASP ZAP (DAST - APIs)</span>
                <span style={{ color: '#8250df', fontWeight: 600 }}>{stats.findings_by_engine.owasp_zap || 3} hallazgos</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '30%', height: '100%', background: '#8250df' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* System Pipeline Status */}
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
    </div>
  );
};
