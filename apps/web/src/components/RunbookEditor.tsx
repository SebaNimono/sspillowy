import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, X, Zap } from 'lucide-react';
import { Repository, RunbookAction, RunbookInput, RunbookTrigger, fetchRepositories } from '../api/client';
import { ACTION_META, EMPTY_ACTION, TRIGGER_META, WEBHOOK_KIND_LABEL } from '../config/runbookTemplates';
import { SEVERITY_LABEL } from '../utils/findingGroups';
import '../styles/dashlist.css';

interface RunbookEditorProps {
  initial: RunbookInput;
  editing: boolean;
  saving: boolean;
  securityTeam: string[];
  emailReady: boolean;
  onClose: () => void;
  onSave: (body: RunbookInput) => void;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TRIGGERS = Object.keys(TRIGGER_META) as RunbookTrigger[];
const SEVERITY_TRIGGERS: RunbookTrigger[] = ['NEW_FINDING', 'SLA_BREACHED'];

const allowed = (type: RunbookAction['type'], trigger: RunbookTrigger) => {
  const only = ACTION_META[type].onlyFor;
  return !only || only.includes(trigger);
};

function actionProblem(a: RunbookAction): string | null {
  if (a.type === 'email') {
    if (!a.security_team && a.to.length === 0) return 'Añade al menos un destinatario.';
    const bad = a.to.find((e) => !EMAIL_RE.test(e));
    return bad ? `Correo no válido: ${bad}` : null;
  }
  if (a.type === 'webhook') return /^https:\/\/\S+$/.test(a.url.trim()) ? null : 'Pega la URL del webhook (empieza con https://).';
  if (a.type === 'assign_owner') return EMAIL_RE.test(a.email.trim()) ? null : 'Indica el correo del responsable.';
  return null;
}

export const RunbookEditor: React.FC<RunbookEditorProps> = ({
  initial,
  editing,
  saving,
  securityTeam,
  emailReady,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<RunbookInput>(initial);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [allRepos, setAllRepos] = useState(initial.conditions.repository_ids.length === 0);
  const [query, setQuery] = useState('');
  const [emailText, setEmailText] = useState<Record<number, string>>(() =>
    Object.fromEntries(initial.actions.map((a, i) => [i, a.type === 'email' ? a.to.join(', ') : ''])),
  );
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    fetchRepositories()
      .then((r) => setRepos([...r].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setRepos([]));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? repos.filter((r) => r.name.toLowerCase().includes(q)) : repos;
  }, [repos, query]);

  const selected = new Set(draft.conditions.repository_ids);
  const toggleRepo = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDraft({ ...draft, conditions: { ...draft.conditions, repository_ids: [...next] } });
  };

  const setTrigger = (trigger: RunbookTrigger) =>
    setDraft({ ...draft, trigger, actions: draft.actions.filter((a) => allowed(a.type, trigger)) });

