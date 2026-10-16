import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { ApiOfflineBanner } from '../components/ApiOfflineBanner';
import { Repository, Scan, fetchRepositories, fetchScans, triggerScan } from '../api/client';
import { Radar, Play, GitBranch, RefreshCw, Search, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import '../styles/scans.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  queued: 'En cola',
  cloning: 'Clonando',
  semgrep: 'Semgrep',
  gitleaks: 'GitLeaks',
  trivy: 'Trivy',
  owasp_zap: 'OWASP ZAP',
  gate: 'Security Gate',
  done: 'Listo',
  failed: 'Falló',
};

const TRIGGER_LABELS: Record<string, string> = {
  web_hub: 'Consola',
  manual_web: 'Consola',
  github_webhook: 'Webhook GitHub',
  gitlab_webhook: 'Webhook GitLab',
  ci: 'Pipeline CI',
  api: 'API',
};

type StatusFilter = 'all' | 'RUNNING' | 'COMPLETED' | 'FAILED';
type GateFilter = 'all' | 'PASSED' | 'BLOCKED' | 'BYPASSED' | 'SKIPPED' | 'none';

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 60) return 'hace un momento';
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function triggerLabel(raw: string): string {
  const key = (raw || '').trim();
  if (!key) return '—';
  if (TRIGGER_LABELS[key]) return TRIGGER_LABELS[key];
  if (key.includes('@')) return key;
  return key.length > 28 ? `${key.slice(0, 26)}…` : key;
}

