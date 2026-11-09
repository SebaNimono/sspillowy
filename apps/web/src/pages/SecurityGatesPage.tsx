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
  revokeGateBypass,
  updateSecurityGate,
} from '../api/client';
import { ArrowRight, Ban, CircleCheck, Clock, PauseCircle, RefreshCw, ShieldAlert, Timer, XCircle } from 'lucide-react';
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
  { hours: 24, label: '1 día (24 h)' },
  { hours: 72, label: '3 días (72 h)' },
  { hours: 168, label: '7 días (168 h)' },
];

const asDecision = (d: string): Decision => (d in DECISION ? (d as Decision) : 'PASSED');

const samePolicy = (a: SecurityGatePolicy, b: SecurityGatePolicy) =>
  a.enabled === b.enabled &&
  a.max_critical_allowed === b.max_critical_allowed &&
  a.max_high_allowed === b.max_high_allowed &&
  a.block_on_secrets === b.block_on_secrets &&
  a.require_ciso_approval_for_bypass === b.require_ciso_approval_for_bypass;

function isBypassActive(b: GateBypassRequest): boolean {
  if (b.status !== 'APPROVED') return false;
  if (!b.expires_at) return true;
  return new Date(b.expires_at).getTime() > Date.now();
}

function formatRemainingTime(expiresAt?: string | null): string {
  if (!expiresAt) return 'Sin vencimiento';
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Vencida';
  const totalMinutes = Math.ceil(diffMs / 60000);
  if (totalMinutes < 60) return `Quedan ${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours < 48) {
    return mins > 0 ? `Quedan ${hours} h ${mins} min` : `Quedan ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `Quedan ${days} d ${remHours} h` : `Quedan ${days} días`;
}

