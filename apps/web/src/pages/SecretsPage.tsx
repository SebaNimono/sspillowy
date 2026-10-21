import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldOff,
  X,
} from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { SecretIncident, SecretStatus, SecretStep, fetchSecrets, updateSecret } from '../api/client';
import { SECRET_STEPS, providerGuide, takeSecretFocus } from '../config/secretProviders';
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../utils/findingGroups';
import { formatDateTime } from '../utils/formatDateTime';
import { formatFilePath } from '../utils/formatFilePath';
import { usePillowPageContext } from '../config/pillowContext';
import { useI18n } from '../i18n/I18nProvider';
import PageSkeleton from '../components/PageSkeleton';
import '../styles/secrets.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const STATUS_META: Record<SecretStatus, { label: string; color: string }> = {
  OPEN: { label: 'Abierto', color: '#cf222e' },
  IN_PROGRESS: { label: 'En respuesta', color: '#0969da' },
  RESOLVED: { label: 'Resuelto', color: '#1a7f37' },
  FALSE_POSITIVE: { label: 'Falso positivo', color: '#6e7781' },
};

const DAY_MS = 86_400_000;

const stepsDone = (s: SecretIncident) => SECRET_STEPS.filter((st) => s.steps[st.id].done).length;

const ageLabel = (iso: string | null) => {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'hoy';
  return days === 1 ? '1 día' : `${days} días`;
};

