import React, { useEffect, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { ApiOfflineBanner } from '../components/ApiOfflineBanner';
import {
  GateBypassRequest,
  SecurityGateOverview,
  SecurityGatePolicy,
  approveGateBypass,
  createGateBypass,
  evaluateSecurityGate,
  fetchSecurityGateOverview,
  rejectGateBypass,
  updateSecurityGate,
} from '../api/client';
import { ArrowRight, Ban, CircleCheck, PauseCircle, RefreshCw, ShieldAlert, Timer } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import PageSkeleton from '../components/PageSkeleton';
import '../styles/gates.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

type Decision = 'PASSED' | 'BLOCKED' | 'BYPASSED' | 'DISABLED';

const DECISION: Record<Decision, { title: string; label: string; icon: React.ReactNode }> = {
  PASSED: {
    title: 'Los despliegues están permitidos',
    label: 'Permitido',
    icon: <CircleCheck size={26} />,
  },
  BLOCKED: {
    title: 'Los despliegues están bloqueados',
    label: 'Bloqueado',
    icon: <Ban size={26} />,
  },
  BYPASSED: {
    title: 'Se permite desplegar por una excepción activa',
    label: 'Con excepción',
    icon: <Timer size={26} />,
  },
  DISABLED: {
    title: 'El gate está apagado',
    label: 'Apagado',
    icon: <PauseCircle size={26} />,
  },
};

const BYPASS_STATUS: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Vencida',
};

const DURATIONS = [
  { hours: 4, label: '4 horas' },
  { hours: 24, label: '1 día' },
  { hours: 72, label: '3 días' },
  { hours: 168, label: '7 días' },
];

const asDecision = (d: string): Decision => (d in DECISION ? (d as Decision) : 'PASSED');

const samePolicy = (a: SecurityGatePolicy, b: SecurityGatePolicy) =>
  a.enabled === b.enabled &&
  a.max_critical_allowed === b.max_critical_allowed &&
  a.max_high_allowed === b.max_high_allowed &&
  a.block_on_secrets === b.block_on_secrets &&
  a.require_ciso_approval_for_bypass === b.require_ciso_approval_for_bypass;

let cached: SecurityGateOverview | null = null;

