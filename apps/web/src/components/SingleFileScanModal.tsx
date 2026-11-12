import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  Play,
  Sparkles,
  Upload,
  X,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import {
  Repository,
  ScanEngine,
  SingleFileScanResult,
  scanSingleFile,
} from '../api/client';

const DEMO_SNIPPET = `# Demo vulnerable: auth_service.py (SQLi + AWS Secret + Command Injection + Weak Hash)
import hashlib
import subprocess
import sqlite3

AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"
JWT_SECRET = "super_secret_prod_signing_key_2026"

def login_user(conn: sqlite3.Connection, username: str, password: str):
    # Weak hash MD5
    pwd_hash = hashlib.md5(password.encode()).hexdigest()
    # SQL Injection por concatenación directa
    cur = conn.cursor()
    cur.execute(f"SELECT id, role FROM users WHERE username = '{username}' AND password_hash = '{pwd_hash}'")
    return cur.fetchone()

def ping_diagnostic(host_input: str):
    # Command Injection con shell=True
    return subprocess.run(f"ping -c 1 {host_input}", shell=True, capture_output=True, text=True)
`;

interface SingleFileScanModalProps {
  open?: boolean;
  onClose: () => void;
  repositories?: Repository[];
  defaultRepoId?: string;
  onPersisted?: () => void;
  onCompleted?: () => void;
}

