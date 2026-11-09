import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, LogOut, Mail, Pencil, RotateCw, Trash2, UserPlus, Users, X } from 'lucide-react';
import {
  WorkspaceOverview,
  WorkspaceRole,
  cancelWorkspaceInvitation,
  changeWorkspaceMemberRole,
  fetchWorkspaces,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  renameWorkspace,
  resendWorkspaceInvitation,
  switchWorkspace,
} from '../api/client';
import { useI18n } from '../i18n/I18nProvider';
import { ConfirmModal } from './ConfirmModal';
import '../styles/workspaces.css';

type AssignableRole = Exclude<WorkspaceRole, 'owner'>;

const ROLE_HELP: Record<WorkspaceRole, string> = {
  owner: 'Creó el espacio. Puede hacer todo y no se le puede quitar.',
  admin: 'Gestiona personas, la política del gate y aprueba excepciones.',
  member: 'Conecta repositorios, lanza análisis y gestiona hallazgos.',
  viewer: 'Solo consulta: no puede cambiar nada.',
};

export const WorkspaceSwitcher: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const { t } = useI18n();
  const [data, setData] = useState<WorkspaceOverview | null>(null);
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWorkspaces()
        .then((d) => {
          if (!cancelled) setData(d);
        })
        .catch(() => undefined);
    };
    load();
    const onClear = () => {
      if (!cancelled) setData(null);
    };
    window.addEventListener('sspillowy:workspace-cache-clear', onClear);
    return () => {
      cancelled = true;
      window.removeEventListener('sspillowy:workspace-cache-clear', onClear);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!data || collapsed) return null;
  const { current } = data;

  return (
    <div className="ws-switcher" ref={ref}>
      <button type="button" className="ws-current" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="ws-avatar">{current.name.slice(0, 1).toUpperCase()}</span>
        <span className="ws-current-text">
          <strong title={current.name}>{current.name}</strong>
          <small>{current.role_label}</small>
        </span>
        <ChevronsUpDown size={15} />
      </button>

      {open && (
        <div className="ws-menu" role="menu">
          <div className="ws-menu-label">{t('workspace.yourSpaces')}</div>
          {data.workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              role="menuitem"
              className="ws-menu-item"
              onClick={() => (w.id === current.id ? setOpen(false) : switchWorkspace(w.id))}
            >
              <span className="ws-avatar small">{w.name.slice(0, 1).toUpperCase()}</span>
              <span className="ws-menu-text">
                <span>{w.name}</span>
                <small>
                  {w.role_label} · {w.repositories} {w.repositories === 1 ? t('workspace.repoSingular') : t('workspace.repoPlural')}
                </small>
              </span>
              {w.id === current.id && <Check size={15} />}
            </button>
          ))}
          <div className="ws-menu-sep" />
          <button
            type="button"
            role="menuitem"
            className="ws-menu-item"
            onClick={() => {
              setOpen(false);
              setManaging(true);
            }}
          >
            <Users size={15} />
            <span className="ws-menu-text">
              <span>{current.can_manage ? t('workspace.peopleAccess') : t('workspace.viewAccess')}</span>
            </span>
          </button>
        </div>
      )}

      {managing && <WorkspaceMembersModal data={data} onChange={setData} onClose={() => setManaging(false)} />}
    </div>
  );
};

