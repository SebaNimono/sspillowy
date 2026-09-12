import React, { useEffect, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { Repository, Scan, fetchRepositories, createRepository, triggerScan, fetchScans } from '../api/client';
import { FolderGit2, Plus, Play, GitBranch, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

type ActiveScan = {
  scanId: string;
  repoName: string;
  startedAt: number;
};

const POLL_MS = 3000;
const MAX_WAIT_MS = 12 * 60 * 1000; // repos grandes (maka, etc.)
/** Solo retomar RUNNING recientes; los viejos son seed/jobs muertos. */
const RESUME_MAX_AGE_MS = 20 * 60 * 1000;

export const RepositoriesPage: React.FC<PageProps> = ({ sidebarState, setSidebarState, user, onLogout, onNavigate, unreadCount, onGoToSite }) => {
  const { t } = useI18n();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [submitting, setSubmitting] = useState(false);
  const [activeScans, setActiveScans] = useState<Record<string, ActiveScan>>({});
  const activeScansRef = useRef(activeScans);
  activeScansRef.current = activeScans;

  const loadRepos = (quiet = false) => {
    if (!quiet) setLoading(true);
    return fetchRepositories()
      .then((data) => setRepos(data || []))
      .catch(() => {
        if (!quiet) {
          setRepos([]);
          setToast({
            id: Date.now().toString(),
            type: 'error',
            title: 'Error al cargar repositorios',
            message: 'No se pudo conectar con la API.',
          });
        }
      })
      .finally(() => {
        if (!quiet) setLoading(false);
      });
  };

  const finishScan = async (
    repoId: string,
    repoName: string,
    status: 'COMPLETED' | 'FAILED' | 'TIMEOUT',
    scan?: Scan,
  ) => {
    setActiveScans((prev) => {
      const next = { ...prev };
      delete next[repoId];
      return next;
    });
    await loadRepos(true);
    if (status === 'COMPLETED') {
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: t('repos.scanDone', { name: repoName }),
        message: t('repos.scanDoneMsg', { count: scan?.total_findings ?? 0 }),
      });
    } else if (status === 'FAILED') {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: t('repos.scanFailed', { name: repoName }),
        message: t('repos.scanFailedMsg'),
      });
    } else {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: t('repos.scanTimeout', { name: repoName }),
        message: t('repos.scanTimeoutMsg'),
      });
    }
  };

  // Polling mientras haya escaneos activos
  useEffect(() => {
    const ids = Object.keys(activeScans);
    if (ids.length === 0) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const current = activeScansRef.current;
      const entries = Object.entries(current);
      if (entries.length === 0) return;

      try {
        const scans = await fetchScans();
        const byId = new Map((scans || []).map((s) => [s.id, s]));
        for (const [repoId, info] of entries) {
          const scan = byId.get(info.scanId);
          const elapsed = Date.now() - info.startedAt;
          if (scan?.status === 'COMPLETED') {
            await finishScan(repoId, info.repoName, 'COMPLETED', scan);
          } else if (scan?.status === 'FAILED') {
            await finishScan(repoId, info.repoName, 'FAILED', scan);
          } else if (elapsed >= MAX_WAIT_MS) {
            await finishScan(repoId, info.repoName, 'TIMEOUT', scan);
          }
        }
      } catch {
        /* siguiente tick */
      }
    };

    tick();
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [Object.keys(activeScans).sort().join('|')]);

  // Al montar: retomar escaneos RUNNING del servidor
  useEffect(() => {
    loadRepos();
    Promise.all([fetchRepositories(), fetchScans()])
      .then(([repoList, scans]) => {
        setRepos(repoList || []);
        const running = (scans || []).filter((s) => {
          if ((s.status || '').toUpperCase() !== 'RUNNING') return false;
          const started = Date.parse(s.created_at);
          if (!Number.isFinite(started)) return false;
          return Date.now() - started < RESUME_MAX_AGE_MS;
        });
        if (!running.length) return;
        const nameById = new Map((repoList || []).map((r) => [r.id, r.name]));
        const latest: Record<string, ActiveScan> = {};
        for (const s of [...running].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))) {
          if (!latest[s.repository_id]) {
            latest[s.repository_id] = {
              scanId: s.id,
              repoName: nameById.get(s.repository_id) || s.repository_id,
              startedAt: Date.parse(s.created_at) || Date.now(),
            };
          }
        }
        setActiveScans(latest);
      })
      .catch(() => {
        setRepos([]);
        setToast({
          id: Date.now().toString(),
          type: 'error',
          title: 'Error al cargar repositorios',
          message: 'No se pudo conectar con la API.',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;
    setSubmitting(true);
    try {
      const newRepo = await createRepository(name, url, branch);
      setRepos([newRepo, ...repos]);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Repositorio Registrado',
        message: `El repositorio ${name} ha sido integrado exitosamente.`,
      });
      setShowModal(false);
      setName('');
      setUrl('');
    } catch (err) {
      const manualNewRepo: Repository = {
        id: `repo-${Date.now()}`,
        name,
        url,
        branch,
        is_active: true,
        health_score: 100,
        open_criticals: 0,
        open_highs: 0,
        total_findings: 0,
        created_at: new Date().toISOString(),
      };
      setRepos([manualNewRepo, ...repos]);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Repositorio Registrado (Modo Demo)',
        message: `El repositorio ${name} ha sido añadido a la lista local.`,
      });
      setShowModal(false);
      setName('');
      setUrl('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerScan = async (repoId: string, repoName: string) => {
    if (activeScans[repoId]) return;
    try {
      const scan = await triggerScan(repoId);
      setActiveScans((prev) => ({
        ...prev,
        [repoId]: { scanId: scan.id, repoName, startedAt: Date.now() },
      }));
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: t('repos.scanning'),
        message: t('repos.scanningBanner', { name: repoName }),
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'No se pudo iniciar el escaneo',
        message: err instanceof Error ? err.message : 'Error de API',
      });
    }
  };

  const scanningNames = Object.values(activeScans).map((s) => s.repoName);

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <Header
        title={t('pages.repositories.title')}
        subtitle={t('pages.repositories.subtitle')}
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      {scanningNames.length > 0 && (
        <div
          style={{
            background: '#ddf4ff',
            border: '1px solid #54aeff',
            color: '#0969da',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <RefreshCw size={18} className="spin" />
          <span>
            {scanningNames.length === 1
              ? t('repos.scanningBanner', { name: scanningNames[0] })
              : `${t('repos.scanning')} ${scanningNames.join(', ')}`}
          </span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FolderGit2 size={20} color="#0969da" />
            <span>{t('repos.monitored', { count: repos.length })}</span>
          </div>

          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            <span>{t('repos.newRepo')}</span>
          </button>
        </div>

        {loading ? (
          <div style={{ color: '#656d76', padding: '2rem', textAlign: 'center' }}>
            <RefreshCw size={20} className="spin" style={{ marginBottom: '0.5rem' }} />
            <div>{t('common.loading')}</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>{t('repos.status')}</th>
                  <th>{t('repos.name')}</th>
                  <th>{t('repos.branch')}</th>
                  <th>{t('repos.health')}</th>
                  <th>{t('repos.criticals')}</th>
                  <th>{t('repos.totalFindings')}</th>
                  <th>{t('repos.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {repos.map((repo) => {
                  const scanning = Boolean(activeScans[repo.id]);
                  return (
                    <tr
                      key={repo.id}
                      style={scanning ? { background: 'rgba(9, 105, 218, 0.04)' } : undefined}
                    >
                      <td>
                        {scanning ? (
                          <span
                            title={t('repos.scanning')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#0969da', fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            <RefreshCw size={14} className="spin" />
                            {t('repos.scanning')}
                          </span>
                        ) : (
                          <span className="status-dot" title="Monitoreo activo"></span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1f2328', fontSize: '0.9rem' }}>{repo.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#656d76', fontFamily: 'var(--font-mono)' }}>{repo.url}</div>
                      </td>
                      <td>
                        <span className="badge badge-engine">
                          <GitBranch size={12} style={{ marginRight: '4px' }} />
                          {repo.branch}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: repo.health_score > 80 ? '#1a7f37' : repo.health_score > 60 ? '#9a6700' : '#cf222e',
                          }}
                        >
                          {repo.health_score}%
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${repo.open_criticals > 0 ? 'badge-critical' : 'badge-low'}`}>
                          {t('repos.criticalCount', { count: repo.open_criticals })}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, color: '#656d76' }}>{t('repos.findingsCount', { count: repo.total_findings })}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.8rem',
                            opacity: scanning ? 0.85 : 1,
                            cursor: scanning ? 'wait' : 'pointer',
                          }}
                          disabled={scanning}
                          onClick={() => handleTriggerScan(repo.id, repo.name)}
                        >
                          {scanning ? (
                            <>
                              <RefreshCw size={14} className="spin" color="#0969da" />
                              <span>{t('repos.scanning')}</span>
                            </>
                          ) : (
                            <>
                              <Play size={14} color="#0969da" />
                              <span>{t('repos.runScan')}</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#1f2328', fontWeight: 700 }}>
              Registrar Nuevo Repositorio Git
            </h2>

            <form onSubmit={handleAddRepo}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#656d76', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Nombre del Repositorio
                </label>
                <input
                  type="text"
                  placeholder="ej. sspillowy-backend-service"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default)',
                    background: '#ffffff',
                    color: '#1f2328',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#656d76', marginBottom: '0.35rem', fontWeight: 600 }}>
                  URL de Repositorio (GitHub / GitLab / Bitbucket)
                </label>
                <input
                  type="text"
                  placeholder="https://github.com/mi-org/mi-repo"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default)',
                    background: '#ffffff',
                    color: '#1f2328',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#656d76', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Rama Principal
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default)',
                    background: '#ffffff',
                    color: '#1f2328',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Registrar Repositorio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
