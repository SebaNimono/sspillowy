import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, LogOut, Pencil, Trash2, UserPlus, Users, X } from 'lucide-react';
import {
  WorkspaceOverview,
  WorkspaceRole,
  changeWorkspaceMemberRole,
  fetchWorkspaces,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  renameWorkspace,
  switchWorkspace,
} from '../api/client';
import { useI18n } from '../i18n/I18nProvider';
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
  const { current, members, roles } = data;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('member');
  const [name, setName] = useState(current.name);
  const [editingName, setEditingName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    }, `Listo. ${to} verá este espacio al entrar con ese correo.`);
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
              <p>Solo las personas de esta lista ven los repositorios y resultados de este espacio.</p>
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
              <UserPlus size={15} /> Invitar
            </button>
          </form>
        )}
        {current.can_manage && <p className="ws-hint">{ROLE_HELP[role]}</p>}

        {error && <p className="ws-error">{error}</p>}
        {notice && <p className="ws-notice">{notice}</p>}

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
                  <small>
                    {m.name ? m.email : null}
                    {!m.joined && <span className="ws-pending">Aún no entra</span>}
                  </small>
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
                      if (window.confirm(`¿Quitar el acceso de ${m.email} a este espacio?`)) {
                        void run(() => removeWorkspaceMember(m.id));
                      }
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

        {me && me.role !== 'owner' && (
          <footer className="ws-modal-foot">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`¿Salir de ${current.name}? Dejarás de ver sus repositorios.`)) {
                  void run(() => removeWorkspaceMember(me.id));
                }
              }}
            >
              <LogOut size={15} /> Salir de este espacio
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};
