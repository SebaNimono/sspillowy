import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { DashboardView, DashboardViewInput, Repository, fetchRepositories } from '../api/client';
import { loadDashboardConfig } from '../config/dashboardConfig';

interface DashboardViewModalProps {
  /** null = crear uno nuevo */
  view: DashboardView | null;
  saving: boolean;
  onClose: () => void;
  onSave: (body: DashboardViewInput) => void;
}

export const DashboardViewModal: React.FC<DashboardViewModalProps> = ({ view, saving, onClose, onSave }) => {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [name, setName] = useState(view?.name ?? '');
  const [description, setDescription] = useState(view?.description ?? '');
  const [allRepos, setAllRepos] = useState(!view || view.repository_ids.length === 0);
  const [selected, setSelected] = useState<Set<string>>(new Set(view?.repository_ids ?? []));
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(view?.range_days ?? 30);
  const [shared, setShared] = useState(view?.shared ?? true);
  const [copyGeneral, setCopyGeneral] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchRepositories()
      .then((r) => setRepos([...r].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setRepos([]));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? repos.filter((r) => r.name.toLowerCase().includes(q)) : repos;
  }, [repos, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const invalid = !name.trim() || (!allRepos && selected.size === 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    const body: DashboardViewInput = {
      name: name.trim(),
      description: description.trim(),
      repository_ids: allRepos ? [] : [...selected],
      range_days: rangeDays,
      shared,
    };
    if (!view && copyGeneral) body.config = loadDashboardConfig() as unknown as DashboardView['config'];
    onSave(body);
  };

  return (
    <div className="dl-modal-backdrop" role="presentation" onClick={onClose}>
      <form className="dl-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} aria-label="Dashboard">
        <header className="dl-modal-head">
          <h2>{view ? 'Editar dashboard' : 'Nuevo dashboard'}</h2>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <label className="dl-field">
          <span>Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ej.: Backend de pagos" autoFocus />
        </label>
        <label className="dl-field">
          <span>Descripción (opcional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={400}
            placeholder="Para qué sirve o quién lo usa"
          />
        </label>

        <fieldset className="dl-field">
          <span>Alcance</span>
          <div className="dl-scope-options">
            <label className={allRepos ? 'is-active' : ''}>
              <input type="radio" checked={allRepos} onChange={() => setAllRepos(true)} />
              <strong>Toda la organización</strong>
              <em>Incluye también los repositorios que agregues después.</em>
            </label>
            <label className={!allRepos ? 'is-active' : ''}>
              <input type="radio" checked={!allRepos} onChange={() => setAllRepos(false)} />
              <strong>Repositorios seleccionados</strong>
              <em>Ideal para un producto, un equipo o un cliente.</em>
            </label>
          </div>
          {!allRepos && (
            <div className="dl-repo-picker">
              <label className="dl-search">
                <Search size={14} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar repositorio" />
              </label>
              <ul>
                {shown.map((r) => (
                  <li key={r.id}>
                    <label>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                      <span>{r.name}</span>
                      <em>{r.total_findings} activos</em>
                    </label>
                  </li>
                ))}
                {shown.length === 0 && <li className="dl-muted">No hay repositorios que coincidan.</li>}
              </ul>
              <span className="dl-muted">{selected.size} seleccionado(s)</span>
            </div>
          )}
        </fieldset>

        <div className="dl-field-row">
          <label className="dl-field">
            <span>Periodo por defecto</span>
            <select value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value) as 7 | 30 | 90)}>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
            </select>
          </label>
          <label className="dl-field">
            <span>Visibilidad</span>
            <select value={shared ? 'team' : 'me'} onChange={(e) => setShared(e.target.value === 'team')}>
              <option value="team">Todo el equipo</option>
              <option value="me">Solo yo</option>
            </select>
          </label>
        </div>

        {!view && (
          <label className="dl-check">
            <input type="checkbox" checked={copyGeneral} onChange={(e) => setCopyGeneral(e.target.checked)} />
            <span>Copiar los bloques visibles y umbrales del dashboard General</span>
          </label>
        )}

        <footer className="dl-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={invalid || saving}>
            {saving ? 'Guardando…' : view ? 'Guardar cambios' : 'Crear y abrir'}
          </button>
        </footer>
      </form>
    </div>
  );
};
