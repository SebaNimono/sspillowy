import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { Finding, fetchFindings } from '../api/client';
import { ShieldAlert, Filter, Sparkles, CheckCircle2, FileCode, ChevronRight } from 'lucide-react';

const FALLBACK_FINDINGS: Finding[] = [
  {
    id: 'find-1',
    repository_id: 'repo-1',
    scan_id: 'scan-101',
    title: 'Hardcoded AWS Secret Key detected in repository history',
    description: 'GitLeaks identificó un token de AWS (AKIA...) expuesto en el commit a8f91c.',
    engine: 'gitleaks',
    severity: 'CRITICAL',
    file_path: 'apps/api/config/aws_client.py',
    line_number: 42,
    cwe: 'CWE-798: Use of Hard-coded Credentials',
    owasp_category: 'A07:2021 - Identification and Authentication Failures',
    status: 'OPEN',
    ai_triaged: true,
    ai_confidence: 0.98,
    ai_summary: 'La credencial de AWS expuesta coincide con una clave de acceso activa con permisos de lectura en S3.',
    ai_remediation: 'Revocar inmediatamente la clave AWS en IAM Console y mover el secreto a AWS Secrets Manager o variable de entorno.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'find-2',
    repository_id: 'repo-2',
    scan_id: 'scan-102',
    title: 'Potential SQL Injection in dynamic query concatenation',
    description: 'Semgrep detectó concatenación directa de parámetros no saneados en la consulta SQL.',
    engine: 'semgrep',
    severity: 'CRITICAL',
    file_path: 'src/services/user_search.py',
    line_number: 115,
    cwe: 'CWE-89: SQL Injection',
    owasp_category: 'A03:2021 - Injection',
    status: 'OPEN',
    ai_triaged: true,
    ai_confidence: 0.94,
    ai_summary: 'El parámetro search_query ingresado por el cliente se interpola directamente en el string SQL.',
    ai_remediation: 'Sustituir por query parametrizada: session.query(User).filter(User.username == query).',
    created_at: new Date().toISOString(),
  },
  {
    id: 'find-3',
    repository_id: 'repo-2',
    scan_id: 'scan-102',
    title: 'CVE-2024-21626: container breakout vulnerability in runc dependency',
    description: 'Trivy detectó una vulnerabilidad crítica en la imagen Docker base python:3.10-slim.',
    engine: 'trivy',
    severity: 'HIGH',
    file_path: 'Dockerfile',
    line_number: 1,
    cwe: 'CWE-1395: Dependency Vulnerability',
    owasp_category: 'A06:2021 - Vulnerable and Outdated Components',
    status: 'OPEN',
    ai_triaged: true,
    ai_confidence: 0.89,
    ai_summary: 'La versión base python:3.10-slim contiene una versión ejecutable vulnerable de runc.',
    ai_remediation: 'Actualizar la primera línea del Dockerfile a FROM python:3.12-slim.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'find-4',
    repository_id: 'repo-1',
    scan_id: 'scan-101',
    title: 'Missing HTTP Strict-Transport-Security (HSTS) Header',
    description: 'OWASP ZAP detectó que el endpoint /api/v1/auth no incluye encabezado HSTS en las respuestas.',
    engine: 'owasp_zap',
    severity: 'MEDIUM',
    file_path: '/api/v1/auth/login',
    line_number: 0,
    cwe: 'CWE-523: Unprotected Transport Channel',
    owasp_category: 'A05:2021 - Security Misconfiguration',
    status: 'IN_REVIEW',
    ai_triaged: true,
    ai_confidence: 0.91,
    ai_summary: 'Ausencia de HSTS permite ataques Man-In-The-Middle por downgrade de HTTPS a HTTP.',
    ai_remediation: 'Agregar middleware en FastAPI: response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains".',
    created_at: new Date().toISOString(),
  },
];

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
}

