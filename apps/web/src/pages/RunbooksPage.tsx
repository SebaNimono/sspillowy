import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FlaskConical, Pencil, Plus, RefreshCw, Trash2, Workflow, X, XCircle } from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { RunbookEditor } from '../components/RunbookEditor';
import {
  Repository,
  Runbook,
  RunbookExecution,
  RunbookInput,
  createRunbook,
  deleteRunbook,
  fetchRepositories,
  fetchRunbookExecutions,
  fetchRunbooks,
  setRunbookEnabled,
  testRunbook,
  updateRunbook,
} from '../api/client';
import { ACTION_META, RUNBOOK_TEMPLATES, TRIGGER_META, WEBHOOK_KIND_LABEL } from '../config/runbookTemplates';
import { SEVERITY_LABEL } from '../utils/findingGroups';
import { formatDateTime } from '../utils/formatDateTime';
import { timeAgo } from '../utils/timeAgo';
import { usePillowPageContext } from '../config/pillowContext';
import '../styles/runbooks.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const STATUS_META: Record<RunbookExecution['status'], { label: string; color: string }> = {
  SUCCESS: { label: 'Correcta', color: '#1a7f37' },
  PARTIAL: { label: 'Parcial', color: '#bf8700' },
  FAILED: { label: 'Fallida', color: '#cf222e' },
  SIMULATED: { label: 'Prueba', color: '#8250df' },
};

const DAY_MS = 86_400_000;

const toInput = (r: Runbook): RunbookInput => ({
  name: r.name,
  description: r.description,
  enabled: r.enabled,
  trigger: r.trigger,
  conditions: r.conditions,
  actions: r.actions,
  template: r.template,
});

function actionChip(a: Runbook['actions'][number]): string {
  if (a.type === 'email') {
    const n = a.to.length + (a.security_team ? 1 : 0);
    return a.security_team && !a.to.length ? 'Correo a seguridad' : `Correo (${n} destino${n === 1 ? '' : 's'})`;
  }
  if (a.type === 'webhook') return `Mensaje a ${WEBHOOK_KIND_LABEL[a.kind]}`;
  if (a.type === 'assign_owner') return `Asignar a ${a.email}`;
  return ACTION_META[a.type].label;
}