export const ScansPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
}) => {
  const { t } = useI18n();
  const [scans, setScans] = useState<Scan[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiOffline, setApiOffline] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [gateFilter, setGateFilter] = useState<GateFilter>('all');
  const [repoFilter, setRepoFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const repoName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of repos) map.set(r.id, r.name);
    return map;
  }, [repos]);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([fetchScans(), fetchRepositories()])
      .then(([scanData, repoData]) => {
        setApiOffline(false);
        setScans(scanData || []);
        setRepos(repoData || []);
      })
      .catch(() => {
        setApiOffline(true);
        if (!silent) {
          setScans([]);
          setRepos([]);
        }
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const runningCount = scans.filter((s) => s.status === 'RUNNING').length;
  useEffect(() => {
    if (runningCount === 0) return;
    const id = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(id);
  }, [runningCount]);

  const summary = useMemo(() => {
    const running = scans.filter((s) => s.status === 'RUNNING').length;
    const completed = scans.filter((s) => s.status === 'COMPLETED').length;
    const failed = scans.filter((s) => s.status === 'FAILED').length;
    const blocked = scans.filter((s) => s.gate_status === 'BLOCKED').length;
    return { total: scans.length, running, completed, failed, blocked };
  }, [scans]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scans.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (gateFilter === 'none' && s.gate_status) return false;
      if (gateFilter !== 'all' && gateFilter !== 'none' && s.gate_status !== gateFilter) return false;
      if (repoFilter !== 'all' && s.repository_id !== repoFilter) return false;
      if (!term) return true;
      const name = (repoName.get(s.repository_id) || '').toLowerCase();
      return (
        name.includes(term) ||
        s.id.toLowerCase().includes(term) ||
        s.repository_id.toLowerCase().includes(term) ||
        s.branch.toLowerCase().includes(term) ||
        (s.triggered_by || '').toLowerCase().includes(term) ||
        (s.progress_stage || '').toLowerCase().includes(term)
      );
    });
  }, [scans, q, statusFilter, gateFilter, repoFilter, repoName]);

  const handleRetrigger = async (scan: Scan) => {
    setBusyId(scan.id);
    try {
      const created = await triggerScan(scan.repository_id);
      setScans((prev) => [created, ...prev]);
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Análisis encolado',
        message: `${repoName.get(scan.repository_id) || 'Repositorio'}: el escaneo ya está en segundo plano.`,
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'No se pudo encolar',
        message: err instanceof Error ? err.message : 'Error de API',
      });
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (scan: Scan) => {
    if (scan.status === 'RUNNING') {
      const stage = STAGE_LABELS[scan.progress_stage || ''] || scan.progress_stage || 'En curso';
      return (
        <span className="sc-live" title={scan.progress_detail || undefined}>
          <i />
          {stage}
        </span>
      );
    }
    if (scan.status === 'FAILED') return <span className="badge badge-critical">Falló</span>;
    return <span className="badge badge-low">Completado</span>;
  };

  const gateBadge = (scan: Scan) => {
    const g = scan.gate_status;
    if (g === 'BLOCKED')
      return (
        <span className="badge badge-critical" title={scan.gate_detail || ''}>
          Bloqueado
        </span>
      );
    if (g === 'PASSED')
      return (
        <span className="badge badge-low" title={scan.gate_detail || ''}>
          Aprobado
        </span>
      );
    if (g === 'BYPASSED')
      return (
        <span
          className="badge"
          style={{ background: '#fbefff', color: '#8250df', border: '1px solid #d2a8ff' }}
          title={scan.gate_detail || ''}
        >
          Excepción
        </span>
      );
    if (g === 'SKIPPED')
      return (
        <span className="badge badge-engine" title={scan.gate_detail || ''}>
          Omitido
        </span>
      );
    return <span style={{ color: '#8c959f', fontSize: '0.8rem' }}>—</span>;
  };

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header
        title={t('pages.scans.title')}
        subtitle={t('pages.scans.subtitle')}
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      {apiOffline && <ApiOfflineBanner />}

      <div className="sc-summary">
        <button
          type="button"
          className={`sc-kpi${statusFilter === 'all' && gateFilter === 'all' ? ' is-active' : ''}`}
          onClick={() => {
            setStatusFilter('all');
            setGateFilter('all');
          }}
        >
          <span className="sc-kpi-label">Total</span>
          <span className="sc-kpi-value">{summary.total}</span>
        </button>
        <button
          type="button"
          className={`sc-kpi${statusFilter === 'RUNNING' ? ' is-active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'RUNNING' ? 'all' : 'RUNNING')}
        >
          <span className="sc-kpi-label">En curso</span>
          <span className="sc-kpi-value is-run">{summary.running}</span>
        </button>
        <button
          type="button"
          className={`sc-kpi${statusFilter === 'COMPLETED' ? ' is-active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'all' : 'COMPLETED')}
        >
          <span className="sc-kpi-label">Completados</span>
          <span className="sc-kpi-value">{summary.completed}</span>
        </button>
        <button
          type="button"
          className={`sc-kpi${statusFilter === 'FAILED' ? ' is-active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'FAILED' ? 'all' : 'FAILED')}
        >
          <span className="sc-kpi-label">Fallidos</span>
          <span className="sc-kpi-value is-fail">{summary.failed}</span>
        </button>
        <button
          type="button"
          className={`sc-kpi${gateFilter === 'BLOCKED' ? ' is-active' : ''}`}
          onClick={() => setGateFilter(gateFilter === 'BLOCKED' ? 'all' : 'BLOCKED')}
        >
          <span className="sc-kpi-label">Gate bloqueado</span>
          <span className="sc-kpi-value is-block">{summary.blocked}</span>
        </button>
      </div>

      <div className="sc-toolbar">
        <label className="sc-search">
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por repositorio, rama o ID…"
            aria-label="Buscar escaneos"
          />
        </label>
        <select
          className="filter-select"
          value={repoFilter}
          onChange={(e) => setRepoFilter(e.target.value)}
          aria-label="Filtrar por repositorio"
        >
          <option value="all">Todos los repositorios</option>
          {repos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={gateFilter}
          onChange={(e) => setGateFilter(e.target.value as GateFilter)}
          aria-label="Filtrar por gate"
        >
          <option value="all">Cualquier gate</option>
          <option value="PASSED">Aprobado</option>
          <option value="BLOCKED">Bloqueado</option>
          <option value="BYPASSED">Con excepción</option>
          <option value="SKIPPED">Omitido</option>
          <option value="none">Sin gate</option>
        </select>
        <button type="button" className="btn btn-secondary" onClick={() => load()} disabled={loading}>
          <RefreshCw size={14} />
          <span>Actualizar</span>
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Radar size={20} color="#0969da" />
            <span>
              Historial
              {!loading && (
                <em style={{ fontStyle: 'normal', color: '#656d76', fontWeight: 500, marginLeft: 6 }}>
                  {filtered.length === scans.length
                    ? `(${scans.length})`
                    : `(${filtered.length} de ${scans.length})`}
                </em>
              )}
            </span>
          </div>
          {runningCount > 0 && (
            <span className="sc-live">
              <i />
              Actualización automática
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ color: '#656d76', padding: '2rem', textAlign: 'center' }}>Cargando escaneos…</div>
        ) : filtered.length === 0 ? (
          <div className="sc-empty">
            <strong>{scans.length === 0 ? 'Aún no hay escaneos' : 'Ningún escaneo coincide con el filtro'}</strong>
            <p>
              {scans.length === 0
                ? 'Lanza un análisis desde Repositorios. Aquí verás el progreso, el resultado del Security Gate y los hallazgos por severidad.'
                : 'Prueba limpiar la búsqueda o cambiar los filtros de arriba.'}
            </p>
            {scans.length === 0 && onNavigate && (
              <button type="button" className="btn btn-primary" onClick={() => onNavigate('repositories')}>
                Ir a Repositorios
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Gate</th>
                  <th>Repositorio</th>
                  <th className="sc-hide-sm">Disparador</th>
                  <th>Rama</th>
                  <th>Hallazgos</th>
                  <th>Cuándo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((scan) => {
                  const name = repoName.get(scan.repository_id) || 'Repositorio';
                  return (
                    <tr key={scan.id}>
                      <td>{statusBadge(scan)}</td>
                      <td>{gateBadge(scan)}</td>
                      <td>
                        <div className="sc-repo">
                          <strong>{name}</strong>
                          <small className="sc-id" title={scan.id}>
                            {scan.id.slice(0, 8)}…
                          </small>
                        </div>
                      </td>
                      <td className="sc-hide-sm">
                        <span className="badge badge-engine">{triggerLabel(scan.triggered_by)}</span>
                      </td>
                      <td>
                        <span className="badge badge-engine">
                          <GitBranch size={12} style={{ marginRight: 4 }} />
                          {scan.branch}
                        </span>
                      </td>
                      <td>
                        <div className="sc-sev" title={`${scan.total_findings} hallazgos en total`}>
                          {scan.critical_count > 0 && <span className="c">{scan.critical_count} crit.</span>}
                          {scan.high_count > 0 && <span className="h">{scan.high_count} altas</span>}
                          {scan.medium_count > 0 && <span className="m">{scan.medium_count} med.</span>}
                          {scan.critical_count + scan.high_count + scan.medium_count === 0 && (
                            <span>{scan.total_findings || 0}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="sc-time" title={new Date(scan.created_at).toLocaleString('es-CL')}>
                          {relativeTime(scan.created_at)}
                        </span>
                      </td>
                      <td>
                        <div className="sc-actions">
                          {onNavigate && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              title="Ver hallazgos de este repositorio"
                              onClick={() => onNavigate('findings')}
                            >
                              <ExternalLink size={13} />
                              <span>Hallazgos</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busyId === scan.id || scan.status === 'RUNNING'}
                            onClick={() => handleRetrigger(scan)}
                          >
                            <Play size={13} color="#0969da" />
                            <span>Re-escanear</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
