import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { Scan, fetchScans, triggerScan } from '../api/client';
import { FALLBACK_SCANS, REPO_NAMES } from '../api/fallbacks';
import { Radar, Play, GitBranch, RefreshCw } from 'lucide-react';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
}

export const ScansPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
}) => {
  const [scans, setScans] = useState<Scan[]>(FALLBACK_SCANS);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadScans = () => {
    setLoading(true);
    fetchScans()
      .then((data) => {
        if (data && data.length > 0) setScans(data);
        else setScans(FALLBACK_SCANS);
      })
      .catch(() => setScans(FALLBACK_SCANS))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadScans();
  }, []);

  const handleRetrigger = async (scan: Scan) => {
    try {
      await triggerScan(scan.repository_id);
    } catch {
      // demo fallback
    }
    const running: Scan = {
      ...scan,
      id: `scan-${Date.now()}`,
      status: 'RUNNING',
      triggered_by: 'web_hub',
      total_findings: 0,
      critical_count: 0,
      high_count: 0,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    setScans([running, ...scans]);
    setToast({
      id: Date.now().toString(),
      type: 'info',
      title: 'Escaneo encolado',
      message: `Workers ARQ iniciados para ${REPO_NAMES[scan.repository_id] || scan.repository_id}.`,
    });
  };

  const statusBadge = (status: string) => {
    if (status === 'RUNNING') return <span className="badge" style={{ background: '#ddf4ff', color: '#0969da', border: '1px solid #54aeff' }}>RUNNING</span>;
    if (status === 'FAILED') return <span className="badge badge-critical">FAILED</span>;
    return <span className="badge badge-low">COMPLETED</span>;
  };

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header
        title="Orquestación de Escaneos"
        subtitle="Línea de tiempo de workers ARQ: Semgrep, Trivy, GitLeaks y OWASP ZAP"
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
      />

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Radar size={20} color="#0969da" />
            <span>Historial de escaneos ({scans.length})</span>
          </div>
          <button className="btn btn-secondary" onClick={loadScans}>
            <RefreshCw size={14} />
            <span>Actualizar</span>
          </button>
        </div>

        {loading ? (
          <div style={{ color: '#656d76', padding: '2rem', textAlign: 'center' }}>Cargando orquestación...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Scan ID</th>
                  <th>Repositorio</th>
                  <th>Disparador</th>
                  <th>Rama</th>
                  <th>Críticas</th>
                  <th>Hallazgos</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan.id}>
                    <td>{statusBadge(scan.status)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#0969da', fontWeight: 600 }}>{scan.id}</td>
                    <td style={{ fontWeight: 600 }}>{REPO_NAMES[scan.repository_id] || scan.repository_id}</td>
                    <td>
                      <span className="badge badge-engine">{scan.triggered_by}</span>
                    </td>
                    <td>
                      <span className="badge badge-engine">
                        <GitBranch size={12} style={{ marginRight: 4 }} />
                        {scan.branch}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${scan.critical_count > 0 ? 'badge-critical' : 'badge-low'}`}>
                        {scan.critical_count}
                      </span>
                    </td>
                    <td style={{ color: '#656d76' }}>{scan.total_findings}</td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => handleRetrigger(scan)}
                      >
                        <Play size={14} color="#0969da" />
                        <span>Re-escanear</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
