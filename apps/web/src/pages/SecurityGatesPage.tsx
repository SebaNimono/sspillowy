import React, { useCallback, useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import {
  GateCheckResult,
  SecurityGatePolicy,
  checkSecurityGate,
  evaluateSecurityGate,
  fetchSecurityGate,
  updateSecurityGate,
} from '../api/client';
import { Sliders, Save, Smartphone, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

const DEFAULT_POLICY: SecurityGatePolicy = {
  id: 'default-policy',
  name: 'Política Estándar DevSecOps SSPILLOWY',
  max_critical_allowed: 0,
  max_high_allowed: 2,
  block_on_secrets: true,
  require_ciso_approval_for_bypass: true,
  enabled: true,
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

export const SecurityGatesPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
}) => {
  const { t } = useI18n();
  const [policy, setPolicy] = useState<SecurityGatePolicy>(DEFAULT_POLICY);
  const [check, setCheck] = useState<GateCheckResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadCheck = useCallback(() => {
    checkSecurityGate()
      .then(setCheck)
      .catch(() => setCheck(null));
  }, []);

  useEffect(() => {
    fetchSecurityGate()
      .then((data) => {
        if (data) setPolicy(data);
      })
      .catch(() => {
        setPolicy(DEFAULT_POLICY);
      });
    loadCheck();
  }, [loadCheck]);

  const handleSave = async () => {
    if (!policy) return;
    setSaving(true);
    try {
      const saved = await updateSecurityGate(policy);
      setPolicy(saved);
      const result = await evaluateSecurityGate();
      setCheck(result);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Política guardada',
        message: result.summary,
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'No se pudo guardar',
        message: err instanceof Error ? err.message : 'Error de API',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const result = await evaluateSecurityGate();
      setCheck(result);
      setToast({
        id: Date.now().toString(),
        type: result.allowed ? 'success' : 'error',
        title: result.decision,
        message: result.summary,
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Evaluación fallida',
        message: err instanceof Error ? err.message : 'Error de API',
      });
    } finally {
      setEvaluating(false);
    }
  };

  const decisionColor =
    check?.decision === 'BLOCKED' ? '#cf222e' : check?.decision === 'PASSED' ? '#1a7f37' : '#656d76';

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <Header
        title={t('pages.gates.title')}
        subtitle={t('pages.gates.subtitle')}
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      {check && (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            borderTop: `3px solid ${decisionColor}`,
          }}
        >
          <div className="card-header">
            <div className="card-title">
              {check.allowed ? (
                <ShieldCheck size={20} color="#1a7f37" />
              ) : (
                <ShieldAlert size={20} color="#cf222e" />
              )}
              <span>
                Estado actual ·{' '}
                <span style={{ color: decisionColor, fontWeight: 800 }}>{check.decision}</span>
              </span>
            </div>
            <button className="btn btn-secondary" onClick={handleEvaluate} disabled={evaluating}>
              <RefreshCw size={14} className={evaluating ? 'spin' : undefined} />
              <span>{evaluating ? 'Evaluando…' : 'Evaluar ahora'}</span>
            </button>
          </div>
          <p style={{ color: '#656d76', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{check.summary}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <span className="badge badge-critical">
              Críticas {check.open_critical}/{check.max_critical_allowed}
            </span>
            <span className="badge" style={{ background: '#fff8c5', color: '#9a6700', border: '1px solid #d4a72c' }}>
              High {check.open_high}/{check.max_high_allowed}
            </span>
            <span className="badge badge-engine">Secretos {check.open_secrets}</span>
          </div>
          {check.reasons?.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#1f2328', fontSize: '0.85rem' }}>
              {check.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Sliders size={20} color="#0969da" />
            <span>Configuración de Política Activa: {policy.name}</span>
          </div>

          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} />
            <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            padding: '0.85rem 1rem',
            border: '1px solid #d0d7de',
            borderRadius: '8px',
            background: policy.enabled ? '#dafbe1' : '#fff',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1f2328' }}>Gate habilitado</div>
            <div style={{ color: '#656d76', fontSize: '0.8rem' }}>
              Si está apagado, los escaneos quedan SKIPPED y CI puede continuar.
            </div>
          </div>
          <input
            type="checkbox"
            checked={policy.enabled}
            onChange={(e) => setPolicy({ ...policy, enabled: e.target.checked })}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1f883d' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
          <div
            style={{
              background: '#ffffff',
              padding: '1.25rem',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              borderTop: '3px solid #cf222e',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem', color: '#cf222e' }}>
              Máximo de Vulnerabilidades Críticas Permitidas
            </div>
            <p style={{ color: '#656d76', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              Si hay más críticas OPEN/IN_REVIEW que este umbral, el gate bloquea (consola + endpoint CI).
            </p>
            <input
              type="number"
              min="0"
              max="10"
              value={policy.max_critical_allowed}
              onChange={(e) => setPolicy({ ...policy, max_critical_allowed: parseInt(e.target.value) || 0 })}
              style={{
                width: '100px',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
                background: '#ffffff',
                color: '#1f2328',
                fontWeight: 700,
                fontSize: '1rem',
                outline: 'none',
              }}
            />
          </div>

          <div
            style={{
              background: '#ffffff',
              padding: '1.25rem',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              borderTop: '3px solid #9a6700',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem', color: '#9a6700' }}>
              Máximo de Vulnerabilidades Altas (HIGH) Permitidas
            </div>
            <p style={{ color: '#656d76', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              Umbral de high abiertas antes de marcar BLOCKED.
            </p>
            <input
              type="number"
              min="0"
              max="20"
              value={policy.max_high_allowed}
              onChange={(e) => setPolicy({ ...policy, max_high_allowed: parseInt(e.target.value) || 0 })}
              style={{
                width: '100px',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
                background: '#ffffff',
                color: '#1f2328',
                fontWeight: 700,
                fontSize: '1rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2328' }}>
                  Bloqueo Estricto por Fuga de Secretos (GitLeaks)
                </div>
                <div style={{ color: '#656d76', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Si hay secretos abiertos de GitLeaks, el gate bloquea aunque no sean CRITICAL.
                </div>
              </div>
              <input
                type="checkbox"
                checked={policy.block_on_secrets}
                onChange={(e) => setPolicy({ ...policy, block_on_secrets: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1f883d' }}
              />
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: '#8250df',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Smartphone size={16} />
                  <span>Aprobación Móvil Requerida para Bypass (Pulse App)</span>
                </div>
                <div style={{ color: '#656d76', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Queda registrado en el resultado; el bypass biométrico lo conecta Pulse más adelante.
                </div>
              </div>
              <input
                type="checkbox"
                checked={policy.require_ciso_approval_for_bypass}
                onChange={(e) => setPolicy({ ...policy, require_ciso_approval_for_bypass: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#8250df' }}
              />
            </div>
          </div>
        </div>

        <p style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: '#656d76', lineHeight: 1.45 }}>
          CI: <code>GET /api/v1/security-gates/check</code> (opcional{' '}
          <code>?repository_id=...</code>). Si <code>allowed</code> es false, falle el pipeline.
        </p>
      </div>
    </div>
  );
};
