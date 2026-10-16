import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, LayoutDashboard, Lock, MoreHorizontal, Pencil, Plus, Search, Star, Trash2, Users } from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { DashboardViewModal } from '../components/DashboardViewModal';
import { timeAgo } from '../utils/timeAgo';
import {
  DashboardView,
  DashboardViewInput,
  createDashboardView,
  deleteDashboardView,
  duplicateDashboardView,
  fetchDashboardViews,
  toggleDashboardStar,
  updateDashboardView,
} from '../api/client';
import { DashboardPage } from './DashboardPage';
import PageSkeleton from '../components/PageSkeleton';
import '../styles/dashlist.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

type ListFilter = 'all' | 'starred' | 'mine' | 'team';

const GENERAL_ID = 'general';
const SELECTED_KEY = 'sspillowy_dashboard_view';
const RECENT_PREFIX = 'sspillowy_dashboard_recent:';

interface RecentEntry {
  id: string;
  at: number;
}

function loadRecent(userKey: string): RecentEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_PREFIX + userKey) || '[]') as RecentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const RiskPosturePage: React.FC<PageProps> = (props) => {
  const { onNavigate, ...headerProps } = props;
  const userKey = props.user?.email?.toLowerCase() ?? 'anon';
  const [views, setViews] = useState<DashboardView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(() => localStorage.getItem(SELECTED_KEY) || GENERAL_ID);
  const [recent, setRecent] = useState<RecentEntry[]>(() => loadRecent(userKey));
  const [filter, setFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<DashboardView | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<DashboardView | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = (type: ToastMessage['type'], title: string, message: string) =>
    setToast({ id: Date.now().toString(), type, title, message });

  const load = useCallback(async () => {
    try {
      setViews(await fetchDashboardViews());
    } catch (err) {
      notify('error', 'No se pudieron cargar los dashboards', err instanceof Error ? err.message : String(err));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = (id: string | null) => {
    setSelected(id);
    setMenuFor(null);
    if (id) {
      localStorage.setItem(SELECTED_KEY, id);
      const next = [{ id, at: Date.now() }, ...recent.filter((r) => r.id !== id)].slice(0, 6);
      setRecent(next);
      localStorage.setItem(RECENT_PREFIX + userKey, JSON.stringify(next));
    } else {
      localStorage.removeItem(SELECTED_KEY);
    }
  };

  const replaceView = useCallback((v: DashboardView) => setViews((prev) => prev.map((x) => (x.id === v.id ? v : x))), []);

  const activeView = selected && selected !== GENERAL_ID ? views.find((v) => v.id === selected) ?? null : null;

  useEffect(() => {
    if (loaded && selected && selected !== GENERAL_ID && !activeView) setSelected(GENERAL_ID);
  }, [loaded, selected, activeView]);

  const save = async (body: DashboardViewInput) => {
    setSaving(true);
    try {
      if (editing === 'new') {
        const created = await createDashboardView(body);
        setViews((prev) => [created, ...prev]);
        setEditing(null);
        open(created.id);
      } else if (editing) {
        replaceView(await updateDashboardView(editing.id, body));
        setEditing(null);
        notify('success', 'Dashboard actualizado', 'Los cambios ya se aplicaron.');
      }
    } catch (err) {
      notify('error', 'No se pudo guardar', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const star = async (v: DashboardView) => {
    try {
      replaceView(await toggleDashboardStar(v.id));
    } catch (err) {
      notify('error', 'No se pudo marcar', err instanceof Error ? err.message : String(err));
    }
  };

  const duplicate = async (v: DashboardView) => {
    setMenuFor(null);
    try {
      const copy = await duplicateDashboardView(v.id);
      setViews((prev) => [copy, ...prev]);
      notify('success', 'Dashboard duplicado', `Se creó «${copy.name}».`);
    } catch (err) {
      notify('error', 'No se pudo duplicar', err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await deleteDashboardView(deleting.id);
      setViews((prev) => prev.filter((v) => v.id !== deleting.id));
      notify('success', 'Dashboard eliminado', `«${deleting.name}» ya no está en la lista.`);
    } catch (err) {
      notify('error', 'No se pudo eliminar', err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(null);
    }
  };

  const counts = useMemo(
    () => ({
      all: views.length + 1,
      starred: views.filter((v) => v.starred).length,
      mine: views.filter((v) => v.owner_email === userKey).length,
      team: views.filter((v) => v.shared && v.owner_email !== userKey).length,
    }),
    [views, userKey],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return views.filter((v) => {
      if (filter === 'starred' && !v.starred) return false;
      if (filter === 'mine' && v.owner_email !== userKey) return false;
      if (filter === 'team' && (!v.shared || v.owner_email === userKey)) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.repository_names.some((n) => n.toLowerCase().includes(q))
      );
    });
  }, [views, filter, query, userKey]);

  const showGeneral = filter === 'all' && (!query.trim() || 'general organización'.includes(query.trim().toLowerCase()));

  const recentCards = recent
    .map((r) => ({ entry: r, view: r.id === GENERAL_ID ? null : views.find((v) => v.id === r.id) }))
    .filter((r) => r.entry.id === GENERAL_ID || r.view)
    .slice(0, 3);

  if (!loaded && selected && selected !== GENERAL_ID) {
    return (
      <div>
        <Header title="Risk Posture" subtitle="" onNavigate={onNavigate} {...headerProps} />
        <PageSkeleton variant="dashboard" />
      </div>
    );
  }

  if (selected && (selected === GENERAL_ID || activeView)) {
    return (
      <DashboardPage
        key={selected}
        {...props}
        view={activeView}
        onOpenList={() => open(null)}
        onViewSaved={replaceView}
      />
    );
  }

  const scopeText = (v: DashboardView) =>
    v.repository_names.length === 0
      ? 'Toda la organización'
      : v.repository_names.length <= 2
        ? v.repository_names.join(', ')
        : `${v.repository_names.slice(0, 2).join(', ')} +${v.repository_names.length - 2}`;

  const lists: { id: ListFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Todos', icon: <LayoutDashboard size={14} /> },
    { id: 'starred', label: 'Favoritos', icon: <Star size={14} /> },
    { id: 'mine', label: 'Creados por mí', icon: <Pencil size={14} /> },
    { id: 'team', label: 'Del equipo', icon: <Users size={14} /> },
  ];

  return (
    <div onClick={() => setMenuFor(null)}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header
        title="Risk Posture"
        subtitle="Tus dashboards de seguridad: el General de toda la organización y los que crees por producto, equipo o cliente."
        onNavigate={onNavigate}
        {...headerProps}
      />

      <div className="dl-top">
        <label className="dl-search dl-search--wide">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, descripción o repositorio" />
        </label>
        <button type="button" className="btn btn-primary dl-new" onClick={() => setEditing('new')}>
          <Plus size={15} />
          <span>Nuevo dashboard</span>
        </button>
      </div>

      <div className="dl-layout">
        <aside className="dl-lists">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`dl-list-btn ${filter === l.id ? 'is-active' : ''}`}
              onClick={() => setFilter(l.id)}
            >
              {l.icon}
              <span>{l.label}</span>
              <em>{counts[l.id]}</em>
            </button>
          ))}
        </aside>

        <div className="dl-main">
          {recentCards.length > 0 && filter === 'all' && !query.trim() && (
            <section>
              <h3 className="dl-h">Vistos recientemente</h3>
              <div className="dl-recent">
                {recentCards.map(({ entry, view }) => (
                  <button key={entry.id} type="button" className="dl-card" onClick={() => open(entry.id)}>
                    <strong>{view ? view.name : 'General'}</strong>
                    <span>{view ? scopeText(view) : 'Toda la organización'}</span>
                    <em>Visto {timeAgo(entry.at)}</em>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="card dl-table-card">
            {!loaded ? (
              <PageSkeleton variant="table" rows={5} embedded />
            ) : (
            <table className="dl-table">
              <thead>
                <tr>
                  <th />
                  <th>Nombre</th>
                  <th>Alcance</th>
                  <th>Periodo</th>
                  <th>Autor</th>
                  <th>Modificado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {showGeneral && (
                  <tr onClick={() => open(GENERAL_ID)}>
                    <td className="dl-star-cell">
                      <LayoutDashboard size={15} className="dl-general-icon" />
                    </td>
                    <td>
                      <strong className="dl-name">General</strong>
                      <span className="dl-desc">La vista de toda la organización. Siempre disponible.</span>
                    </td>
                    <td>
                      <span className="dl-scope">Toda la organización</span>
                    </td>
                    <td className="dl-muted">—</td>
                    <td className="dl-muted">SSPILLOWY</td>
                    <td className="dl-muted">—</td>
                    <td>
                      <span className="dl-badge">Predeterminado</span>
                    </td>
                  </tr>
                )}
                {filtered.map((v) => (
                  <tr key={v.id} onClick={() => open(v.id)}>
                    <td className="dl-star-cell" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`dl-star ${v.starred ? 'is-on' : ''}`}
                        onClick={() => star(v)}
                        aria-label={v.starred ? 'Quitar de favoritos' : 'Marcar como favorito'}
                      >
                        <Star size={15} />
                      </button>
                    </td>
                    <td>
                      <strong className="dl-name">
                        {v.name}
                        {!v.shared && <Lock size={12} className="dl-lock" aria-label="Solo tú lo ves" />}
                      </strong>
                      {v.description && <span className="dl-desc">{v.description}</span>}
                    </td>
                    <td>
                      <span className="dl-scope" title={v.repository_names.join(', ')}>
                        {scopeText(v)}
                      </span>
                    </td>
                    <td className="dl-muted">{v.range_days} días</td>
                    <td className="dl-muted">{v.owner_email === userKey ? 'Tú' : v.owner_email ?? '—'}</td>
                    <td className="dl-muted">{timeAgo(v.updated_at)}</td>
                    <td className="dl-menu-cell" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="dl-icon-btn" onClick={() => setMenuFor(menuFor === v.id ? null : v.id)} aria-label="Acciones">
                        <MoreHorizontal size={16} />
                      </button>
                      {menuFor === v.id && (
                        <div className="dl-menu">
                          {v.can_edit && (
                            <button type="button" onClick={() => { setMenuFor(null); setEditing(v); }}>
                              <Pencil size={14} /> Editar
                            </button>
                          )}
                          <button type="button" onClick={() => duplicate(v)}>
                            <Copy size={14} /> Duplicar
                          </button>
                          {v.can_edit && (
                            <button type="button" className="is-danger" onClick={() => { setMenuFor(null); setDeleting(v); }}>
                              <Trash2 size={14} /> Eliminar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
            {loaded && !showGeneral && filtered.length === 0 && (
              <div className="dl-none">
                {filter === 'starred' ? 'Marca un dashboard con la estrella para tenerlo a mano.' : 'No hay dashboards que coincidan.'}
              </div>
            )}
            {loaded && views.length === 0 && filter === 'all' && !query.trim() && (
              <div className="dl-hint">
                Crea un dashboard por producto, equipo o cliente: eliges sus repositorios y verás las mismas métricas solo de ese alcance.
              </div>
            )}
          </section>
        </div>
      </div>

      {editing && (
        <DashboardViewModal
          view={editing === 'new' ? null : editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}

      <ConfirmModal
        open={!!deleting}
        title="Eliminar dashboard"
        message={`Se eliminará «${deleting?.name ?? ''}» para todo el equipo. Los datos de seguridad no se borran.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
};