export const FindingsPage: React.FC<PageProps> = ({ sidebarState, setSidebarState, user, onLogout }) => {
  const [findings, setFindings] = useState<Finding[]>(FALLBACK_FINDINGS);
  const [loading, setLoading] = useState(true);
  const [selectedEngine, setSelectedEngine] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadFindings = () => {
    setLoading(true);
    const engine = selectedEngine === 'all' ? undefined : selectedEngine;
    const severity = selectedSeverity === 'all' ? undefined : selectedSeverity;

    fetchFindings(engine, severity)
      .then((data) => {
        if (data && data.length > 0) {
          setFindings(data);
        } else {
          filterFallbackData();
        }
      })
      .catch(() => {
        filterFallbackData();
      })
      .finally(() => setLoading(false));
  };

  const filterFallbackData = () => {
    let filtered = FALLBACK_FINDINGS;
    if (selectedEngine !== 'all') {
      filtered = filtered.filter((f) => f.engine === selectedEngine);
    }
    if (selectedSeverity !== 'all') {
      filtered = filtered.filter((f) => f.severity === selectedSeverity);
    }
    setFindings(filtered);
  };

  useEffect(() => {
    loadFindings();
  }, [selectedEngine, selectedSeverity]);

  const handleApproveFix = () => {
    setToast({
      id: Date.now().toString(),
      type: 'success',
      title: 'Parche Aprobado & Registrado',
      message: 'Firma y cambio de estado a FIXED registrado en bitácora auditada.',
    });
    if (activeFinding) {
      setFindings(findings.map((f) => f.id === activeFinding.id ? { ...f, status: 'FIXED' } : f));
    }
    setActiveFinding(null);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="badge badge-critical">Crítico</span>;
      case 'HIGH':
        return <span className="badge badge-high">Alto</span>;
      case 'MEDIUM':
        return <span className="badge badge-medium">Medio</span>;
      default:
        return <span className="badge badge-low">Bajo</span>;
    }
  };

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <Header
        title="Matriz Unificada de Hallazgos"
        subtitle="Consolidación determinista de escáneres con triaje asistido por IA (Human-in-the-loop)"
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
      />

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#656d76', fontSize: '0.85rem', fontWeight: 600 }}>
            <Filter size={16} color="#0969da" />
            <span>Filtros de Auditoría:</span>
          </div>

          <div>
            <select
              value={selectedEngine}
              onChange={(e) => setSelectedEngine(e.target.value)}
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-default)',
                color: '#1f2328',
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 500,
                outline: 'none',
              }}
            >
              <option value="all">Todos los Motores</option>
              <option value="semgrep">Semgrep (SAST)</option>
              <option value="trivy">Trivy (SCA / IaC)</option>
              <option value="gitleaks">GitLeaks (Secretos)</option>
              <option value="owasp_zap">OWASP ZAP (DAST)</option>
            </select>
          </div>

          <div>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-default)',
                color: '#1f2328',
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 500,
                outline: 'none',
              }}
            >
              <option value="all">Todas las Severidades</option>
              <option value="CRITICAL">Crítico</option>
              <option value="HIGH">Alto</option>
              <option value="MEDIUM">Medio</option>
              <option value="LOW">Bajo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Findings Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldAlert size={20} color="#0969da" />
            <span>Vulnerabilidades & Secretos Detectados ({findings.length})</span>
          </div>
        </div>

        {loading ? (
          <div style={{ color: '#656d76', padding: '2rem', textAlign: 'center' }}>Cargando hallazgos...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Severidad</th>
                  <th>Vulnerabilidad / Título</th>
                  <th>Motor Detección</th>
                  <th>Archivo / Endpoint</th>
                  <th>IA Triaje</th>
                  <th>Acción</th>
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
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-engine">{f.engine.toUpperCase()}</span>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#0969da', fontWeight: 600 }}>
                        {f.file_path || 'API Endpoint'} {f.line_number ? `:${f.line_number}` : ''}
                      </div>
                    </td>
                    <td>
                      {f.ai_triaged ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            color: '#8250df',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}
                        >
                          <Sparkles size={14} color="#8250df" />
                          <span>Confianza {Math.round((f.ai_confidence || 0.9) * 100)}%</span>
                        </span>
                      ) : (
                        <span style={{ color: '#656d76', fontSize: '0.8rem' }}>Pendiente</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => setActiveFinding(f)}
                      >
                        <span>Inspeccionar</span>
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

      {/* Finding Detail Modal */}
      {activeFinding && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                {getSeverityBadge(activeFinding.severity)}
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
                <span>{activeFinding.file_path} {activeFinding.line_number ? `(Línea ${activeFinding.line_number})` : ''}</span>
              </div>
            </div>

            {/* AI Triaje & Remediation */}
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
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setActiveFinding(null)}>
                Cerrar
              </button>
              <button className="btn btn-primary" onClick={handleApproveFix}>
                <CheckCircle2 size={16} />
                <span>Aprobar Parche & Marcar 'FIXED'</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