  const updateAction = (i: number, a: RunbookAction) => setDraft({ ...draft, actions: draft.actions.map((x, j) => (j === i ? a : x)) });
  const removeAction = (i: number) => {
    setDraft({ ...draft, actions: draft.actions.filter((_, j) => j !== i) });
    setEmailText((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const n = Number(k);
        if (n < i) next[n] = v;
        else if (n > i) next[n - 1] = v;
      });
      return next;
    });
  };
  const addAction = (type: RunbookAction['type']) => {
    setEmailText((prev) => ({ ...prev, [draft.actions.length]: '' }));
    setDraft({ ...draft, actions: [...draft.actions, { ...EMPTY_ACTION[type] } as RunbookAction] });
  };

  const singleUse: RunbookAction['type'][] = ['assign_owner', 'set_in_review', 'rescan'];
  const addable = (Object.keys(ACTION_META) as RunbookAction['type'][]).filter(
    (t) => allowed(t, draft.trigger) && !(singleUse.includes(t) && draft.actions.some((a) => a.type === t)),
  );

  const problems = draft.actions.map(actionProblem);
  const invalid =
    !draft.name.trim() ||
    draft.actions.length === 0 ||
    problems.some(Boolean) ||
    (!allRepos && draft.conditions.repository_ids.length === 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      description: (draft.description ?? '').trim(),
      conditions: { ...draft.conditions, repository_ids: allRepos ? [] : draft.conditions.repository_ids },
      actions: draft.actions.map((a) =>
        a.type === 'webhook' ? { ...a, url: a.url.trim() } : a.type === 'assign_owner' ? { ...a, email: a.email.trim() } : a,
      ),
    });
  };

  return (
    <div className="dl-modal-backdrop" role="presentation" onClick={onClose}>
      <form className="dl-modal rb-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} aria-label="Runbook">
        <header className="dl-modal-head">
          <h2>{editing ? 'Editar runbook' : 'Nuevo runbook'}</h2>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <label className="dl-field">
          <span>Nombre</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            maxLength={120}
            placeholder="Ej.: Avisar al equipo cuando aparece un crítico"
            autoFocus
          />
        </label>
        <label className="dl-field">
          <span>Descripción (opcional)</span>
          <input
            value={draft.description ?? ''}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            maxLength={600}
            placeholder="Para qué sirve o a quién avisa"
          />
        </label>

        <div className="rb-step">
          <span className="rb-step-tag">Cuando</span>
          <div className="rb-triggers">
            {TRIGGERS.map((t) => (
              <label key={t} className={draft.trigger === t ? 'is-active' : ''} style={{ ['--c' as string]: TRIGGER_META[t].color }}>
                <input type="radio" checked={draft.trigger === t} onChange={() => setTrigger(t)} />
                <strong>{TRIGGER_META[t].label}</strong>
                <em>{TRIGGER_META[t].description}</em>
              </label>
            ))}
          </div>
          {SEVERITY_TRIGGERS.includes(draft.trigger) && (
            <label className="dl-field rb-inline">
              <span>Severidad mínima</span>
              <select
                value={draft.conditions.min_severity}
                onChange={(e) =>
                  setDraft({ ...draft, conditions: { ...draft.conditions, min_severity: e.target.value as RunbookInput['conditions']['min_severity'] } })
                }
              >
                {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABEL[s]}
                    {s !== 'CRITICAL' ? ' o superior' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <fieldset className="dl-field rb-step">
          <span className="rb-step-tag">En</span>
          <div className="dl-scope-options">
            <label className={allRepos ? 'is-active' : ''}>
              <input type="radio" checked={allRepos} onChange={() => setAllRepos(true)} />
              <strong>Todos los repositorios</strong>
              <em>Incluye los que se agreguen después.</em>
            </label>
            <label className={!allRepos ? 'is-active' : ''}>
              <input type="radio" checked={!allRepos} onChange={() => setAllRepos(false)} />
              <strong>Repositorios seleccionados</strong>
              <em>Solo los que elijas.</em>
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
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRepo(r.id)} />
                      <span>{r.name}</span>
                    </label>
                  </li>
                ))}
                {shown.length === 0 && <li className="dl-muted">No hay repositorios que coincidan.</li>}
              </ul>
            </div>
          )}
        </fieldset>

        <div className="rb-step">
          <span className="rb-step-tag">Entonces</span>
          <ol className="rb-actions">
            {draft.actions.map((a, i) => {
              const problem = touched ? problems[i] : null;
              return (
                <li key={i} className={problem ? 'has-error' : ''}>
                  <div className="rb-action-head">
                    <Zap size={14} />
                    <strong>{ACTION_META[a.type].label}</strong>
                    <button type="button" className="dl-icon-btn" onClick={() => removeAction(i)} aria-label="Quitar acción">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="rb-action-desc">{ACTION_META[a.type].description}</p>

                  {a.type === 'email' && (
                    <>
                      <label className="dl-check">
                        <input
                          type="checkbox"
                          checked={a.security_team}
                          onChange={(e) => updateAction(i, { ...a, security_team: e.target.checked })}
                        />
                        <span>
                          Equipo de seguridad{' '}
                          <em className="rb-muted">
                            {securityTeam.length ? `(${securityTeam.join(', ')})` : '(sin correos configurados en el servidor)'}
                          </em>
                        </span>
                      </label>
                      <input
                        className="rb-input"
                        value={emailText[i] ?? ''}
                        placeholder="Otros correos, separados por coma"
                        onChange={(e) => {
                          setEmailText((prev) => ({ ...prev, [i]: e.target.value }));
                          updateAction(i, {
                            ...a,
                            to: e.target.value
                              .split(/[,;\s]+/)
                              .map((x) => x.trim().toLowerCase())
                              .filter(Boolean),
                          });
                        }}
                      />
                      {!emailReady && <small className="rb-warn">El envío de correos aún no está configurado en el servidor.</small>}
                    </>
                  )}

                  {a.type === 'webhook' && (
                    <div className="rb-row">
                      <select value={a.kind} onChange={(e) => updateAction(i, { ...a, kind: e.target.value as typeof a.kind })}>
                        {(Object.keys(WEBHOOK_KIND_LABEL) as (keyof typeof WEBHOOK_KIND_LABEL)[]).map((k) => (
                          <option key={k} value={k}>
                            {WEBHOOK_KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                      <input
                        className="rb-input"
                        value={a.url}
                        placeholder={a.kind === 'slack' ? 'https://hooks.slack.com/services/…' : 'https://…'}
                        onChange={(e) => updateAction(i, { ...a, url: e.target.value })}
                      />
                    </div>
                  )}

                  {a.type === 'assign_owner' && (
                    <input
                      className="rb-input"
                      type="email"
                      value={a.email}
                      placeholder="responsable@empresa.com"
                      onChange={(e) => updateAction(i, { ...a, email: e.target.value })}
                    />
                  )}

                  {problem && <small className="rb-error">{problem}</small>}
                </li>
              );
            })}
          </ol>
          {draft.actions.length === 0 && <p className="rb-muted">Añade al menos una acción.</p>}
          <div className="rb-add">
            {addable.map((t) => (
              <button key={t} type="button" className="rb-add-btn" onClick={() => addAction(t)}>
                <Plus size={13} /> {ACTION_META[t].label}
              </button>
            ))}
          </div>
        </div>

        <label className="dl-check">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
          <span>Activo: se ejecuta automáticamente al terminar cada análisis</span>
        </label>

        <footer className="dl-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || (touched && invalid)}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear runbook'}
          </button>
        </footer>
      </form>
    </div>
  );
};