function formatRequestedDuration(b: GateBypassRequest): string | null {
  if (!b.created_at || !b.expires_at) return null;
  const hours = Math.round((new Date(b.expires_at).getTime() - new Date(b.created_at).getTime()) / 3600000);
  if (hours <= 0) return null;
  if (hours === 24) return '24 h (1 día)';
  if (hours === 72) return '72 h (3 días)';
  if (hours === 168) return '168 h (7 días)';
  return `${hours} h`;
}

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
  const [busyBypassId, setBusyBypassId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'approve' | 'reject' | 'revoke' | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
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
    setBusyBypassId(b.id);
    setBusyAction(approve ? 'approve' : 'reject');
    try {
      const note = (decisionNotes[b.id] || '').trim() || undefined;
      await (approve ? approveGateBypass(b.id, note) : rejectGateBypass(b.id, note));
      setDecisionNotes((prev) => {
        const next = { ...prev };
        delete next[b.id];
        return next;
      });
      await load();
      notify(
        approve ? 'success' : 'info',
        approve ? 'Excepción aprobada' : 'Excepción rechazada',
        b.repository_name || 'Todo el espacio',
      );
    } catch (err) {
      notify('error', 'No se pudo completar', errorText(err));
    } finally {
      setBusy(false);
      setBusyBypassId(null);
      setBusyAction(null);
    }
  };

  const handleRevoke = async (b: GateBypassRequest) => {
    setBusy(true);
    setBusyBypassId(b.id);
    setBusyAction('revoke');
    try {
      const wasPending = b.status === 'PENDING';
      await revokeGateBypass(b.id, wasPending ? 'Cancelada por el solicitante' : 'Revocada manualmente desde Security Gates');
      await load();
      notify(
        'info',
        wasPending ? 'Solicitud cancelada' : 'Excepción revocada',
        wasPending
          ? 'La solicitud de excepción fue retirada.'
          : `El gate volvió a aplicarse sobre ${b.repository_name || 'todo el espacio'}.`,
      );
    } catch (err) {
      notify('error', 'No se pudo revocar', errorText(err));
    } finally {
      setBusy(false);
      setBusyBypassId(null);
      setBusyAction(null);
    }
  };

  const openRequest = (repoId = '') => {
    setScope(repoId);
    setShowRequest(true);
    window.setTimeout(() => requestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const check = data?.check;
  const decision = asDecision(check?.decision || 'PASSED');
  const info = DECISION[decision];
  const allBypasses = data?.bypasses ?? [];
  const activeBypasses = allBypasses.filter(isBypassActive);
  const pending = allBypasses.filter((b) => b.status === 'PENDING');
  const history = allBypasses.filter((b) => b.status !== 'PENDING' && !isBypassActive(b)).slice(0, 10);
  const readOnly = !data?.can_manage;
  const dirty = Boolean(data && draft && !samePolicy(data.policy, draft));
  const blockingReasons = check?.reasons.filter((r) => !r.startsWith('Para continuar')) ?? [];
  const currentUserEmail = (headerProps.user?.email || '').toLowerCase();

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
                  <button type="button" className="btn btn-secondary" onClick={() => openRequest('')}>
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
                    {data.can_write && <th className="gt-col-action">Acción</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.repos.map((r) => {
                    const repoDecision = asDecision(r.decision);
                    return (
                      <tr key={r.id}>
                        <td className="gt-strong">{r.name}</td>
                        <td className={r.open_critical > check.max_critical_allowed ? 'gt-over' : undefined}>{r.open_critical}</td>
                        <td className={r.open_high > check.max_high_allowed ? 'gt-over' : undefined}>{r.open_high}</td>
                        <td className={check.block_on_secrets && r.open_secrets > 0 ? 'gt-over' : undefined}>{r.open_secrets}</td>
                        <td>
                          <span className={`gt-pill is-${repoDecision.toLowerCase()}`}>{DECISION[repoDecision].label}</span>
                        </td>
                        {data.can_write && (
                          <td className="gt-col-action">
                            {repoDecision === 'BLOCKED' ? (
                              <button
                                type="button"
                                className="gt-link"
                                onClick={() => openRequest(r.id)}
                              >
                                Pedir excepción
                              </button>
                            ) : (
                              <span className="gt-muted">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
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
                    <span>Motivo (mínimo 8 caracteres)</span>
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
                      <span>Alcance</span>
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
                      <span>Duración</span>
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
                      {busy
                        ? 'Enviando…'
                        : data.policy.require_ciso_approval_for_bypass
                          ? 'Enviar solicitud'
                          : 'Activar excepción'}
                    </button>
                  </div>
                </form>
              )}

              {activeBypasses.length > 0 && (
                <div className="gt-section-block">
                  <h4 className="gt-subhead">Excepciones activas ({activeBypasses.length})</h4>
                  <ul className="gt-list">
                    {activeBypasses.map((b) => {
                      const isThisBusy = busyBypassId === b.id;
                      return (
                        <li key={b.id} className="gt-bypass-active-item">
                          <div className="gt-bypass-body">
                            <div className="gt-bypass-top">
                              <strong>{b.repository_name || 'Todo el espacio'}</strong>
                              <span className="gt-pill is-bypassed">
                                <Clock size={11} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
                                {formatRemainingTime(b.expires_at)}
                              </span>
                            </div>
                            <p>{b.reason}</p>
                            {b.decision_note && (
                              <small className="gt-decision-note">Nota: &ldquo;{b.decision_note}&rdquo;</small>
                            )}
                            <small>
                              Solicitada por {b.requested_by}
                              {b.decided_by ? ` · Aprobada por ${b.decided_by}` : ''}
                              {b.expires_at ? ` · Vence ${new Date(b.expires_at).toLocaleString()}` : ''}
                            </small>
                          </div>
                          {data.can_manage && (
                            <div className="gt-list-actions">
                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={busy}
                                onClick={() => handleRevoke(b)}
                                title="Terminar esta excepción inmediatamente"
                              >
                                <XCircle size={13} />
                                {isThisBusy && busyAction === 'revoke' ? 'Revocando…' : 'Revocar'}
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {pending.length > 0 && (
                <div className="gt-section-block">
                  <h4 className="gt-subhead">Esperando aprobación ({pending.length})</h4>
                  <ul className="gt-list">
                    {pending.map((b) => {
                      const durationLabel = formatRequestedDuration(b);
                      const isThisBusy = busyBypassId === b.id;
                      const canCancelOwn = !data.can_manage && currentUserEmail && b.requested_by.toLowerCase() === currentUserEmail;
                      return (
                        <li key={b.id} className="gt-bypass-pending-item">
                          <div className="gt-bypass-body">
                            <div className="gt-bypass-top">
                              <strong>{b.repository_name || 'Todo el espacio'}</strong>
                              {durationLabel && <span className="gt-pill">Plazo: {durationLabel}</span>}
                            </div>
                            <p>{b.reason}</p>
                            <small>
                              {b.requested_by} · {new Date(b.created_at).toLocaleString()}
                            </small>
                            {data.can_manage && (
                              <div className="gt-decision-box">
                                <input
                                  type="text"
                                  className="gt-note-input"
                                  placeholder="Nota opcional al aprobar o rechazar…"
                                  value={decisionNotes[b.id] || ''}
                                  disabled={busy}
                                  onChange={(e) =>
                                    setDecisionNotes((prev) => ({
                                      ...prev,
                                      [b.id]: e.target.value,
                                    }))
                                  }
                                />
                                <div className="gt-list-actions">
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={busy}
                                    onClick={() => decide(b, true)}
                                  >
                                    {isThisBusy && busyAction === 'approve' ? 'Aprobando…' : 'Aprobar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    disabled={busy}
                                    onClick={() => decide(b, false)}
                                  >
                                    {isThisBusy && busyAction === 'reject' ? 'Rechazando…' : 'Rechazar'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          {canCancelOwn && (
                            <div className="gt-list-actions">
                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={busy}
                                onClick={() => handleRevoke(b)}
                              >
                                {isThisBusy && busyAction === 'revoke' ? 'Cancelando…' : 'Cancelar'}
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {history.length > 0 && (
                <div className="gt-section-block">
                  <h4 className="gt-subhead">Historial</h4>
                  <ul className="gt-list is-compact">
                    {history.map((b) => (
                      <li key={b.id}>
                        <div className="gt-bypass-body">
                          <strong>{b.repository_name || 'Todo el espacio'}</strong>
                          <p>{b.reason}</p>
                          {b.decision_note && (
                            <small className="gt-decision-note">Nota: &ldquo;{b.decision_note}&rdquo;</small>
                          )}
                          <small>
                            Solicitada por {b.requested_by}
                            {b.decided_by ? ` · Decidida por ${b.decided_by}` : ''}
                            {b.decided_at
                              ? ` · ${new Date(b.decided_at).toLocaleString()}`
                              : b.expires_at
                                ? ` · Venció ${new Date(b.expires_at).toLocaleString()}`
                                : ''}
                          </small>
                        </div>
                        <span className={`gt-pill is-${b.status.toLowerCase()}`}>{BYPASS_STATUS[b.status] || b.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!showRequest && activeBypasses.length === 0 && pending.length === 0 && history.length === 0 && (
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