export const SecretsPage: React.FC<PageProps> = ({ onNavigate, ...headerProps }) => {
  const { t } = useI18n();
  const [items, setItems] = useState<SecretIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | SecretStatus | 'all'>('active');
  const [repoFilter, setRepoFilter] = useState('');
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');

  const notify = (type: ToastMessage['type'], title: string, message: string) =>
    setToast({ id: Date.now().toString(), type, title, message });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchSecrets();
      setItems(list);
      setError(null);
      const focusId = takeSecretFocus();
      const target = focusId ? list.find((s) => s.finding_ids.includes(focusId)) : undefined;
      if (target) {
        if (target.status !== 'OPEN' && target.status !== 'IN_PROGRESS') setStatusFilter('all');
        setActiveId(target.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los secretos');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = items.find((s) => s.id === activeId) ?? null;

  useEffect(() => {
    setOwnerDraft(active?.owner_email ?? '');
    setNotesDraft(active?.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const repos = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((s) => map.set(s.repository_id, s.repository_name ?? s.repository_id));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const kpis = useMemo(() => {
    const open = items.filter((s) => s.status === 'OPEN').length;
    const inProgress = items.filter((s) => s.status === 'IN_PROGRESS').length;
    const resolved = items.filter((s) => s.status === 'RESOLVED');
    const criticalUnrotated = items.filter(
      (s) => s.severity === 'CRITICAL' && !s.steps.rotated.done && (s.status === 'OPEN' || s.status === 'IN_PROGRESS'),
    ).length;
    const durations = resolved
      .filter((s) => s.first_seen_at && s.resolved_at)
      .map((s) => new Date(s.resolved_at!).getTime() - new Date(s.first_seen_at!).getTime());
    const mttr = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length / DAY_MS : null;
    return { open, inProgress, resolved: resolved.length, criticalUnrotated, mttr };
  }, [items]);

  const pillowContext = useMemo(
    () => ({
      kpis,
      incidents: items
        .filter((s) => s.status === 'OPEN' || s.status === 'IN_PROGRESS')
        .slice(0, 12)
        .map((s) => ({
          provider: s.provider,
          severity: s.severity,
          status: s.status,
          repository: s.repository_name,
          file: s.file_path,
          steps_done: SECRET_STEPS.filter((st) => s.steps[st.id].done).map((st) => st.id),
        })),
    }),
    [kpis, items],
  );
  usePillowPageContext('secrets', loaded ? pillowContext : null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((s) => {
      if (statusFilter === 'active' && !(s.status === 'OPEN' || s.status === 'IN_PROGRESS')) return false;
      if (statusFilter !== 'active' && statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (repoFilter && s.repository_id !== repoFilter) return false;
      if (!q) return true;
      return [s.rule_id, s.file_path, s.repository_name, providerGuide(s.provider).label, s.owner_email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [items, statusFilter, repoFilter, query]);

  const apply = async (body: Parameters<typeof updateSecret>[1], okTitle: string) => {
    if (!active) return;
    setSaving(true);
    try {
      const updated = await updateSecret(active.id, body);
      setItems((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      notify('success', okTitle, `${updated.rule_id} · ${STATUS_META[updated.status].label}`);
    } catch (err) {
      notify('error', 'No se pudo actualizar', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleStep = (step: SecretStep) => {
    if (!active) return;
    const done = !active.steps[step].done;
    apply({ steps: { [step]: done } }, done ? 'Paso completado' : 'Paso desmarcado');
  };

  const saveDetails = () =>
    apply({ owner_email: ownerDraft.trim(), notes: notesDraft.trim() }, 'Responsable y notas guardados');

  const filterChips: { id: typeof statusFilter; label: string }[] = [
    { id: 'active', label: 'Pendientes' },
    { id: 'OPEN', label: 'Abiertos' },
    { id: 'IN_PROGRESS', label: 'En respuesta' },
    { id: 'RESOLVED', label: 'Resueltos' },
    { id: 'FALSE_POSITIVE', label: 'Falsos positivos' },
    { id: 'all', label: 'Todos' },
  ];

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header
        title={t('pages.secrets.title')}
        subtitle={t('pages.secrets.subtitle')}
        onNavigate={onNavigate}
        {...headerProps}
      />

      {!loaded ? (
        <PageSkeleton variant="cards" rows={4} />
      ) : (
      <>
      <div className="sm-kpis">
        <div className="sm-kpi" style={{ ['--c' as string]: '#cf222e' }}>
          <span className="sm-kpi-label">Abiertos</span>
          <span className="sm-kpi-value">{kpis.open}</span>
          <span className="sm-kpi-hint">sin respuesta iniciada</span>
        </div>
        <div className="sm-kpi" style={{ ['--c' as string]: '#0969da' }}>
          <span className="sm-kpi-label">En respuesta</span>
          <span className="sm-kpi-value">{kpis.inProgress}</span>
          <span className="sm-kpi-hint">checklist en curso</span>
        </div>
        <div className="sm-kpi" style={{ ['--c' as string]: '#bc4c00' }}>
          <span className="sm-kpi-label">Críticos sin rotar</span>
          <span className="sm-kpi-value">{kpis.criticalUnrotated}</span>
          <span className="sm-kpi-hint">prioridad inmediata</span>
        </div>
        <div className="sm-kpi" style={{ ['--c' as string]: '#1a7f37' }}>
          <span className="sm-kpi-label">Resueltos</span>
          <span className="sm-kpi-value">{kpis.resolved}</span>
          <span className="sm-kpi-hint">
            {kpis.mttr === null ? 'sin cierres aún' : `tiempo medio ${kpis.mttr < 1 ? '<1 día' : `${kpis.mttr.toFixed(1)} días`}`}
          </span>
        </div>
      </div>

      <div className="card sm-toolbar">
        <div className="sm-chips">
          {filterChips.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`sm-chip ${statusFilter === c.id ? 'is-active' : ''}`}
              onClick={() => setStatusFilter(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="sm-toolbar-right">
          <label className="sm-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Regla, archivo, proveedor…" />
          </label>
          <select className="sm-select" value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)}>
            <option value="">Todos los repositorios</option>
            {repos.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} title="Actualizar">
            <RefreshCw size={14} className={loading ? 'sm-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="card sm-empty sm-error">{error}</div>}

      {!error && !loading && visible.length === 0 && (
        <div className="card sm-empty">
          <KeyRound size={28} />
          <h3>{items.length === 0 ? 'No hay secretos detectados' : 'Nada con estos filtros'}</h3>
          <p>
            {items.length === 0
              ? 'Cuando un análisis con GitLeaks detecte una credencial expuesta, aparecerá aquí con su checklist de respuesta.'
              : 'Prueba con otro estado o repositorio.'}
          </p>
          {items.length === 0 && (
            <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('scans')}>
              <span>Ir a Escaneos</span>
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}

      {visible.length > 0 && (
        <div className="card sm-table-card">
          <table className="sm-table">
            <thead>
              <tr>
                <th>Secreto</th>
                <th>Ubicación</th>
                <th>Severidad</th>
                <th>Respuesta</th>
                <th>Estado</th>
                <th>Antigüedad</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const guide = providerGuide(s.provider);
                const done = stepsDone(s);
                return (
                  <tr key={s.id} className={s.id === activeId ? 'is-selected' : ''} onClick={() => setActiveId(s.id)}>
                    <td>
                      <div className="sm-secret">
                        <span className="sm-provider" style={{ ['--c' as string]: guide.color }}>
                          {guide.label}
                        </span>
                        <div>
                          <strong>{s.rule_id}</strong>
                          <code>{s.preview || '(redacted)'}</code>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="sm-loc">
                        <span>{s.repository_name ?? s.repository_id}</span>
                        <code>
                          {formatFilePath(s.file_path) || '—'}
                          {s.line_number ? `:${s.line_number}` : ''}
                        </code>
                      </div>
                    </td>
                    <td>
                      <span className="sm-sev" style={{ ['--c' as string]: SEVERITY_COLOR[s.severity] }}>
                        {SEVERITY_LABEL[s.severity]}
                      </span>
                    </td>
                    <td>
                      <div className="sm-progress" title={`${done} de 4 pasos`}>
                        {SECRET_STEPS.map((st) => (
                          <span key={st.id} className={s.steps[st.id].done ? 'is-done' : ''} />
                        ))}
                        <em>{done}/4</em>
                      </div>
                    </td>
                    <td>
                      <span className="sm-status" style={{ ['--c' as string]: STATUS_META[s.status].color }}>
                        {STATUS_META[s.status].label}
                      </span>
                      <small className={`sm-presence ${s.detected_now ? 'is-live' : ''}`}>
                        {s.detected_now ? 'Detectado en el último análisis' : 'Ya no detectado'}
                      </small>
                    </td>
                    <td className="sm-age">{ageLabel(s.first_seen_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      </>
      )}

      {active && (
        <div className="sm-drawer-backdrop" onClick={() => setActiveId(null)}>
          <aside className="sm-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="sm-drawer-head">
              <div>
                <span className="sm-provider" style={{ ['--c' as string]: providerGuide(active.provider).color }}>
                  {providerGuide(active.provider).label}
                </span>
                <h2>{active.rule_id}</h2>
                <p>
                  {active.repository_name ?? active.repository_id} · <code>{formatFilePath(active.file_path) || '—'}</code>
                  {active.line_number ? `:${active.line_number}` : ''}
                </p>
              </div>
              <button type="button" className="sm-icon-btn" onClick={() => setActiveId(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="sm-meta">
              <div>
                <span>Valor (enmascarado)</span>
                <code>{active.preview || '(redacted)'}</code>
              </div>
              <div>
                <span>Estado</span>
                <strong style={{ color: STATUS_META[active.status].color }}>{STATUS_META[active.status].label}</strong>
              </div>
              <div>
                <span>Detectado por primera vez</span>
                <strong>{formatDateTime(active.first_seen_at)}</strong>
              </div>
              <div>
                <span>Última detección</span>
                <strong>{formatDateTime(active.last_seen_at)}</strong>
              </div>
            </div>

            {active.reopened_count > 0 && (
              <div className="sm-callout is-warn">
                Este secreto volvió a aparecer después de cerrarse ({active.reopened_count}{' '}
                {active.reopened_count === 1 ? 'vez' : 'veces'}). Revisa que se haya eliminado del código y del historial.
              </div>
            )}

            {active.status === 'FALSE_POSITIVE' ? (
              <div className="sm-callout">
                Marcado como falso positivo: no cuenta para los Security Gates y las nuevas detecciones del mismo valor se
                descartan automáticamente.
              </div>
            ) : (
              <section className="sm-section">
                <h3>Checklist de respuesta</h3>
                <ol className="sm-steps">
                  {SECRET_STEPS.map((st, i) => {
                    const info = active.steps[st.id];
                    const blocked = st.id === 'verified' && !info.done && !(active.steps.rotated.done && active.steps.revoked.done);
                    const guide = providerGuide(active.provider);
                    return (
                      <li key={st.id} className={info.done ? 'is-done' : ''}>
                        <button
                          type="button"
                          className="sm-step-toggle"
                          disabled={saving || blocked}
                          onClick={() => toggleStep(st.id)}
                          title={blocked ? 'Primero rota y revoca la credencial' : undefined}
                        >
                          {info.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                        <div>
                          <strong>
                            {i + 1}. {st.label}
                          </strong>
                          <p>{st.id === 'rotated' ? guide.rotate : st.id === 'revoked' ? guide.revoke : st.hint}</p>
                          {info.done && (
                            <small>
                              {info.by} · {formatDateTime(info.at)}
                            </small>
                          )}
                          {blocked && <small className="sm-blocked">Disponible tras rotar y revocar.</small>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {providerGuide(active.provider).url && (
                  <a className="sm-link" href={providerGuide(active.provider).url} target="_blank" rel="noreferrer">
                    Abrir consola de {providerGuide(active.provider).label} <ExternalLink size={13} />
                  </a>
                )}
              </section>
            )}

            <section className="sm-section">
              <h3>Responsable y notas</h3>
              <input
                className="sm-input"
                type="email"
                placeholder="correo@empresa.com"
                value={ownerDraft}
                onChange={(e) => setOwnerDraft(e.target.value)}
              />
              <textarea
                className="sm-input"
                rows={3}
                placeholder="Ej.: clave usada solo en staging, rotada en el gestor de secretos."
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
              />
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={saveDetails}>
                Guardar
              </button>
            </section>

            <div className="sm-drawer-actions">
              <button type="button" className="btn btn-secondary" onClick={() => onNavigate?.('findings')}>
                Ver en Priorización contextual
              </button>
              {active.status === 'FALSE_POSITIVE' || active.status === 'RESOLVED' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => apply({ status: 'OPEN' }, 'Incidente reabierto')}
                >
                  <RotateCcw size={14} />
                  <span>Reabrir</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() =>
                    apply({ status: 'FALSE_POSITIVE', notes: notesDraft.trim() || undefined }, 'Marcado como falso positivo')
                  }
                >
                  <ShieldOff size={14} />
                  <span>Falso positivo</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
