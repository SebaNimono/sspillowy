import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { ApiOfflineBanner } from '../components/ApiOfflineBanner';
import { Scan, fetchScans, triggerScan } from '../api/client';
import { Radar, Play, GitBranch, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

export const ScansPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
}) => {
  const { t } = useI18n();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiOffline, setApiOffline] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadScans = () => {
    setLoading(true);
    fetchScans()
      .then((data) => {
        setApiOffline(false);
        setScans(data || []);
      })
      .catch(() => {
        setApiOffline(true);
        setScans([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadScans();
  }, []);

  const handleRetrigger = async (scan: Scan) => {
    try {
      const created = await triggerScan(scan.repository_id);
      setScans([created, ...scans]);
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Escaneo encolado',
        message: `Scan ${created.id.slice(0, 8)}… en background.`,
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'No se pudo encolar',
        message: err instanceof Error ? err.message : 'Error de API',
      });
    }
  };

  const statusBadge = (scan: Scan) => {
    const status = scan.status;
    if (status === 'RUNNING') {
      const stage = scan.progress_stage ? ` · ${scan.progress_stage}` : '';
      return (
        <span
          className="badge"
          title={scan.progress_detail || undefined}
          style={{ background: '#ddf4ff', color: '#0969da', border: '1px solid #54aeff' }}
        >
          RUNNING{stage}
        </span>
      );
    }
    if (status === 'FAILED') return <span className="badge badge-critical">FAILED</span>;
    return <span className="badge badge-low">COMPLETED</span>;
  };

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header
        title={t('pages.scans.title')}
        subtitle={t('pages.scans.subtitle')}
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      {apiOffline && <ApiOfflineBanner />}

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
                  <th>Gate</th>
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
                {!loading && scans.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: '#656d76', padding: '2rem' }}>
                      No hay escaneos registrados.
                    </td>
                  </tr>
                )}
                {scans.map((scan) => (
                  <tr key={scan.id}>
                    <td>{statusBadge(scan)}</td>
                    <td>
                      {scan.gate_status === 'BLOCKED' ? (
                        <span className="badge badge-critical" title={scan.gate_detail || ''}>
                          BLOCKED
                        </span>
                      ) : scan.gate_status === 'PASSED' ? (
                        <span className="badge badge-low" title={scan.gate_detail || ''}>
                          PASSED
                        </span>
                      ) : scan.gate_status === 'BYPASSED' ? (
                        <span className="badge" style={{ background: '#fbefff', color: '#8250df', border: '1px solid #d2a8ff' }} title={scan.gate_detail || ''}>
                          BYPASSED
                        </span>
                      ) : scan.gate_status === 'SKIPPED' ? (
                        <span className="badge badge-engine" title={scan.gate_detail || ''}>
                          SKIPPED
                        </span>
                      ) : (
                        <span style={{ color: '#8c959f', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#0969da', fontWeight: 600 }}>{scan.id}</td>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{scan.repository_id}</td>
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