const WorkspaceMembersModal: React.FC<{
  data: WorkspaceOverview;
  onChange: (d: WorkspaceOverview) => void;
  onClose: () => void;
}> = ({ data, onChange, onClose }) => {
  const { current, members, invitations = [], roles } = data;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('member');
  const [name, setName] = useState(current.name);
  const [editingName, setEditingName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modal de confirmación UI (reemplaza window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => undefined,
  });

  const run = async (fn: () => Promise<WorkspaceOverview | { ok: true; left: true }>, ok?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const out = await fn();
      if ('left' in out) {
        switchWorkspace(null);
        return;
      }
      onChange(out);
      if (ok) setNotice(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    const to = email.trim().toLowerCase();
    if (!to) return;
    void run(async () => {
      const out = await inviteWorkspaceMember(to, role);
      setEmail('');
      return out;
    }, `Invitación enviada por correo a ${to}. Podrá unirse al aceptar el enlace recibido.`);
  };

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const out = await renameWorkspace(name.trim());
      setEditingName(false);
      return out;
    });
  };

  const me = members.find((m) => m.is_me);

  return (
    <>
      <div className="ws-modal-backdrop" role="presentation" onClick={onClose}>
        <div className="ws-modal" role="dialog" aria-label="Personas y acceso" onClick={(e) => e.stopPropagation()}>
          <header className="ws-modal-head">
            {editingName ? (
              <form className="ws-rename" onSubmit={saveName}>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
                <button type="submit" className="btn btn-primary" disabled={busy || name.trim().length < 2}>
                  Guardar
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingName(false)}>
                  Cancelar
                </button>
              </form>
            ) : (
              <div>
                <h2>
                  {current.name}
                  {current.can_manage && (
                    <button type="button" className="ws-icon-btn" onClick={() => setEditingName(true)} aria-label="Cambiar nombre">
                      <Pencil size={14} />
                    </button>
                  )}
                </h2>
                <p>Solo las personas con invitación aceptada ven los repositorios y resultados de este espacio.</p>
              </div>
            )}
            <button type="button" className="ws-icon-btn" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>
          </header>

          {current.can_manage && (
            <form className="ws-invite" onSubmit={invite}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@empresa.com"
                aria-label="Correo de la persona"
                required
              />
              <select value={role} onChange={(e) => setRole(e.target.value as AssignableRole)} aria-label="Rol">
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <UserPlus size={15} /> Enviar invitación
              </button>
            </form>
          )}
          {current.can_manage && <p className="ws-hint">{ROLE_HELP[role]}</p>}

          {error && <p className="ws-error">{error}</p>}
          {notice && <p className="ws-notice">{notice}</p>}

          <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', margin: '0.9rem 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Miembros Activos ({members.length})
          </h3>
          <ul className="ws-members">
            {members.map((m) => {
              const editable = current.can_manage && m.role !== 'owner' && !m.is_me;
              return (
                <li key={m.id}>
                  <span className="ws-avatar small">{(m.name || m.email).slice(0, 1).toUpperCase()}</span>
                  <span className="ws-member-text">
                    <strong>
                      {m.name || m.email}
                      {m.is_me && <em> (tú)</em>}
                    </strong>
                    <small>{m.name ? m.email : null}</small>
                  </span>
                  {editable ? (
                    <select
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => void run(() => changeWorkspaceMemberRole(m.id, e.target.value as AssignableRole))}
                      aria-label={`Rol de ${m.email}`}
                      title={ROLE_HELP[m.role]}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="ws-role" title={ROLE_HELP[m.role]}>
                      {m.role_label}
                    </span>
                  )}
                  {editable && (
                    <button
                      type="button"
                      className="ws-icon-btn danger"
                      disabled={busy}
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Quitar acceso del espacio',
                          message: `¿Estás seguro de quitar el acceso de ${m.email} a este espacio? Dejará de ver sus repositorios y hallazgos.`,
                          confirmText: 'Quitar acceso',
                          isDanger: true,
                          action: () => void run(() => removeWorkspaceMember(m.id)),
                        });
                      }}
                      aria-label={`Quitar a ${m.email}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {invitations.length > 0 && (
            <div style={{ marginTop: '1.2rem', paddingTop: '0.9rem', borderTop: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: '#d97706', margin: '0 0 0.45rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Invitaciones Pendientes ({invitations.length})
              </h3>
              <ul className="ws-members">
                {invitations.map((inv) => (
                  <li key={inv.id}>
                    <span className="ws-avatar small" style={{ background: '#fef3c7', color: '#b45309' }}>
                      <Mail size={13} />
                    </span>
                    <span className="ws-member-text">
                      <strong>{inv.email}</strong>
                      <small>
                        <span style={{ color: '#b45309', fontWeight: 600 }}>Pendiente de aceptación</span> · {inv.role_label}
                      </small>
                    </span>
                    {current.can_manage && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="ws-icon-btn"
                          disabled={busy}
                          title="Reenviar correo de invitación"
                          onClick={() => void run(() => resendWorkspaceInvitation(inv.id), `Invitación reenviada a ${inv.email}`)}
                        >
                          <RotateCw size={14} />
                        </button>
                        <button
                          type="button"
                          className="ws-icon-btn danger"
                          disabled={busy}
                          title="Cancelar invitación"
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Cancelar invitación',
                              message: `¿Deseas cancelar la invitación enviada a ${inv.email}? El enlace dejará de ser válido.`,
                              confirmText: 'Cancelar invitación',
                              isDanger: true,
                              action: () => void run(() => cancelWorkspaceInvitation(inv.id)),
                            });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a
              href="/console/users"
              onClick={(e) => {
                e.preventDefault();
                onClose();
                if (window.location.pathname !== '/console/users') {
                  window.history.pushState({}, '', '/console/users');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }}
              style={{
                fontSize: '0.8rem',
                color: '#0969da',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Users size={14} /> Ir a gestión avanzada de Usuarios y Roles →
            </a>

            {me && me.role !== 'owner' && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: 'Salir de este espacio',
                    message: `¿Salir de ${current.name}? Dejarás de ver sus repositorios y análisis.`,
                    confirmText: 'Salir del espacio',
                    isDanger: true,
                    action: () => void run(() => removeWorkspaceMember(me.id)),
                  });
                }}
              >
                <LogOut size={13} /> Salir
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDanger={confirmDialog.isDanger}
        onConfirm={() => {
          const act = confirmDialog.action;
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          act();
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};
