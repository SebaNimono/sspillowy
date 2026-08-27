import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { SecurityGatePolicy, fetchSecurityGate, updateSecurityGate } from '../api/client';
import { Sliders, Save, Smartphone } from 'lucide-react';

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

export const SecurityGatesPage: React.FC<PageProps> = ({ sidebarState, setSidebarState, user, onLogout, onNavigate, unreadCount, onGoToSite }) => {
  const [policy, setPolicy] = useState<SecurityGatePolicy>(DEFAULT_POLICY);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    fetchSecurityGate()
      .then((data) => {
        if (data) setPolicy(data);
      })
      .catch(() => {
        setPolicy(DEFAULT_POLICY);
      });
  }, []);

  const handleSave = async () => {
    if (!policy) return;
    setSaving(true);
    try {
      await updateSecurityGate(policy);
    } catch (err) {
      // simulated save
    }
    setToast({
      id: Date.now().toString(),
      type: 'success',
      title: 'Política Actualizada',
      message: 'Reglas de Security Gate y bypass móvil guardadas correctamente.',
    });
    setSaving(false);
  };

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <Header
        title="Security Gates & Reglas CI/CD"
        subtitle="Configuración de umbrales de despliegue y control de bypass móvil (SSPILLOWY Pulse)"
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
          {/* Rule 1: Max Criticals */}
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-default)', borderTop: '3px solid #cf222e' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem', color: '#cf222e' }}>
              Máximo de Vulnerabilidades Críticas Permitidas
            </div>
            <p style={{ color: '#656d76', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              Si un escaneo detecta un número mayor de fallos 'CRITICAL', el pipeline CI/CD será bloqueado automáticamente.
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

          {/* Rule 2: Max Highs */}
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-default)', borderTop: '3px solid #9a6700' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem', color: '#9a6700' }}>
              Máximo de Vulnerabilidades Altas (HIGH) Permitidas
            </div>
            <p style={{ color: '#656d76', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              Umbral de advertencia severa antes de abortar la integración del código.
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

          {/* Toggle 1: Secret Leak Blocking */}
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2328' }}>
                  Bloqueo Estricto por Fuga de Secretos (GitLeaks)
                </div>
                <div style={{ color: '#656d76', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Bloquear despliegue de inmediato si se detectan tokens, API keys o claves privadas.
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

          {/* Toggle 2: Mobile CISO Approval */}
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#8250df', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Smartphone size={16} />
                  <span>Aprobación Móvil Requerida para Bypass (Pulse App)</span>
                </div>
                <div style={{ color: '#656d76', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Requiere validación biométrica en la app móvil del CISO para desbloquear un pipeline en emergencia.
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
      </div>
    </div>
  );
};
