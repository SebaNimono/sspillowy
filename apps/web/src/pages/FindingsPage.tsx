import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { Finding, fetchFindings, updateFindingStatus, clearFindings } from '../api/client';
import { ShieldAlert, Filter, Sparkles, CheckCircle2, FileCode, ChevronRight, CircleSlash, Flag, Eye, Trash2, CalendarClock, User } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { formatFilePath } from '../utils/formatFilePath';
import { formatDateTime } from '../utils/formatDateTime';
import { ConfirmModal } from '../components/ConfirmModal';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

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
  const [selectedEngine, setSelectedEngine] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadFindings = () => {
    setLoading(true);
    const engine = selectedEngine === 'all' ? undefined : selectedEngine;
    const severity = selectedSeverity === 'all' ? undefined : selectedSeverity;
    const statusFilter = selectedStatus === 'all' ? undefined : selectedStatus;

    fetchFindings(engine, severity, statusFilter)
      .then((data) => setFindings(data || []))
      .catch(() => {
        setFindings([]);
        setToast({
          id: Date.now().toString(),
          type: 'error',
          title: 'Error',
          message: 'No se pudieron cargar los hallazgos.',
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFindings();
  }, [selectedEngine, selectedSeverity, selectedStatus]);

  const handleClearMatrix = async () => {
    setClearing(true);
    try {
      const res = await clearFindings();
      setFindings([]);
      setConfirmClear(false);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Matriz vaciada',
        message: `Se eliminaron ${res.deleted} hallazgos. Ejecute un escaneo de nuevo desde Repositorios.`,
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'No se pudo vaciar',
        message: err instanceof Error ? err.message : 'Error de API',
      });
    } finally {
      setClearing(false);
    }
  };

  const applyStatus = async (status: Finding['status'], title: string, message: string) => {
    if (!activeFinding) return;
    try {
      await updateFindingStatus(activeFinding.id, status, `Acción HITL: ${status}`);
    } catch {
      // demo local
    }
    setFindings(findings.map((f) => (f.id === activeFinding.id ? { ...f, status } : f)));
    setToast({ id: Date.now().toString(), type: 'success', title, message });
    setActiveFinding(null);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="badge badge-critical">{t('findings.critical')}</span>;
      case 'HIGH':
        return <span className="badge badge-high">{t('findings.high')}</span>;
      case 'MEDIUM':
        return <span className="badge badge-medium">{t('findings.medium')}</span>;
      default:
        return <span className="badge badge-low">{t('findings.low')}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FIXED':
        return <span className="badge badge-low">FIXED</span>;
      case 'IN_REVIEW':
        return <span className="badge" style={{ background: '#ddf4ff', color: '#0969da', border: '1px solid #54aeff' }}>IN_REVIEW</span>;
      case 'FALSE_POSITIVE':
        return <span className="badge badge-engine">FALSE_POSITIVE</span>;
      case 'SUPERSEDED':
        return <span className="badge" style={{ background: '#f6f8fa', color: '#656d76', border: '1px solid #d0d7de' }}>SUPERSEDED</span>;
      case 'ACCEPTED_RISK':
        return <span className="badge badge-medium">ACCEPTED_RISK</span>;
      default:
        return <span className="badge badge-high">OPEN</span>;
    }
  };

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

      <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#656d76', fontSize: '0.85rem', fontWeight: 600 }}>
            <Filter size={16} color="#0969da" />
            <span>{t('findings.auditFilters')}</span>
          </div>

          <select value={selectedEngine} onChange={(e) => setSelectedEngine(e.target.value)} className="filter-select">
            <option value="all">{t('findings.allEngines')}</option>
            <option value="semgrep">Semgrep (SAST)</option>
            <option value="trivy">Trivy (SCA / IaC)</option>
            <option value="gitleaks">GitLeaks (Secretos)</option>
            <option value="owasp_zap">OWASP ZAP (DAST)</option>
          </select>

          <select value={selectedSeverity} onChange={(e) => setSelectedSeverity(e.target.value)} className="filter-select">
            <option value="all">{t('findings.allSeverities')}</option>
            <option value="CRITICAL">{t('findings.critical')}</option>
            <option value="HIGH">{t('findings.high')}</option>
            <option value="MEDIUM">{t('findings.medium')}</option>
            <option value="LOW">{t('findings.low')}</option>
          </select>

          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="filter-select">
            <option value="all">{t('findings.allStatuses')}</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="FIXED">FIXED</option>
            <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
            <option value="ACCEPTED_RISK">ACCEPTED_RISK</option>
            <option value="SUPERSEDED">SUPERSEDED</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldAlert size={20} color="#0969da" />
            <span>{t('findings.detected', { count: findings.length })}</span>
          </div>
          <button
            className="btn btn-secondary"
            style={{ color: '#cf222e', borderColor: '#ff8182' }}
            disabled={clearing || findings.length === 0}
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 size={14} />
            <span>{clearing ? t('common.loading') : 'Vaciar matriz'}</span>
          </button>
        </div>

        {loading ? (
          <div style={{ color: '#656d76', padding: '2rem', textAlign: 'center' }}>{t('findings.loading')}</div>
        ) : findings.length === 0 ? (
          <div style={{ color: '#656d76', padding: '2rem', textAlign: 'center' }}>
            Sin hallazgos. Ejecutá un escaneo desde Repositorios.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>{t('findings.severity')}</th>
                  <th>{t('findings.titleCol')}</th>
                  <th>{t('findings.engine')}</th>
                  <th>{t('findings.statusHitl')}</th>
                  <th>{t('findings.fileEndpoint')}</th>
                  <th>Detalles</th>
                  <th>{t('findings.action')}</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr key={f.id}>
                    <td>{getSeverityBadge(f.severity)}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1f2328', fontSize: '0.9rem' }}>{f.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#656d76', marginTop: '0.1rem' }}>
                        {f.repository_name || f.repository_id}
                        {f.iso_control ? ` · ${f.iso_control}` : ''}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-engine">{f.engine.toUpperCase()}</span>
                    </td>
                    <td>{getStatusBadge(f.status)}</td>
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#0969da', fontWeight: 600 }}>
                        {formatFilePath(f.file_path) || t('findings.apiEndpoint')} {f.line_number ? `:${f.line_number}` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.75rem', color: '#656d76', lineHeight: 1.45 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CalendarClock size={12} />
                          {formatDateTime(f.created_at)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                          <User size={12} />
                          {f.triggered_by || 'web_hub'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setActiveFinding(f)}>
                        <span>{t('findings.inspect')}</span>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmClear}
        title="Vaciar matriz de hallazgos"
        message="Se eliminarán todos los hallazgos. Puede volver a escanear los repositorios después. Esta acción no se puede deshacer."
        confirmLabel="Vaciar matriz"
        cancelLabel={t('common.cancel')}
        danger
        busy={clearing}
        onCancel={() => !clearing && setConfirmClear(false)}
        onConfirm={handleClearMatrix}
      />

      {activeFinding && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                {getSeverityBadge(activeFinding.severity)}
                <span style={{ marginLeft: '0.5rem' }}>{getStatusBadge(activeFinding.status)}</span>
                <h2 style={{ fontSize: '1.25rem', marginTop: '0.5rem', color: '#1f2328', fontWeight: 700 }}>{activeFinding.title}</h2>
              </div>
              <span className="badge badge-engine">{activeFinding.engine.toUpperCase()}</span>
            </div>

            <p style={{ color: '#656d76', fontSize: '0.875rem', marginBottom: '1rem', lineHeight: '1.5' }}>
              {activeFinding.description}
            </p>

            <div style={{ background: '#f6f8fa', borderRadius: '6px', padding: '0.85rem', marginBottom: '1rem', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0969da', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.55rem' }}>
                <FileCode size={16} />
                <span>
                  {formatFilePath(activeFinding.file_path) || t('findings.apiEndpoint')}
                  {activeFinding.line_number ? ` (${t('findings.line', { n: activeFinding.line_number })})` : ''}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#656d76', display: 'grid', gap: '0.25rem' }}>
                <div><strong>Repo:</strong> {activeFinding.repository_name || activeFinding.repository_id}</div>
                <div><strong>Detectado:</strong> {formatDateTime(activeFinding.created_at)}</div>
                <div><strong>Usuario / origen:</strong> {activeFinding.triggered_by || 'web_hub'}</div>
                {activeFinding.cwe ? <div><strong>CWE:</strong> {activeFinding.cwe}</div> : null}
              </div>
            </div>

            {activeFinding.ai_summary && (
              <div className="ai-card">
                <div className="ai-card-title">
                  <Sparkles size={16} />
                  <span>Análisis de IA & Propuesta de Parche (Human-in-the-Loop)</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#1f2328', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                  {activeFinding.ai_summary}
                </p>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8250df', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Código de Remediación Sugerido:
                </div>
                <div className="code-block">{activeFinding.ai_remediation}</div>
                <p style={{ fontSize: '0.75rem', color: '#656d76', marginTop: '0.75rem' }}>
                  La IA no cierra ni descarta hallazgos. Un auditor debe validar el diagnóstico.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.55rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setActiveFinding(null)}>{t('findings.close')}</button>
              <button className="btn btn-secondary" onClick={() => applyStatus('IN_REVIEW', t('findings.inReview'), 'IN_REVIEW')}>
                <Eye size={14} />
                <span>{t('findings.inReview')}</span>
              </button>
              <button className="btn btn-secondary" onClick={() => applyStatus('FALSE_POSITIVE', t('findings.falsePositive'), 'FALSE_POSITIVE')}>
                <CircleSlash size={14} />
                <span>{t('findings.falsePositive')}</span>
              </button>
              <button className="btn btn-secondary" onClick={() => applyStatus('ACCEPTED_RISK', t('findings.acceptRisk'), 'ACCEPTED_RISK')}>
                <Flag size={14} />
                <span>{t('findings.acceptRisk')}</span>
              </button>
              <button className="btn btn-primary" onClick={() => applyStatus('FIXED', t('findings.approveFixed'), 'FIXED')}>
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