export const SingleFileScanModal: React.FC<SingleFileScanModalProps> = ({
  open = true,
  onClose,
  repositories = [],
  defaultRepoId = '',
  onPersisted,
  onCompleted,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState('src/auth_service.py');
  const [content, setContent] = useState(DEMO_SNIPPET);
  const [engines, setEngines] = useState<Record<'semgrep' | 'gitleaks' | 'trivy', boolean>>({
    semgrep: true,
    gitleaks: true,
    trivy: true,
  });
  const [repoId, setRepoId] = useState(defaultRepoId);
  const [persist, setPersist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SingleFileScanResult | null>(null);

  if (!open) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setContent(reader.result.slice(0, 500_000));
        setResult(null);
      }
    };
    reader.readAsText(file);
  };

  const runAnalysis = async () => {
    const selectedEngines = (Object.keys(engines) as ('semgrep' | 'gitleaks' | 'trivy')[]).filter(
      (k) => engines[k],
    ) as ScanEngine[];
    if (!filename.trim() || !content.trim()) {
      setError('Indica el nombre del archivo y su contenido.');
      return;
    }
    if (selectedEngines.length === 0) {
      setError('Selecciona al menos un motor de análisis.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await scanSingleFile({
        filename: filename.trim(),
        content,
        engines: selectedEngines,
        repositoryId: persist && repoId ? repoId : undefined,
        persist: Boolean(persist && repoId),
      });
      setResult(res);
      if (res.persisted_scan_id) {
        onPersisted?.();
        onCompleted?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar el archivo.');
    } finally {
      setBusy(false);
    }
  };

  const sevColor: Record<string, { bg: string; fg: string; border: string }> = {
    CRITICAL: { bg: '#fee2e2', fg: '#b91c1c', border: '#fecaca' },
    HIGH: { bg: '#ffedd5', fg: '#c2410c', border: '#fed7aa' },
    MEDIUM: { bg: '#fef9c3', fg: '#a16207', border: '#fde047' },
    LOW: { bg: '#dbeafe', fg: '#1d4ed8', border: '#bfdbfe' },
    INFO: { bg: '#f3f4f6', fg: '#4b5563', border: '#e5e7eb' },
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '820px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '1.35rem 1.5rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              <FileCode2 size={20} color="#2563eb" />
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#111827' }}>
                Escaneo Rápido de 1 Archivo (Sin clonar repositorio)
              </h2>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
              Sube un archivo desde tu equipo o pega un fragmento de código para ejecutar Semgrep (SAST), GitLeaks (Secretos) y Trivy (SCA/IaC) al instante.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.5rem' }}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.55rem', alignItems: 'end', marginBottom: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>
            <span>Nombre / ruta del archivo</span>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="ej. apps/api/auth.py, Dockerfile, package.json"
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </label>

          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            <span>Subir archivo…</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setFilename('src/auth_service.py');
              setContent(DEMO_SNIPPET);
              setResult(null);
            }}
            title="Cargar archivo de demostración con vulnerabilidades reales"
          >
            <Sparkles size={14} color="#2563eb" />
            <span>Cargar demo vulnerable</span>
          </button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.8rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>
            Contenido del archivo ({content.split('\n').length} líneas)
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            spellCheck={false}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '10px',
              border: '1px solid #d1d5db',
              background: '#0f172a',
              color: '#e2e8f0',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              lineHeight: 1.5,
              resize: 'vertical',
            }}
          />
        </label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem', padding: '0.65rem 0.85rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Motores:</span>
            {(
              [
                { id: 'semgrep' as const, label: 'Semgrep (SAST)' },
                { id: 'gitleaks' as const, label: 'GitLeaks (Secretos)' },
                { id: 'trivy' as const, label: 'Trivy (SCA / IaC)' },
              ]
            ).map((eng) => (
              <label key={eng.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={engines[eng.id]}
                  onChange={(e) => setEngines((prev) => ({ ...prev, [eng.id]: e.target.checked }))}
                />
                <span>{eng.label}</span>
              </label>
            ))}
          </div>

          {repositories.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={persist}
                  onChange={(e) => {
                    setPersist(e.target.checked);
                    if (e.target.checked && !repoId && repositories[0]) {
                      setRepoId(repositories[0].id);
                    }
                  }}
                />
                <span>Guardar en repositorio:</span>
              </label>
              {persist && (
                <select
                  value={repoId}
                  onChange={(e) => setRepoId(e.target.value)}
                  style={{ fontSize: '0.78rem', padding: '0.28rem 1.8rem 0.28rem 0.55rem' }}
                >
                  {repositories.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: '0.6rem 0.85rem', marginBottom: '0.8rem', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.82rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginBottom: result ? '1rem' : 0 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn btn-primary" onClick={runAnalysis} disabled={busy}>
            <Play size={14} />
            <span>{busy ? 'Analizando archivo…' : 'Analizar archivo ahora'}</span>
          </button>
        </div>

        {result && (
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                {result.total_findings === 0 ? (
                  <CheckCircle2 size={18} color="#16a34a" />
                ) : (
                  <ShieldAlert size={18} color="#dc2626" />
                )}
                <strong style={{ fontSize: '0.92rem', color: '#111827' }}>
                  {result.total_findings === 0
                    ? 'Archivo limpio: 0 vulnerabilidades detectadas'
                    : `${result.total_findings} hallazgos detectados en ${result.filename}`}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', color: '#6b7280' }}>
                <Clock size={13} />
                <span>Analizado en {result.elapsed_ms} ms</span>
                <span>·</span>
                <span>Motores: {result.engines_executed.join(', ')}</span>
                {result.persisted_scan_id && (
                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.12rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                    Guardado en matriz
                  </span>
                )}
              </div>
            </div>

            {result.findings.length > 0 && (
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {result.findings.map((f) => {
                  const tone = sevColor[f.severity] || sevColor.INFO;
                  return (
                    <div
                      key={f.id}
                      style={{
                        padding: '0.75rem 0.9rem',
                        borderRadius: '10px',
                        border: '1px solid #e5e7eb',
                        background: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '999px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: tone.bg,
                              color: tone.fg,
                              border: `1px solid ${tone.border}`,
                            }}
                          >
                            {f.severity}
                          </span>
                          <span className="badge badge-engine" style={{ fontSize: '0.7rem' }}>
                            {f.engine.toUpperCase()}
                          </span>
                          <strong style={{ fontSize: '0.84rem', color: '#111827' }}>{f.title}</strong>
                        </div>
                        <code style={{ fontSize: '0.74rem', color: '#4b5563', background: '#f3f4f6', padding: '0.12rem 0.45rem', borderRadius: '6px' }}>
                          {f.file_path}:{f.line_number}
                        </code>
                      </div>
                      <p style={{ margin: '0.25rem 0 0.4rem', fontSize: '0.79rem', color: '#4b5563' }}>{f.description}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.35rem' }}>
                        {f.cwe && <span><strong>CWE:</strong> {f.cwe}</span>}
                        {f.owasp_category && <span>· <strong>OWASP:</strong> {f.owasp_category}</span>}
                        {f.iso_control && <span>· <strong>ISO 27001:</strong> {f.iso_control}</span>}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#15803d', background: '#f0fdf4', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                        <AlertTriangle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        <strong>Remediación sugerida:</strong> {f.remediation}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