export const SecurityGatesPage: React.FC<PageProps> = ({ onNavigate, ...headerProps }) => {
  const { t } = useI18n();
  const [data, setDataState] = useState<SecurityGateOverview | null>(cached);
  const [draft, setDraft] = useState<SecurityGatePolicy | null>(cached?.policy ?? null);
  const [apiOffline, setApiOffline] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [reason, setReason] = useState('');
  const [scope, setScope] = useState('');
  const [hours, setHours] = useState(24);
  const requestRef = useRef<HTMLDivElement>(null);

  const setData = (d: SecurityGateOverview, resetDraft = false) => {
    cached = d;
    setDataState(d);
    setDraft((cur) => (resetDraft || !cur ? d.policy : cur));
  };

  const load = (resetDraft = false) =>
    fetchSecurityGateOverview()
      .then((d) => {
        setApiOffline(false);
        setData(d, resetDraft);
      })
      .catch(() => {
        if (!cached) setApiOffline(true);
      });

  useEffect(() => {
    void load(true);
  }, []);

  const notify = (type: ToastMessage['type'], title: string, message: string) =>
    setToast({ id: Date.now().toString(), type, title, message });

  const errorText = (err: unknown) => (err instanceof Error ? err.message : 'No se pudo completar la acción.');

  const reevaluate = async () => {
    setRefreshing(true);
    try {
      await evaluateSecurityGate();
      await load();
    } catch (err) {
      notify('error', 'No se pudo evaluar', errorText(err));
    } finally {
      setRefreshing(false);
    }
  };

  const savePolicy = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await updateSecurityGate(draft);
      await load(true);
      notify('success', 'Reglas guardadas', 'El estado del gate se recalculó con las nuevas reglas.');
    } catch (err) {
      notify('error', 'No se pudieron guardar', errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const requestBypass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 8) {
      notify('error', 'Falta el motivo', 'Explica en al menos 8 caracteres por qué necesitas la excepción.');
      return;
    }
    setBusy(true);
    try {
      const out = await createGateBypass({ reason: reason.trim(), repository_id: scope || null, expires_hours: hours });
      setReason('');
      setShowRequest(false);
      await load();
      notify(
        'success',
        out.status === 'APPROVED' ? 'Excepción activa' : 'Excepción solicitada',
        out.status === 'APPROVED'
          ? 'Se permite desplegar hasta que venza.'
          : 'Un administrador del espacio debe aprobarla.',
      );
    } catch (err) {
      notify('error', 'No se pudo solicitar', errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (b: GateBypassRequest, approve: boolean) => {
    setBusy(true);
    try {
      await (approve ? approveGateBypass(b.id) : rejectGateBypass(b.id));
      await load();
      notify(approve ? 'success' : 'info', approve ? 'Excepción aprobada' : 'Excepción rechazada', b.repository_name || 'Todo el espacio');
    } catch (err) {
      notify('error', 'No se pudo completar', errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const openRequest = () => {
    setShowRequest(true);
    window.setTimeout(() => requestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const check = data?.check;
  const decision = asDecision(check?.decision || 'PASSED');
  const info = DECISION[decision];
  const pending = data?.bypasses.filter((b) => b.status === 'PENDING') ?? [];
  const history = data?.bypasses.filter((b) => b.status !== 'PENDING').slice(0, 8) ?? [];
  const readOnly = !data?.can_manage;
  const dirty = Boolean(data && draft && !samePolicy(data.policy, draft));
  const blockingReasons = check?.reasons.filter((r) => !r.startsWith('Para continuar')) ?? [];

  return (
    <div className="gt-page">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header
        title={t('pages.gates.title')}
        subtitle={t('pages.gates.subtitle')}
        onNavigate={onNavigate}
        {...headerProps}
      />

      {apiOffline && <ApiOfflineBanner />}

      {!data && !apiOffline && <PageSkeleton variant="panel" rows={5} />}

      {data && check && (
        <>
          <section className={`gt-status is-${decision.toLowerCase()}`}>
            <div className="gt-status-main">
              <span className="gt-status-icon">{info.icon}</span>
              <div>
                <h2>{info.title}</h2>
                <ul className="gt-reasons">
                  {blockingReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <div className="gt-status-actions">
                {decision === 'BLOCKED' && data.can_write && (
                  <button type="button" className="btn btn-secondary" onClick={openRequest}>
                    Pedir excepción
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={reevaluate} disabled={refreshing}>
                  <RefreshCw size={14} className={refreshing ? 'spin' : undefined} />
                  {refreshing ? 'Evaluando…' : 'Volver a evaluar'}
                </button>
              </div>
            </div>

            <div className="gt-metrics">
              <Metric
                label="Vulnerabilidades críticas abiertas"
                value={check.open_critical}
                limit={`máximo ${check.max_critical_allowed}`}
                over={check.open_critical > check.max_critical_allowed}
              />
              <Metric
                label="Vulnerabilidades altas abiertas"
                value={check.open_high}
                limit={`máximo ${check.max_high_allowed}`}
                over={check.open_high > check.max_high_allowed}
              />
              <Metric
                label="Secretos expuestos"
                value={check.open_secrets}
                limit={check.block_on_secrets ? 'bloquea si hay alguno' : 'no bloquea'}
                over={check.block_on_secrets && check.open_secrets > 0}
              />
            </div>
          </section>

          <section className="gt-card">
            <header>
              <h3>Estado por repositorio</h3>
              <span className="gt-muted">El pipeline de cada repositorio recibe esta respuesta</span>
            </header>
            {data.repos.length === 0 ? (
              <div className="gt-empty">
                Aún no hay repositorios.{' '}
                <button type="button" className="gt-link" onClick={() => onNavigate?.('repositories')}>
                  Agregar uno
                </button>
              </div>
            ) : (
              <table className="gt-table">
                <thead>
                  <tr>
                    <th>Repositorio</th>
                    <th>Críticas</th>
                    <th>Altas</th>
                    <th>Secretos</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.repos.map((r) => (
                    <tr key={r.id}>
                      <td className="gt-strong">{r.name}</td>
                      <td className={r.open_critical > check.max_critical_allowed ? 'gt-over' : undefined}>{r.open_critical}</td>
                      <td className={r.open_high > check.max_high_allowed ? 'gt-over' : undefined}>{r.open_high}</td>
                      <td className={check.block_on_secrets && r.open_secrets > 0 ? 'gt-over' : undefined}>{r.open_secrets}</td>
                      <td>
                        <span className={`gt-pill is-${r.decision.toLowerCase()}`}>{DECISION[asDecision(r.decision)].label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="gt-columns">
            {draft && (
              <section className="gt-card">
                <header>
                  <h3>Reglas</h3>
                  {readOnly && <span className="gt-muted">Solo un administrador puede cambiarlas</span>}
                </header>

                <label className="gt-rule">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    disabled={readOnly}
                    onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                  />
                  <span>
                    <strong>Gate activo</strong>
                    <small>Si lo apagas, ningún despliegue se bloquea.</small>
                  </span>
                </label>

                <fieldset className="gt-rules" disabled={readOnly || !draft.enabled}>
                  <div className="gt-rule">
                    <span>
                      <strong>Bloquear con más de</strong>
                      <small>vulnerabilidades críticas abiertas</small>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={draft.max_critical_allowed}
                      onChange={(e) => setDraft({ ...draft, max_critical_allowed: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    />
                  </div>
                  <div className="gt-rule">
                    <span>
                      <strong>Bloquear con más de</strong>
                      <small>vulnerabilidades altas abiertas</small>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.max_high_allowed}
                      onChange={(e) => setDraft({ ...draft, max_high_allowed: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    />
                  </div>
                  <label className="gt-rule">
                    <input
                      type="checkbox"
                      checked={draft.block_on_secrets}
                      onChange={(e) => setDraft({ ...draft, block_on_secrets: e.target.checked })}
                    />
                    <span>
                      <strong>Bloquear si hay secretos expuestos</strong>
                      <small>Contraseñas, claves o tokens encontrados en el código.</small>
                    </span>
                  </label>
                  <label className="gt-rule">
                    <input
                      type="checkbox"
                      checked={draft.require_ciso_approval_for_bypass}
                      onChange={(e) => setDraft({ ...draft, require_ciso_approval_for_bypass: e.target.checked })}
                    />
                    <span>
                      <strong>Las excepciones necesitan aprobación</strong>
                      <small>Si lo desmarcas, una excepción se activa en cuanto alguien la pide.</small>
                    </span>
                  </label>
                </fieldset>

                {!readOnly && (
                  <div className="gt-actions">
                    <button type="button" className="btn btn-secondary" disabled={!dirty || saving} onClick={() => setDraft(data.policy)}>
                      Descartar
                    </button>
                    <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={savePolicy}>
                      {saving ? 'Guardando…' : 'Guardar reglas'}
                    </button>
                  </div>
                )}
              </section>
            )}

            <section className="gt-card" ref={requestRef}>
              <header>
                <h3>Excepciones</h3>
                {data.can_write && !showRequest && (
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRequest(true)}>
                    Pedir excepción
                  </button>
                )}
              </header>
              <p className="gt-muted gt-intro">
                Permiten desplegar por un tiempo limitado aunque el gate esté bloqueando, por ejemplo para un arreglo urgente.
              </p>

              {showRequest && (
                <form className="gt-request" onSubmit={requestBypass}>
                  <label>
                    <span>Motivo</span>
                    <textarea
                      value={reason}
                      rows={3}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ej.: arreglo urgente en producción; la vulnerabilidad se corrige el lunes."
                      required
                    />
                  </label>
                  <div className="gt-request-row">
                    <label>
                      <span>Para</span>
                      <select value={scope} onChange={(e) => setScope(e.target.value)}>
                        <option value="">Todo el espacio</option>
                        {data.repos.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Durante</span>
                      <select value={hours} onChange={(e) => setHours(parseInt(e.target.value, 10))}>
                        {DURATIONS.map((d) => (
                          <option key={d.hours} value={d.hours}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="gt-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowRequest(false)} disabled={busy}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                      {data.policy.require_ciso_approval_for_bypass ? 'Enviar solicitud' : 'Activar excepción'}
                    </button>
                  </div>
                </form>
              )}

              {pending.length > 0 && (
                <>
                  <h4 className="gt-subhead">Esperando aprobación</h4>
                  <ul className="gt-list">
                    {pending.map((b) => (
                      <li key={b.id}>
                        <div>
                          <strong>{b.repository_name || 'Todo el espacio'}</strong>
                          <p>{b.reason}</p>
                          <small>
                            {b.requested_by} · {new Date(b.created_at).toLocaleString()}
                          </small>
                        </div>
                        {data.can_manage && (
                          <div className="gt-list-actions">
                            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => decide(b, true)}>
                              Aprobar
                            </button>
                            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => decide(b, false)}>
                              Rechazar
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {history.length > 0 && (
                <>
                  <h4 className="gt-subhead">Historial</h4>
                  <ul className="gt-list is-compact">
                    {history.map((b) => (
                      <li key={b.id}>
                        <div>
                          <strong>{b.repository_name || 'Todo el espacio'}</strong>
                          <p>{b.reason}</p>
                          <small>
                            {b.requested_by}
                            {b.expires_at && b.status === 'APPROVED' ? ` · vence ${new Date(b.expires_at).toLocaleString()}` : ''}
                          </small>
                        </div>
                        <span className={`gt-pill is-${b.status.toLowerCase()}`}>{BYPASS_STATUS[b.status] || b.status}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {!showRequest && pending.length === 0 && history.length === 0 && (
                <div className="gt-empty">No hay excepciones.</div>
              )}
            </section>
          </div>

          <section className="gt-card gt-pipeline">
            <ShieldAlert size={20} />
            <div>
              <strong>Usa este gate en tu pipeline</strong>
              <p className="gt-muted">
                Tu pipeline consulta el gate antes de desplegar y se detiene si está bloqueado. Necesita la clave de este
                espacio.
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => onNavigate?.('integrations')}>
              Configurar <ArrowRight size={14} />
            </button>
          </section>
        </>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: number; limit: string; over: boolean }> = ({ label, value, limit, over }) => (
  <div className={`gt-metric ${over ? 'is-over' : ''}`}>
    <span className="gt-metric-value">{value}</span>
    <span className="gt-metric-label">{label}</span>
    <span className="gt-metric-limit">{limit}</span>
  </div>
);
