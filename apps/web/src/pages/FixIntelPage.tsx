import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, RefreshCw, Sparkles, Wand2, X } from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { AiVerdict, FixIntelItem, FixIntelQueue, decideFixIntel, fetchFixIntel, triageFindings } from '../api/client';
import { SEVERITY_COLOR, SEVERITY_LABEL, Severity } from '../utils/findingGroups';
import { formatFilePath } from '../utils/formatFilePath';
import { formatDateTime } from '../utils/formatDateTime';
import { usePillowPageContext } from '../config/pillowContext';
import { focusSecretFinding } from '../config/secretProviders';
import PageSkeleton from '../components/PageSkeleton';
import '../styles/fixintel.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

type Filter = 'all' | 'urgent' | 'quick' | 'untriaged' | AiVerdict;

const VERDICT_META: Record<AiVerdict, { label: string; color: string; accept: string }> = {
  LIKELY_REAL: {
    label: 'Probable real',
    color: '#cf222e',
    accept: 'Aceptar: el hallazgo pasa a "En revisión" para corregirlo.',
  },
  NEEDS_REVIEW: {
    label: 'Requiere revisión',
    color: '#9a6700',
    accept: 'Aceptar: el hallazgo pasa a "En revisión" para que alguien lo confirme.',
  },
  LIKELY_FALSE_POSITIVE: {
    label: 'Probable falso positivo',
    color: '#1a7f37',
    accept: 'Aceptar: el hallazgo se marca como falso positivo y sale de la cola.',
  },
};

const ENGINE_LABEL: Record<string, string> = {
  semgrep: 'Código (Semgrep)',
  gitleaks: 'Secretos (Gitleaks)',
  trivy: 'Dependencias (Trivy)',
  owasp_zap: 'App en ejecución (ZAP)',
};

const scoreColor = (score: number) => (score >= 50 ? '#cf222e' : score >= 30 ? '#bc4c00' : score >= 15 ? '#9a6700' : '#6e7781');

const sevColor = (sev: string) => SEVERITY_COLOR[sev as Severity] ?? '#6e7781';
const sevLabel = (sev: string) => SEVERITY_LABEL[sev as Severity] ?? sev;

const PAGE_SIZE = 60;

