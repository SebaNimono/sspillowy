import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { ComplianceReport, fetchComplianceReport, fetchFindings } from '../api/client';
import { FALLBACK_COMPLIANCE, FALLBACK_FINDINGS } from '../api/fallbacks';
import { FileArchive, Download, ShieldCheck, BookOpen } from 'lucide-react';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
}

const statusBadge = (status: string) => {
  if (status === 'COMPLIANT') return <span className="badge badge-low">Cumple</span>;
  if (status === 'PARTIAL') return <span className="badge badge-medium">Parcial</span>;
  return <span className="badge badge-critical">Brecha</span>;
};

export const ReportsPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
}) => {
  const [report, setReport] = useState<ComplianceReport>(FALLBACK_COMPLIANCE);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    fetchComplianceReport()
      .then((data) => {
        if (data) setReport(data);
      })
      .catch(() => setReport(FALLBACK_COMPLIANCE));
  }, []);

  const downloadPack = async () => {
    let findings = FALLBACK_FINDINGS;
    try {
      const remote = await fetchFindings();
      if (remote?.length) findings = remote;
    } catch {
      findings = FALLBACK_FINDINGS;
    }

    const pack = {
      platform: 'SSPILLOWY',
      standard: report.standard,
      period: report.period,
      generated_at: new Date().toISOString(),
      health_score: report.health_score,
      human_in_the_loop: true,
      note: 'La IA no auto-cierra hallazgos. Este paquete es evidencia de auditoría, no un veredicto automático.',
      controls: report.controls,
      findings,
    };

    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sspillowy-iso27001-evidencia-${report.period}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setToast({
      id: Date.now().toString(),
      type: 'success',
      title: 'Paquete de evidencia generado',
      message: 'Se descargó el JSON de auditoría ISO/IEC 27001:2022.',
    });
  };

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header
        title="Informes y cumplimiento"
        subtitle="Paquetes de evidencia ISO/IEC 27001:2022, mapeo OWASP/CWE y reportes ejecutivos"
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">Estándar</div>
            <div className="stat-value" style={{ fontSize: '1.15rem' }}>{report.standard}</div>
          </div>
          <div className="stat-icon" style={{ color: '#0969da' }}>
            <BookOpen size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Periodo</div>
            <div className="stat-value">{report.period}</div>
          </div>
          <div className="stat-icon" style={{ color: '#8250df' }}>
            <FileArchive size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Health Score</div>
            <div className="stat-value" style={{ color: '#0969da' }}>{report.health_score}/100</div>
          </div>
          <div className="stat-icon" style={{ color: '#1a7f37' }}>
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileArchive size={20} color="#0969da" />
            <span>Paquete de evidencia ISO 27001</span>
          </div>
          <button className="btn btn-primary" onClick={downloadPack}>
            <Download size={16} />
            <span>Descargar evidencia JSON</span>
          </button>
        </div>
        <p style={{ color: '#656d76', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.5 }}>
          El paquete incluye controles A.8.x, hallazgos abiertos con CWE/OWASP y la bitácora de que el cierre
          siempre es humano. La detección permanece determinista (Semgrep, Trivy, GitLeaks, ZAP).
        </p>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Control</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Motor</th>
                <th>Hallazgos abiertos</th>
              </tr>
            </thead>
            <tbody>
              {report.controls.map((control) => (
                <tr key={control.code}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0969da' }}>{control.code}</td>
                  <td>{control.title}</td>
                  <td>{statusBadge(control.status)}</td>
                  <td>
                    {control.related_engine ? (
                      <span className="badge badge-engine">{control.related_engine.toUpperCase()}</span>
                    ) : (
                      <span style={{ color: '#8c959f' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${control.open_findings > 0 ? 'badge-high' : 'badge-low'}`}>
                      {control.open_findings}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
