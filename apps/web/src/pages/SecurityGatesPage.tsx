import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { ApiOfflineBanner } from '../components/ApiOfflineBanner';
import {
  GateBypassRequest,
  GateCheckResult,
  Repository,
  SecurityGatePolicy,
  approveGateBypass,
  checkSecurityGate,
  createGateBypass,
  evaluateSecurityGate,
  fetchGateBypasses,
  fetchRepositories,
  fetchSecurityGate,
  rejectGateBypass,
  updateSecurityGate,
} from '../api/client';
import { Sliders, Save, ShieldCheck, ShieldAlert, RefreshCw, Unlock } from 'lucide-react';
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
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [apiOffline, setApiOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [bypasses, setBypasses] = useState<GateBypassRequest[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [bypassReason, setBypassReason] = useState('');
  const [bypassRepoId, setBypassRepoId] = useState('');
  const [bypassHours, setBypassHours] = useState(24);
  const [bypassBusy, setBypassBusy] = useState(false);

  const loadBypasses = () =>
    fetchGateBypasses()
      .then(setBypasses)
      .catch(() => setBypasses([]));

  useEffect(() => {
    let cancelled = false;
    setLoadingStatus(true);
    Promise.all([
      fetchSecurityGate(),
      checkSecurityGate(),
      fetchGateBypasses().catch(() => [] as GateBypassRequest[]),
      fetchRepositories().catch(() => [] as Repository[]),
    ])
      .then(([pol, result, byps, repoList]) => {
        if (cancelled) return;
        setApiOffline(false);
        if (pol) setPolicy(pol);
        setCheck(result);
        setBypasses(byps || []);
        setRepos(repoList || []);
      })
      .catch(() => {
        if (!cancelled) {
          setApiOffline(true);
          setCheck(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleRequestBypass = async () => {
    if (bypassReason.trim().length < 8) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Motivo corto',
        message: 'Explica al menos 8 caracteres (quién, por qué, hasta cuándo).',
      });
      return;
    }
    setBypassBusy(true);
    try {
      await createGateBypass({
        reason: bypassReason.trim(),
        repository_id: bypassRepoId || null,
        expires_hours: bypassHours,
      });
      setBypassReason('');
      await loadBypasses();
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Bypass solicitado',
        message: 'Queda PENDING hasta aprobación CISO.',
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'No se pudo solicitar',
        message: err instanceof Error ? err.message : 'Error de API',
      });
    } finally {
      setBypassBusy(false);
    }
  };

  const handleApprove = async (id: string) => {
    setBypassBusy(true);
    try {
      await approveGateBypass(id);
      await loadBypasses();
      const result = await evaluateSecurityGate();
      setCheck(result);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Bypass aprobado',
        message: result.summary,
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Aprobación fallida',
        message: err instanceof Error ? err.message : 'Error de API',
      });
    } finally {
      setBypassBusy(false);
    }
  };

  const handleReject = async (id: string) => {
    setBypassBusy(true);
    try {
      await rejectGateBypass(id);
      await loadBypasses();
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Bypass rechazado',
        message: 'La solicitud quedó REJECTED.',
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Rechazo fallido',
        message: err instanceof Error ? err.message : 'Error de API',
      });
    } finally {
      setBypassBusy(false);
    }
  };

  const decisionColor =
    check?.decision === 'BLOCKED'
      ? '#cf222e'
      : check?.decision === 'BYPASSED'
        ? '#8250df'
        : check?.decision === 'PASSED'
          ? '#1a7f37'
          : '#656d76';

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <Header
        title={t('pages.gates.title')}
        subtitle="Umbrales de despliegue y bypass CISO en el hub"
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      {apiOffline && <ApiOfflineBanner />}

      {loadingStatus && !check && !apiOffline && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p style={{ color: '#656d76', margin: 0 }}>Evaluando Security Gate…</p>
        </div>
      )}

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
                <ShieldCheck size={20} color={check.decision === 'BYPASSED' ? '#8250df' : '#1a7f37'} />
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

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <div className="card-title">
            <Unlock size={20} color="#8250df" />
            <span>Bypass CISO (hub)</span>
          </div>
        </div>
        <p style={{ color: '#656d76', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.45 }}>
          Si el gate está BLOCKED, solicita una excepción temporal con motivo y vencimiento. Queda en
          audit log. Pulse podrá firmar esto después; el hub ya opera el flujo.
        </p>
        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
          <textarea
            value={bypassReason}
            onChange={(e) => setBypassReason(e.target.value)}
            placeholder="Motivo (ej. hotfix producción, riesgo aceptado por CISO hasta mañana)…"
            rows={3}
            style={{
              width: '100%',
              padding: '0.65rem',
              borderRadius: '6px',
              border: '1px solid #d0d7de',
              fontSize: '0.85rem',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              value={bypassRepoId}
              onChange={(e) => setBypassRepoId(e.target.value)}
              style={{ flex: 1, minWidth: '180px', padding: '0.55rem', borderRadius: '6px', border: '1px solid #d0d7de' }}
            >
              <option value="">Toda la organización</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#656d76' }}>
              Horas
              <input
                type="number"
                min={1}
                max={168}
                value={bypassHours}
                onChange={(e) => setBypassHours(parseInt(e.target.value, 10) || 24)}
                style={{ width: '72px', padding: '0.45rem', borderRadius: '6px', border: '1px solid #d0d7de' }}
              />
            </label>
            <button className="btn btn-primary" onClick={handleRequestBypass} disabled={bypassBusy}>
              Solicitar bypass
            </button>
          </div>
        </div>
        {bypasses.length === 0 ? (
          <p style={{ color: '#656d76', fontSize: '0.85rem', margin: 0 }}>Sin solicitudes aún.</p>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Alcance</th>
                  <th>Motivo</th>
                  <th>Solicitó</th>
                  <th>Expira</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bypasses.slice(0, 12).map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="badge badge-engine">{b.status}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{b.repository_name || 'Org'}</td>
                    <td style={{ fontSize: '0.8rem', maxWidth: '220px' }}>{b.reason}</td>
                    <td style={{ fontSize: '0.75rem', color: '#656d76' }}>{b.requested_by}</td>
                    <td style={{ fontSize: '0.75rem', color: '#656d76' }}>
                      {b.expires_at ? new Date(b.expires_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      {b.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}
                            disabled={bypassBusy}
                            onClick={() => handleApprove(b.id)}
                          >
                            Aprobar
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}
                            disabled={bypassBusy}
                            onClick={() => handleReject(b.id)}
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Sliders size={20} color="#0969da" />
            <span>Configuración de Política Activa: {policy.name}</span>
          </div>

          <button className="btn btn-primary" onClick={handleSave} disabled={saving || apiOffline}>
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
              Si está apagado: decisión DISABLED, CI puede continuar.
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
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#8250df' }}>
                  Exigir aprobación CISO para bypass
                </div>
                <div style={{ color: '#656d76', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Si está activo, el mensaje de BLOCKED recuerda solicitar bypass (hub o Pulse).
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
          CI: <code>GET /api/v1/security-gates/check</code>. Si hay bypass APPROVED vigente,{' '}
          <code>allowed=true</code> con decisión <code>BYPASSED</code>.
        </p>
      </div>
    </div>
  );
};
