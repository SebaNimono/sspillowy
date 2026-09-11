import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { Finding, fetchFindings, updateFindingStatus } from '../api/client';
import { FALLBACK_FINDINGS } from '../api/fallbacks';
import { ShieldAlert, Filter, Sparkles, CheckCircle2, FileCode, ChevronRight, CircleSlash, Flag, Eye } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { formatFilePath } from '../utils/formatFilePath';

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
  const [findings, setFindings] = useState<Finding[]>(FALLBACK_FINDINGS);
  const [loading, setLoading] = useState(true);
  const [selectedEngine, setSelectedEngine] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const applyLocalFilters = (source: Finding[]) => {
    let filtered = source;
    if (selectedEngine !== 'all') filtered = filtered.filter((f) => f.engine === selectedEngine);
    if (selectedSeverity !== 'all') filtered = filtered.filter((f) => f.severity === selectedSeverity);
    if (selectedStatus !== 'all') filtered = filtered.filter((f) => f.status === selectedStatus);
    return filtered;
  };

  const loadFindings = () => {
    setLoading(true);
    const engine = selectedEngine === 'all' ? undefined : selectedEngine;
    const severity = selectedSeverity === 'all' ? undefined : selectedSeverity;
    const statusFilter = selectedStatus === 'all' ? undefined : selectedStatus;

    fetchFindings(engine, severity, statusFilter)
      .then((data) => {
        if (data && data.length > 0) setFindings(data);
        else setFindings(applyLocalFilters(FALLBACK_FINDINGS));
      })
      .catch(() => setFindings(applyLocalFilters(FALLBACK_FINDINGS)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFindings();
  }, [selectedEngine, selectedSeverity, selectedStatus]);

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
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldAlert size={20} color="#0969da" />
            <span>{t('findings.detected', { count: findings.length })}</span>
          </div>
        </div>

        {loading ? (
          <div style={{ color: '#656d76', padding: '2rem', textAlign: 'center' }}>{t('findings.loading')}</div>
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
                  <th>{t('findings.aiTriage')}</th>
                  <th>{t('findings.action')}</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr key={f.id}>
                    <td>{getSeverityBadge(f.severity)}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1f2328', fontSize: '0.9rem' }}>{f.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#656d76', fontFamily: 'var(--font-mono)', marginTop: '0.1rem' }}>
                        {f.cwe || f.owasp_category}
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
                      {f.ai_triaged ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#8250df', fontSize: '0.8rem', fontWeight: 600 }}>
                          <Sparkles size={14} color="#8250df" />
                          <span>{t('findings.confidence', { pct: Math.round((f.ai_confidence || 0.9) * 100) })}</span>
                        </span>
                      ) : (
                        <span style={{ color: '#656d76', fontSize: '0.8rem' }}>{t('findings.pending')}</span>
                      )}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0969da', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600 }}>
                <FileCode size={16} />
                <span>
                  {formatFilePath(activeFinding.file_path) || t('findings.apiEndpoint')}
                  {activeFinding.line_number ? ` (${t('findings.line', { n: activeFinding.line_number })})` : ''}
                </span>
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