export const RunbooksPage: React.FC<PageProps> = ({ onNavigate, ...headerProps }) => {
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [executions, setExecutions] = useState<RunbookExecution[]>([]);
  const [meta, setMeta] = useState<{ email_ready: boolean; security_team: string[] }>({ email_ready: false, security_team: [] });
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'runbooks' | 'history'>('runbooks');
  const [historyFilter, setHistoryFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ input: RunbookInput; id: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Runbook | null>(null);
  const [testing, setTesting] = useState<Runbook | null>(null);
  const [testRepo, setTestRepo] = useState('');
  const [testResult, setTestResult] = useState<Awaited<ReturnType<typeof testRunbook>> | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = (type: ToastMessage['type'], title: string, message: string) =>
    setToast({ id: Date.now().toString(), type, title, message });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, execs] = await Promise.all([fetchRunbooks(), fetchRunbookExecutions()]);
      setRunbooks(list.runbooks);
      setMeta({ email_ready: list.email_ready, security_team: list.security_team });
      setExecutions(execs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los runbooks');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    fetchRepositories()
      .then((r) => setRepos([...r].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setRepos([]));
  }, [load]);

  const real = useMemo(() => executions.filter((e) => e.status !== 'SIMULATED'), [executions]);
  const kpis = useMemo(() => {
    const week = real.filter((e) => e.created_at && Date.now() - new Date(e.created_at).getTime() < 7 * DAY_MS);
    const actions = real.flatMap((e) => e.results);
    return {
      active: runbooks.filter((r) => r.enabled).length,
      week: week.length,
      okRate: actions.length ? Math.round((100 * actions.filter((a) => a.ok).length) / actions.length) : null,
      last: real[0]?.created_at ?? null,
    };
  }, [runbooks, real]);

  const pillowContext = useMemo(
    () => ({
      kpis,
      runbooks: runbooks.map((r) => ({
        nombre: r.name,
        activo: r.enabled,
        cuando: TRIGGER_META[r.trigger].label,
        acciones: r.actions.map((a) => ACTION_META[a.type].label),
        ejecuciones: r.run_count,
      })),
      ultimas_ejecuciones: real.slice(0, 8).map((e) => ({
        runbook: e.runbook_name,
        resultado: STATUS_META[e.status].label,
        repositorio: e.repository_name,
        resumen: e.summary,
      })),
    }),
    [kpis, runbooks, real],
  );
  usePillowPageContext('runbooks', loaded ? pillowContext : null);

  const save = async (body: RunbookInput) => {
    if (!editor) return;
    setSaving(true);
    try {
      if (editor.id) {
        const updated = await updateRunbook(editor.id, body);
        setRunbooks((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify('success', 'Runbook guardado', updated.name);
      } else {
        const created = await createRunbook(body);
        setRunbooks((prev) => [...prev, created]);
        notify('success', 'Runbook creado', created.enabled ? 'Se ejecutará al terminar cada análisis.' : 'Quedó desactivado.');
      }
      setEditor(null);
    } catch (err) {
      notify('error', 'No se pudo guardar', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (r: Runbook) => {
    try {
      const updated = await setRunbookEnabled(r.id, !r.enabled);
      setRunbooks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      notify('error', 'No se pudo cambiar', err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await deleteRunbook(deleting.id);
      setRunbooks((prev) => prev.filter((r) => r.id !== deleting.id));
      notify('success', 'Runbook eliminado', 'El historial de ejecuciones se conserva.');
    } catch (err) {
      notify('error', 'No se pudo eliminar', err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(null);
    }
  };

  const runTest = async () => {
    if (!testing) return;
    setTestBusy(true);
    try {
      const res = await testRunbook(testing.id, testRepo || undefined);
      setTestResult(res);
      if (res.execution) setExecutions((prev) => [res.execution!, ...prev]);
    } catch (err) {
      notify('error', 'No se pudo probar', err instanceof Error ? err.message : String(err));
    } finally {
      setTestBusy(false);
    }
  };

  const openTest = (r: Runbook) => {
    setTesting(r);
    setTestRepo('');
    setTestResult(null);
  };

  const history = historyFilter ? executions.filter((e) => e.runbook_id === historyFilter) : executions;

  const templates = (
    <section className="rb-templates">
      <h3>{runbooks.length ? 'Empezar desde una plantilla' : 'Plantillas para empezar'}</h3>
      <div className="rb-template-grid">
        {RUNBOOK_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="card rb-template"
            style={{ ['--c' as string]: TRIGGER_META[t.input.trigger].color }}
            onClick={() => setEditor({ input: structuredClone(t.input), id: null })}
          >
            <span className="rb-trigger-chip">{TRIGGER_META[t.input.trigger].label}</span>
            <strong>{t.title}</strong>
            <p>{t.why}</p>
            <span className="rb-template-actions">{t.input.actions.map((a) => ACTION_META[a.type].label).join(' · ')}</span>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header
        title="Runbooks & RPA"
        subtitle="Respuestas automáticas: cuando pasa algo en un análisis, SSPILLOWY avisa, asigna o actúa por ti."
        onNavigate={onNavigate}
        {...headerProps}
      />

      {!loaded ? (
        <div className="card rb-empty">
          <RefreshCw size={22} className="rb-spin" />
          <p>Cargando runbooks…</p>
        </div>
      ) : error ? (
        <div className="card rb-empty rb-error">{error}</div>
      ) : (
        <>
          <div className="rb-kpis">
            <div className="rb-kpi" style={{ ['--c' as string]: '#0969da' }}>
              <span>Runbooks activos</span>
              <b>{kpis.active}</b>
              <em>de {runbooks.length} creados</em>
            </div>
            <div className="rb-kpi" style={{ ['--c' as string]: '#8250df' }}>
              <span>Ejecuciones (7 días)</span>
              <b>{kpis.week}</b>
              <em>{real.length} en total</em>
            </div>
            <div className="rb-kpi" style={{ ['--c' as string]: '#1a7f37' }}>
              <span>Acciones correctas</span>
              <b>{kpis.okRate === null ? '—' : `${kpis.okRate}%`}</b>
              <em>de todas las ejecuciones</em>
            </div>
            <div className="rb-kpi" style={{ ['--c' as string]: '#6e7781' }}>
              <span>Última ejecución</span>
              <b className="rb-kpi-small">{timeAgo(kpis.last)}</b>
              <em>{real[0]?.runbook_name ?? 'aún ninguna'}</em>
            </div>
          </div>

          <div className="card rb-toolbar">
            <div className="rb-tabs" role="tablist">
              <button type="button" role="tab" className={tab === 'runbooks' ? 'is-active' : ''} onClick={() => setTab('runbooks')}>
                Runbooks <em>{runbooks.length}</em>
              </button>
              <button type="button" role="tab" className={tab === 'history' ? 'is-active' : ''} onClick={() => setTab('history')}>
                Historial <em>{executions.length}</em>
              </button>
            </div>
            <div className="rb-toolbar-spacer" />
            <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} title="Actualizar">
              <RefreshCw size={14} className={loading ? 'rb-spin' : ''} />
            </button>
            <button
              type="button"
              className="btn btn-primary rb-new"
              onClick={() =>
                setEditor({
                  id: null,
                  input: {
                    name: '',
                    description: '',
                    enabled: true,
                    trigger: 'NEW_FINDING',
                    conditions: { repository_ids: [], min_severity: 'CRITICAL' },
                    actions: [{ type: 'email', to: [], security_team: true }],
                  },
                })
              }
            >
              <Plus size={15} />
              <span>Nuevo runbook</span>
            </button>
          </div>

          {tab === 'runbooks' && (
            <>
              {runbooks.length === 0 && (
                <div className="card rb-intro">
                  <Workflow size={28} />
                  <div>
                    <h3>Automatiza las respuestas repetitivas</h3>
                    <p>
                      Un runbook es una regla «cuando pasa esto, haz aquello». Se evalúa al terminar cada análisis: por ejemplo,
                      avisar al equipo cuando aparece un secreto o relanzar un análisis que falló. Empieza con una plantilla.
                    </p>
                  </div>
                </div>
              )}

              {runbooks.length > 0 && (
                <div className="rb-list">
                  {runbooks.map((r) => {
                    const tm = TRIGGER_META[r.trigger];
                    return (
                      <article key={r.id} className={`card rb-card ${r.enabled ? '' : 'is-off'}`} style={{ ['--c' as string]: tm.color }}>
                        <label className="rb-switch" title={r.enabled ? 'Desactivar' : 'Activar'}>
                          <input type="checkbox" checked={r.enabled} onChange={() => toggle(r)} />
                          <span />
                        </label>
                        <div className="rb-card-body">
                          <div className="rb-card-title">
                            <strong>{r.name}</strong>
                            {!r.enabled && <span className="rb-off">Desactivado</span>}
                          </div>
                          {r.description && <p className="rb-card-desc">{r.description}</p>}
                          <div className="rb-flow">
                            <span className="rb-flow-tag">Cuando</span>
                            <span className="rb-trigger-chip">
                              {tm.label}
                              {(r.trigger === 'NEW_FINDING' || r.trigger === 'SLA_BREACHED') &&
                                ` · ${SEVERITY_LABEL[r.conditions.min_severity].toLowerCase()}${r.conditions.min_severity !== 'CRITICAL' ? ' o más' : ''}`}
                            </span>
                            <span className="rb-flow-tag">en</span>
                            <span className="rb-scope">
                              {r.repository_names.length
                                ? r.repository_names.length <= 2
                                  ? r.repository_names.join(', ')
                                  : `${r.repository_names.length} repositorios`
                                : 'todos los repositorios'}
                            </span>
                            <span className="rb-flow-tag">entonces</span>
                            {r.actions.map((a, i) => (
                              <span key={i} className="rb-action-chip">
                                {actionChip(a)}
                              </span>
                            ))}
                          </div>
                          <span className="rb-card-meta">
                            {r.run_count ? `Se ejecutó ${r.run_count} ${r.run_count === 1 ? 'vez' : 'veces'} · última ${timeAgo(r.last_run_at)}` : 'Aún no se ha ejecutado'}
                          </span>
                        </div>
                        <div className="rb-card-actions">
                          <button type="button" className="btn btn-secondary" onClick={() => openTest(r)}>
                            <FlaskConical size={14} />
                            <span>Probar</span>
                          </button>
                          <button type="button" className="rb-icon-btn" onClick={() => setEditor({ input: toInput(r), id: r.id })} title="Editar">
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="rb-icon-btn is-danger" onClick={() => setDeleting(r)} title="Eliminar">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {templates}
            </>
          )}

          {tab === 'history' && (
            <div className="card rb-history">
              <div className="rb-history-head">
                <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}>
                  <option value="">Todos los runbooks</option>
                  {runbooks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <span className="rb-muted">Las pruebas aparecen marcadas como «Prueba» y no ejecutaron ninguna acción.</span>
              </div>
              {history.length === 0 ? (
                <p className="rb-none">Todavía no hay ejecuciones. Aparecerán aquí cuando un análisis active algún runbook.</p>
              ) : (
                <table className="rb-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Runbook</th>
                      <th>Disparador</th>
                      <th>Repositorio</th>
                      <th>Resultado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((e) => {
                      const open = expanded === e.id;
                      const ok = e.results.filter((x) => x.ok).length;
                      return (
                        <React.Fragment key={e.id}>
                          <tr className={open ? 'is-open' : ''} onClick={() => setExpanded(open ? null : e.id)}>
                            <td className="rb-nowrap">
                              {formatDateTime(e.created_at)}
                              <small>{e.actor === 'automático' ? 'automático' : `prueba de ${e.actor}`}</small>
                            </td>
                            <td>
                              <strong>{e.runbook_name}</strong>
                            </td>
                            <td>
                              <span className="rb-trigger-chip" style={{ ['--c' as string]: TRIGGER_META[e.trigger]?.color }}>
                                {TRIGGER_META[e.trigger]?.label ?? e.trigger}
                              </span>
                            </td>
                            <td>{e.repository_name ?? '—'}</td>
                            <td>
                              <span className="rb-status" style={{ ['--c' as string]: STATUS_META[e.status].color }}>
                                {STATUS_META[e.status].label}
                              </span>
                            </td>
                            <td className="rb-nowrap">
                              {ok}/{e.results.length} correctas
                            </td>
                          </tr>
                          {open && (
                            <tr className="rb-detail">
                              <td colSpan={6}>
                                <p>{e.summary}</p>
                                <ul>
                                  {e.results.map((x, i) => (
                                    <li key={i} className={x.ok ? 'is-ok' : 'is-bad'}>
                                      {x.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                                      <strong>{x.label}</strong>
                                      <span>{x.message}</span>
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {editor && (
        <RunbookEditor
          initial={editor.input}
          editing={!!editor.id}
          saving={saving}
          securityTeam={meta.security_team}
          emailReady={meta.email_ready}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}

      {testing && (
        <div className="dl-modal-backdrop" role="presentation" onClick={() => setTesting(null)}>
          <div className="dl-modal rb-test" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Probar runbook">
            <header className="dl-modal-head">
              <h2>Probar «{testing.name}»</h2>
              <button type="button" className="dl-icon-btn" onClick={() => setTesting(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <p className="rb-muted">
              Se evalúa contra el último análisis del repositorio elegido y se muestra qué haría. No se envía nada ni se cambia
              ningún hallazgo.
            </p>
            <label className="dl-field">
              <span>Repositorio</span>
              <select value={testRepo} onChange={(e) => setTestRepo(e.target.value)}>
                <option value="">El más reciente dentro de su alcance</option>
                {repos
                  .filter((r) => !testing.conditions.repository_ids.length || testing.conditions.repository_ids.includes(r.id))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
            {testResult && (
              <div className={`rb-test-result ${testResult.matched ? 'is-match' : ''}`}>
                <strong>{testResult.matched ? 'Se activaría' : 'No se activaría'}</strong>
                <p>{testResult.execution?.summary || testResult.reason}</p>
                {testResult.execution && (
                  <ul>
                    {testResult.execution.results.map((x, i) => (
                      <li key={i} className={x.ok ? 'is-ok' : 'is-bad'}>
                        {x.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                        <strong>{x.label}</strong>
                        <span>{x.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <footer className="dl-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setTesting(null)}>
                Cerrar
              </button>
              <button type="button" className="btn btn-primary" onClick={runTest} disabled={testBusy}>
                {testBusy ? 'Probando…' : testResult ? 'Probar de nuevo' : 'Probar ahora'}
              </button>
            </footer>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleting}
        title="Eliminar runbook"
        message={`Se eliminará «${deleting?.name ?? ''}». Dejará de ejecutarse, pero su historial de ejecuciones se conserva.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
};