export const FixIntelPage: React.FC<PageProps> = ({ onNavigate, ...headerProps }) => {
  const [data, setData] = useState<FixIntelQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [repoFilter, setRepoFilter] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [triaging, setTriaging] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const notify = (type: ToastMessage['type'], title: string, message: string) =>
    setToast({ id: Date.now().toString(), type, title, message });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchFixIntel(repoFilter || undefined));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la cola');
    } finally {
      setLoading(false);
    }
  }, [repoFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.items ?? [];
  const maxBatch = data?.max_batch ?? 5;

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (filter === 'urgent') return i.score >= 50;
        if (filter === 'quick') return !!i.fix_version;
        if (filter === 'untriaged') return !i.ai_verdict;
        if (filter === 'all') return true;
        return i.ai_verdict === filter;
      }),
    [items, filter],
  );

  useEffect(() => setVisible(PAGE_SIZE), [filter, repoFilter]);

  const active = items.find((i) => i.id === activeId) ?? null;

  const pillowContext = useMemo(
    () => ({
      kpis: data?.kpis,
      top_queue: items.slice(0, 10).map((i) => ({
        title: i.title,
        severity: i.severity,
        engine: i.engine,
        score: i.score,
        reasons: i.reasons.map((r) => r.label),
        fix_hint: i.fix_hint,
        ai_verdict: i.ai_verdict,
      })),
      selected_finding: active
        ? { title: active.title, description: active.description, file: active.file_path, ai_summary: active.ai_summary }
        : undefined,
    }),
    [data, items, active],
  );
  usePillowPageContext('fixIntel', data ? pillowContext : null);

  const mergeItems = (updated: FixIntelItem[]) =>
    setData((prev) => {
      if (!prev) return prev;
      const byId = new Map(updated.map((u) => [u.id, u]));
      const next = prev.items.map((i) => byId.get(i.id) ?? i).sort((a, b) => b.score - a.score);
      return { ...prev, items: next };
    });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < maxBatch) next.add(id);
      return next;
    });

  const selectTopUntriaged = () =>
    setSelected(new Set(filtered.filter((i) => !i.ai_verdict).slice(0, maxBatch).map((i) => i.id)));

  const runTriage = async (ids: string[]) => {
    if (!ids.length || triaging) return;
    setTriaging(true);
    try {
      const res = await triageFindings(ids);
      mergeItems(res.items);
      setSelected(new Set());
      notify(
        'success',
        'Análisis completado',
        `Pillow analizó ${res.items.length} hallazgo(s). Te quedan ${res.credits_remaining} de ${res.daily_limit} créditos hoy.`,
      );
      load();
    } catch (err) {
      notify('error', 'No se pudo analizar', err instanceof Error ? err.message : String(err));
    } finally {
      setTriaging(false);
    }
  };

  const decide = async (item: FixIntelItem, decision: 'accept' | 'dismiss') => {
    setDeciding(true);
    try {
      const updated = await decideFixIntel(item.id, decision);
      if (decision === 'accept' && updated.status === 'FALSE_POSITIVE') {
        setActiveId(null);
        notify('success', 'Marcado como falso positivo', 'El hallazgo salió de la cola y quedará así en los próximos análisis.');
      } else {
        notify(
          'success',
          decision === 'accept' ? 'Sugerencia aceptada' : 'Sugerencia descartada',
          decision === 'accept' ? 'El hallazgo quedó "En revisión".' : 'El hallazgo sigue en la cola con su prioridad.',
        );
      }
      load();
    } catch (err) {
      notify('error', 'No se pudo guardar', err instanceof Error ? err.message : String(err));
    } finally {
      setDeciding(false);
    }
  };

  const kpis = data?.kpis;
  const chips: { id: Filter; label: string; count?: number }[] = [
    { id: 'all', label: 'Todos', count: kpis?.active },
    { id: 'urgent', label: 'Urgentes', count: kpis?.urgent },
    { id: 'quick', label: 'Quick wins', count: kpis?.quick_wins },
    { id: 'untriaged', label: 'Sin analizar', count: kpis ? kpis.active - kpis.triaged : undefined },
    { id: 'LIKELY_REAL', label: 'Probable real', count: kpis?.likely_real },
    { id: 'NEEDS_REVIEW', label: 'Requiere revisión', count: kpis?.needs_review },
    { id: 'LIKELY_FALSE_POSITIVE', label: 'Probable falso positivo', count: kpis?.likely_false_positive },
  ];

  const loaded = data !== null || error !== null;
  const empty = !!data && data.kpis.active === 0 && !repoFilter;

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header
        title="Fix Intelligence"
        subtitle="Qué corregir primero y cómo hacerlo: prioridad explicada y análisis de Pillow, con la decisión final siempre en tus manos."
        onNavigate={onNavigate}
        {...headerProps}
      />

      {!loaded && <PageSkeleton variant="cards" rows={4} />}

      {error && <div className="card fi-empty fi-error">{error}</div>}

      {empty && (
        <div className="card fi-empty">
          <Sparkles size={30} />
          <h3>No hay hallazgos pendientes</h3>
          <p>Cuando un análisis detecte problemas aparecerán aquí, ordenados por lo que conviene corregir primero.</p>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('scans')}>
            <span>Ir a Escaneos</span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {data && !empty && kpis && (
        <>
          <div className="fi-kpis">
            <div className="fi-kpi" style={{ ['--c' as string]: '#0969da' }}>
              <span className="fi-kpi-label">Por atender</span>
              <span className="fi-kpi-value">{kpis.active}</span>
              <span className="fi-kpi-hint">hallazgos abiertos o en revisión</span>
            </div>
            <div className="fi-kpi" style={{ ['--c' as string]: '#cf222e' }}>
              <span className="fi-kpi-label">Urgentes</span>
              <span className="fi-kpi-value">{kpis.urgent}</span>
              <span className="fi-kpi-hint">prioridad 50 o más</span>
            </div>
            <div className="fi-kpi" style={{ ['--c' as string]: '#1a7f37' }}>
              <span className="fi-kpi-label">Quick wins</span>
              <span className="fi-kpi-value">{kpis.quick_wins}</span>
              <span className="fi-kpi-hint">se corrigen actualizando una versión</span>
            </div>
            <div className="fi-kpi" style={{ ['--c' as string]: '#8250df' }}>
              <span className="fi-kpi-label">Analizados por Pillow</span>
              <span className="fi-kpi-value">{kpis.triaged}</span>
              <span className="fi-kpi-hint">{kpis.likely_false_positive} probables falsos positivos</span>
            </div>
            <div className="fi-kpi" style={{ ['--c' as string]: '#6e7781' }}>
              <span className="fi-kpi-label">Acierto de Pillow</span>
              <span className="fi-kpi-value">
                {kpis.ai_acceptance_rate === null ? '—' : `${Math.round(kpis.ai_acceptance_rate * 100)}%`}
              </span>
              <span className="fi-kpi-hint">
                {kpis.ai_accepted} aceptadas · {kpis.ai_dismissed} descartadas
              </span>
            </div>
          </div>

          <div className="card fi-toolbar">
            <select className="fi-select" value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)}>
              <option value="">Todos los repositorios</option>
              {data.repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} title="Actualizar">
              <RefreshCw size={14} className={loading ? 'fi-spin' : ''} />
            </button>
            <div className="fi-toolbar-spacer" />
            <button type="button" className="btn btn-secondary" onClick={selectTopUntriaged} disabled={triaging}>
              Seleccionar los {maxBatch} más prioritarios
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => runTriage([...selected])}
              disabled={!selected.size || triaging}
            >
              <Wand2 size={14} className={triaging ? 'fi-spin' : ''} />
              <span>{triaging ? 'Analizando…' : `Analizar con Pillow (${selected.size}/${maxBatch})`}</span>
            </button>
            <div className="fi-chips">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`fi-chip ${filter === c.id ? 'is-active' : ''}`}
                  onClick={() => setFilter(c.id)}
                >
                  {c.label}
                  {c.count !== undefined && <em>{c.count}</em>}
                </button>
              ))}
            </div>
            <p className="fi-note">
              Cada análisis usa 1 crédito diario de Pillow y revisa hasta {maxBatch} hallazgos a la vez.
            </p>
          </div>

          <div className="card fi-table-card">
            <table className="fi-table">
              <thead>
                <tr>
                  <th />
                  <th>Prioridad</th>
                  <th>Hallazgo</th>
                  <th>Severidad</th>
                  <th>Por qué</th>
                  <th>Pillow</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, visible).map((i) => {
                  const isSel = selected.has(i.id);
                  const verdict = i.ai_verdict ? VERDICT_META[i.ai_verdict] : null;
                  return (
                    <tr key={i.id} className={activeId === i.id ? 'is-open' : ''} onClick={() => setActiveId(i.id)}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          disabled={!isSel && selected.size >= maxBatch}
                          onChange={() => toggleSelect(i.id)}
                          aria-label="Seleccionar para análisis"
                        />
                      </td>
                      <td>
                        <div className="fi-score" style={{ ['--c' as string]: scoreColor(i.score) }}>
                          <strong>{i.score}</strong>
                          <span>
                            <i style={{ width: `${i.score}%` }} />
                          </span>
                        </div>
                      </td>
                      <td className="fi-title-cell">
                        <strong>{i.title}</strong>
                        <span className="fi-meta">
                          {ENGINE_LABEL[i.engine] ?? i.engine} · {i.repository_name}
                          {i.file_path && ` · ${formatFilePath(i.file_path)}${i.line_number ? `:${i.line_number}` : ''}`}
                        </span>
                      </td>
                      <td>
                        <span className="fi-sev" style={{ ['--c' as string]: sevColor(i.severity) }}>
                          {sevLabel(i.severity)}
                        </span>
                      </td>
                      <td>
                        <div className="fi-reasons">
                          {i.reasons.slice(1).map((r) => (
                            <span key={r.label} className={`fi-reason is-${r.tone}`}>
                              {r.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {verdict ? (
                          <span className="fi-verdict" style={{ ['--c' as string]: verdict.color }}>
                            {verdict.label}
                            {i.ai_feedback === 'ACCEPTED' && <Check size={12} />}
                          </span>
                        ) : (
                          <span className="fi-muted">Sin analizar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="fi-none">No hay hallazgos con este filtro.</div>}
            {filtered.length > visible && (
              <div className="fi-more">
                <button type="button" className="btn btn-secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Mostrar más ({filtered.length - visible} restantes)
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {active && (
        <div className="fi-drawer-backdrop" role="presentation" onClick={() => setActiveId(null)}>
          <aside className="fi-drawer" onClick={(e) => e.stopPropagation()} aria-label="Detalle del hallazgo">
            <header className="fi-drawer-head">
              <div>
                <span className="fi-sev" style={{ ['--c' as string]: sevColor(active.severity) }}>
                  {sevLabel(active.severity)}
                </span>
                <h2>{active.title}</h2>
                <span className="fi-meta">
                  {ENGINE_LABEL[active.engine] ?? active.engine} · {active.repository_name}
                  {active.file_path &&
                    ` · ${formatFilePath(active.file_path)}${active.line_number ? `:${active.line_number}` : ''}`}
                </span>
              </div>
              <button type="button" className="fi-icon-btn" onClick={() => setActiveId(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>

            <section className="fi-section">
              <h3>Prioridad {active.score}/100</h3>
              <ul className="fi-breakdown">
                {active.reasons.map((r) => (
                  <li key={r.label} className={`is-${r.tone}`}>
                    <span>{r.label}</span>
                    <b>
                      {r.delta > 0 && r.tone !== 'neutral' ? '+' : ''}
                      {r.delta}
                    </b>
                  </li>
                ))}
              </ul>
            </section>

            <section className="fi-section">
              <h3>Cómo corregirlo</h3>
              <p className="fi-hint">{active.fix_hint}</p>
              <span className="fi-muted">Esfuerzo estimado: {active.effort}</span>
            </section>

            <section className="fi-section">
              <h3>Detalle de la herramienta</h3>
              <p className="fi-desc">{active.description}</p>
              {(active.cwe || active.owasp_category) && (
                <span className="fi-muted">{[active.cwe, active.owasp_category].filter(Boolean).join(' · ')}</span>
              )}
            </section>

            <section className="fi-section fi-ai">
              <h3>
                <Sparkles size={14} /> Análisis de Pillow
              </h3>
              {!active.ai_verdict ? (
                <>
                  <p className="fi-muted">
                    {active.engine === 'gitleaks'
                      ? 'Pillow revisa el hallazgo (sin ver el valor del secreto), estima si es real y propone la corrección.'
                      : 'Pillow revisa el hallazgo y, si el repositorio es público, el código alrededor; estima si es real y propone la corrección.'}
                  </p>
                  <button type="button" className="btn btn-primary" onClick={() => runTriage([active.id])} disabled={triaging}>
                    <Wand2 size={14} className={triaging ? 'fi-spin' : ''} />
                    <span>{triaging ? 'Analizando…' : 'Analizar este hallazgo'}</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="fi-ai-head">
                    <span className="fi-verdict" style={{ ['--c' as string]: VERDICT_META[active.ai_verdict].color }}>
                      {VERDICT_META[active.ai_verdict].label}
                    </span>
                    <span className="fi-confidence">
                      Confianza {Math.round((active.ai_confidence ?? 0) * 100)}%
                      <span>
                        <i style={{ width: `${Math.round((active.ai_confidence ?? 0) * 100)}%` }} />
                      </span>
                    </span>
                  </div>
                  {active.ai_summary && <p className="fi-desc">{active.ai_summary}</p>}
                  {active.engine === 'gitleaks' && (
                    <p className="fi-muted">
                      Pillow no ve el valor del secreto ni el código: se basa en el tipo de regla, la ruta y el repositorio.
                      Confirma en el archivo si es una clave real o de prueba antes de aceptar.
                    </p>
                  )}
                  {active.ai_remediation && (
                    <>
                      <h4>Corrección sugerida</h4>
                      <pre className="fi-remediation">{active.ai_remediation}</pre>
                    </>
                  )}
                  {active.ai_triaged_at && (
                    <span className="fi-muted">Analizado el {formatDateTime(active.ai_triaged_at)}</span>
                  )}

                  {active.ai_feedback ? (
                    <p className={`fi-feedback is-${active.ai_feedback.toLowerCase()}`}>
                      {active.ai_feedback === 'ACCEPTED' ? 'Aceptaste esta sugerencia.' : 'Descartaste esta sugerencia.'}
                    </p>
                  ) : (
                    <div className="fi-decision">
                      <p className="fi-muted">{VERDICT_META[active.ai_verdict].accept}</p>
                      <div className="fi-decision-actions">
                        <button type="button" className="btn btn-primary" disabled={deciding} onClick={() => decide(active, 'accept')}>
                          <Check size={14} />
                          <span>Aceptar</span>
                        </button>
                        <button type="button" className="btn btn-secondary" disabled={deciding} onClick={() => decide(active, 'dismiss')}>
                          <X size={14} />
                          <span>Descartar</span>
                        </button>
                      </div>
                    </div>
                  )}
                  <button type="button" className="fi-link" onClick={() => runTriage([active.id])} disabled={triaging}>
                    Volver a analizar
                  </button>
                </>
              )}
            </section>

            {active.engine === 'gitleaks' && (
              <button type="button" className="btn btn-secondary fi-drawer-link" onClick={() => {
                  focusSecretFinding(active.id);
                  onNavigate?.('secrets');
                }}
              >
                <span>Abrir en Secret Management</span>
                <ArrowRight size={14} />
              </button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
