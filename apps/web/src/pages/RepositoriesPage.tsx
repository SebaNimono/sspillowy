import React, { useEffect, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { Repository, Scan, ScanEngine, fetchRepositories, createRepository, triggerScan, fetchScans, deleteRepository, fetchGithubWebhookInfo } from '../api/client';
import { FolderGit2, Plus, Play, GitBranch, RefreshCw, Trash2, Webhook } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { ConfirmModal } from '../components/ConfirmModal';

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
  stage?: string | null;
  detail?: string | null;
};

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

/** Perfiles estilo DefectDojo (tool engagement), adaptados a SSPILLOWY. */
const SCAN_PROFILES: { id: string; label: string; hint: string; engines: ScanEngine[] }[] = [
  {
    id: 'ci_fast',
    label: 'CI rápido',
    hint: 'SAST + secretos — típico en PR',
    engines: ['semgrep', 'gitleaks'],
  },
  {
    id: 'full_code',
    label: 'Código completo',
    hint: 'SAST + secretos + deps/misconfig',
    engines: ['semgrep', 'gitleaks', 'trivy'],
  },
  {
    id: 'sast',
    label: 'Solo SAST',
    hint: 'Semgrep · código fuente',
    engines: ['semgrep'],
  },
  {
    id: 'secrets',
    label: 'Solo secretos',
    hint: 'GitLeaks · credenciales en repo',
    engines: ['gitleaks'],
  },
  {
    id: 'sca',
    label: 'Solo SCA / IaC',
    hint: 'Trivy · dependencias y misconfig',
    engines: ['trivy'],
  },
  {
    id: 'dast',
    label: 'Solo DAST',
    hint: 'OWASP ZAP · URL en vivo',
    engines: ['owasp_zap'],
  },
  {
    id: 'full_stack',
    label: 'Full stack',
    hint: 'Todos los motores (más lento)',
    engines: ['semgrep', 'gitleaks', 'trivy', 'owasp_zap'],
  },
];

const ENGINES_STORAGE_KEY = 'sspillowy_scan_engines';

function loadSavedEngines(): Record<ScanEngine, boolean> | null {
  try {
    const raw = localStorage.getItem(ENGINES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<ScanEngine, boolean>>;
    return {
      semgrep: Boolean(parsed.semgrep),
      gitleaks: Boolean(parsed.gitleaks),
      trivy: Boolean(parsed.trivy),
      owasp_zap: Boolean(parsed.owasp_zap),
    };
  } catch {
    return null;
  }
}

function saveEngines(engines: Record<ScanEngine, boolean>) {
  try {
    localStorage.setItem(ENGINES_STORAGE_KEY, JSON.stringify(engines));
  } catch {
    // ignore
  }
}

const POLL_MS = 2000;
const MAX_WAIT_MS = 12 * 60 * 1000; // repos grandes (maka, etc.)
/** Solo retomar RUNNING recientes; los viejos son seed/jobs muertos. */
const RESUME_MAX_AGE_MS = 20 * 60 * 1000;

export const RepositoriesPage: React.FC<PageProps> = ({ sidebarState, setSidebarState, user, onLogout, onNavigate, unreadCount, onGoToSite }) => {
  const { t } = useI18n();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [scanTarget, setScanTarget] = useState<{ id: string; name: string; dastUrl?: string | null } | null>(null);
  const [scanEngines, setScanEngines] = useState<Record<ScanEngine, boolean>>(
    () =>
      loadSavedEngines() || {
        semgrep: true,
        gitleaks: true,
        trivy: true,
        owasp_zap: false,
      },
  );
  const [activeProfile, setActiveProfile] = useState<string | null>('full_code');
  const [scanDastUrl, setScanDastUrl] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [dastUrl, setDastUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeScans, setActiveScans] = useState<Record<string, ActiveScan>>({});
  const activeScansRef = useRef(activeScans);
  activeScansRef.current = activeScans;
  const [webhookInfo, setWebhookInfo] = useState<{
    endpoint: string;
    secret_configured: boolean;
    engines: string[];
    instructions: string;
  } | null>(null);

  useEffect(() => {
    fetchGithubWebhookInfo()
      .then((info) =>
        setWebhookInfo({
          endpoint: info.endpoint,
          secret_configured: info.secret_configured,
          engines: info.engines,
          instructions: info.instructions,
        }),
      )
      .catch(() => setWebhookInfo(null));
  }, []);

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
          if (scan && (scan.progress_stage || scan.progress_detail)) {
            setActiveScans((prev) => {
              const cur = prev[repoId];
              if (!cur || cur.scanId !== info.scanId) return prev;
              if (cur.stage === scan.progress_stage && cur.detail === scan.progress_detail) return prev;
              return {
                ...prev,
                [repoId]: {
                  ...cur,
                  stage: scan.progress_stage,
                  detail: scan.progress_detail,
                },
              };
            });
          }
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
              stage: s.progress_stage,
              detail: s.progress_detail,
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
      const newRepo = await createRepository(name, url, branch, dastUrl);
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
      setDastUrl('');
    } catch (err) {
      const manualNewRepo: Repository = {
        id: `repo-${Date.now()}`,
        name,
        url,
        branch,
        dast_url: dastUrl || null,
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
      setDastUrl('');
    } finally {
      setSubmitting(false);
    }
  };

  const openScanModal = (repo: Repository) => {
    if (activeScans[repo.id]) return;
    setScanTarget({ id: repo.id, name: repo.name, dastUrl: repo.dast_url });
    const saved = loadSavedEngines();
    if (saved) {
      setScanEngines(saved);
      setActiveProfile(null);
    } else {
      setScanEngines({ semgrep: true, gitleaks: true, trivy: true, owasp_zap: false });
      setActiveProfile('full_code');
    }
    setScanDastUrl(repo.dast_url || '');
  };

  const applyProfile = (profileId: string) => {
    const profile = SCAN_PROFILES.find((p) => p.id === profileId);
    if (!profile) return;
    const next: Record<ScanEngine, boolean> = {
      semgrep: profile.engines.includes('semgrep'),
      gitleaks: profile.engines.includes('gitleaks'),
      trivy: profile.engines.includes('trivy'),
      owasp_zap: profile.engines.includes('owasp_zap'),
    };
    setScanEngines(next);
    setActiveProfile(profileId);
    saveEngines(next);
  };

  const toggleEngine = (id: ScanEngine, checked: boolean) => {
    setScanEngines((prev) => {
      const next = { ...prev, [id]: checked };
      saveEngines(next);
      return next;
    });
    setActiveProfile(null);
  };

  const handleTriggerScan = async () => {
    if (!scanTarget) return;
    const engines = (Object.keys(scanEngines) as ScanEngine[]).filter((k) => scanEngines[k]);
    if (engines.length === 0) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: t('repos.enginesRequired'),
        message: t('repos.enginesRequiredMsg'),
      });
      return;
    }
    const { id: repoId, name: repoName } = scanTarget;
    const targetOverride = scanEngines.owasp_zap ? scanDastUrl : undefined;
    setScanTarget(null);
    try {
      const scan = await triggerScan(
        repoId,
        engines,
        user?.email || user?.name || 'web_hub',
        targetOverride,
      );
      setActiveScans((prev) => ({
        ...prev,
        [repoId]: {
          scanId: scan.id,
          repoName,
          startedAt: Date.now(),
          stage: scan.progress_stage || 'queued',
          detail: scan.progress_detail || 'En cola…',
        },
      }));
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: t('repos.scanning'),
        message: `${engines.join(' + ')} · ${repoName}`,
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

  const handleDeleteRepo = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { id: repoId, name: repoName } = deleteTarget;
    try {
      await deleteRepository(repoId);
      setRepos((prev) => prev.filter((r) => r.id !== repoId));
      setActiveScans((prev) => {
        const next = { ...prev };
        delete next[repoId];
        return next;
      });
      setDeleteTarget(null);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Repositorio eliminado',
        message: repoName,
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'No se pudo eliminar',
        message: err instanceof Error ? err.message : 'Error de API',
      });
    } finally {
      setDeleting(false);
    }
  };

  const scanningNames = Object.values(activeScans).map((s) => s.repoName);
  const progressHint =
    Object.values(activeScans).length === 1
      ? (() => {
          const s = Object.values(activeScans)[0];
          const label = STAGE_LABELS[s.stage || ''] || s.stage || t('repos.scanning');
          return s.detail ? `${label} · ${s.detail}` : label;
        })()
      : null;

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
              ? `${t('repos.scanningBanner', { name: scanningNames[0] })}${progressHint ? ` — ${progressHint}` : ''}`
              : `${t('repos.scanning')} ${scanningNames.join(', ')}`}
          </span>
        </div>
      )}

      {webhookInfo && (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            borderTop: `3px solid ${webhookInfo.secret_configured ? '#1a7f37' : '#9a6700'}`,
          }}
        >
          <div className="card-header" style={{ marginBottom: '0.5rem' }}>
            <div className="card-title">
              <Webhook size={18} color={webhookInfo.secret_configured ? '#1a7f37' : '#9a6700'} />
              <span>Webhook GitHub (escaneo al push / PR)</span>
            </div>
            <span
              className={`badge ${webhookInfo.secret_configured ? 'badge-low' : 'badge-critical'}`}
            >
              {webhookInfo.secret_configured ? 'Secret OK' : 'Falta secret'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#656d76', marginBottom: '0.5rem', lineHeight: 1.45 }}>
            {webhookInfo.instructions}
          </p>
          <code
            style={{
              display: 'block',
              fontSize: '0.78rem',
              background: '#f6f8fa',
              padding: '0.55rem 0.7rem',
              borderRadius: '6px',
              border: '1px solid #d0d7de',
              wordBreak: 'break-all',
            }}
          >
            {webhookInfo.endpoint}
          </code>
          <p style={{ fontSize: '0.75rem', color: '#656d76', marginTop: '0.45rem' }}>
            Motores: {webhookInfo.engines.join(' + ')}
          </p>
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
                  const stage = activeScans[repo.id]?.stage;
                  const stageLabel = stage ? STAGE_LABELS[stage] || stage : t('repos.scanning');
                  return (
                    <tr
                      key={repo.id}
                      style={scanning ? { background: 'rgba(9, 105, 218, 0.04)' } : undefined}
                    >
                      <td>
                        {scanning ? (
                          <span
                            title={activeScans[repo.id]?.detail || stageLabel}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#0969da', fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            <RefreshCw size={14} className="spin" />
                            {stageLabel}
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
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary"
                            style={{
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.8rem',
                              opacity: scanning ? 0.85 : 1,
                              cursor: scanning ? 'wait' : 'pointer',
                            }}
                            disabled={scanning}
                            onClick={() => openScanModal(repo)}
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
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.55rem', fontSize: '0.8rem', color: '#cf222e' }}
                            disabled={scanning}
                            title="Eliminar repositorio"
                            onClick={() => setDeleteTarget({ id: repo.id, name: repo.name })}
                          >
                            <Trash2 size={14} />
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

      {scanTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <h2 style={{ fontSize: '1.15rem', marginBottom: '0.35rem', color: '#1f2328', fontWeight: 700 }}>
              {t('repos.scanConfigTitle')}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#656d76', marginBottom: '0.85rem' }}>
              {t('repos.scanConfigHint', { name: scanTarget.name })}
            </p>

            <div style={{ marginBottom: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#656d76', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Perfiles
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {SCAN_PROFILES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.hint}
                    onClick={() => applyProfile(p.id)}
                    className={activeProfile === p.id ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {activeProfile && (
                <p style={{ fontSize: '0.75rem', color: '#656d76', marginTop: '0.45rem' }}>
                  {SCAN_PROFILES.find((p) => p.id === activeProfile)?.hint}
                </p>
              )}
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#656d76', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Motores
            </div>
            {(
              [
                { id: 'semgrep' as const, label: 'Semgrep', desc: 'SAST · código' },
                { id: 'gitleaks' as const, label: 'GitLeaks', desc: 'Secretos' },
                { id: 'trivy' as const, label: 'Trivy', desc: 'Deps / misconfig / secrets SCA' },
                { id: 'owasp_zap' as const, label: 'OWASP ZAP', desc: 'DAST · URL en vivo' },
              ]
            ).map((opt) => (
              <label
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  padding: '0.55rem 0.65rem',
                  marginBottom: '0.35rem',
                  border: '1px solid #d0d7de',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: scanEngines[opt.id] ? '#ddf4ff' : '#fff',
                }}
              >
                <input
                  type="checkbox"
                  checked={scanEngines[opt.id]}
                  onChange={(e) => toggleEngine(opt.id, e.target.checked)}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1f2328' }}>{opt.label}</span>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: '#656d76' }}>{opt.desc}</span>
                </span>
              </label>
            ))}
            {scanEngines.owasp_zap && (
              <div style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#656d76', marginBottom: '0.35rem', fontWeight: 600 }}>
                  {t('repos.dastUrlLabel')}
                </label>
                <input
                  type="url"
                  placeholder="https://sspillowy.com"
                  value={scanDastUrl}
                  onChange={(e) => setScanDastUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default)',
                    background: '#ffffff',
                    color: '#1f2328',
                    outline: 'none',
                    fontSize: '0.85rem',
                  }}
                />
                <p style={{ fontSize: '0.75rem', color: '#656d76', marginTop: '0.35rem' }}>
                  {t('repos.dastUrlHint')}
                </p>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setScanTarget(null)}>
                {t('repos.cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleTriggerScan}>
                <Play size={14} />
                <span>{t('repos.scanStart')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={t('repos.deleteTitle')}
        message={t('repos.deleteMsg', { name: deleteTarget?.name || '' })}
        confirmLabel={t('repos.deleteConfirm')}
        cancelLabel={t('repos.cancel')}
        danger
        busy={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteRepo}
      />

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.35rem', color: '#1f2328', fontWeight: 700 }}>
              {t('repos.registerTitle')}
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#656d76', marginBottom: '1rem' }}>
              {t('repos.registerHint')}
            </p>

            <form onSubmit={handleAddRepo}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#656d76', marginBottom: '0.35rem', fontWeight: 600 }}>
                  {t('repos.nameLabel')}
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
                  {t('repos.urlLabel')}
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

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#656d76', marginBottom: '0.35rem', fontWeight: 600 }}>
                  {t('repos.branchLabel')}
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

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#656d76', marginBottom: '0.35rem', fontWeight: 600 }}>
                  {t('repos.dastUrlLabel')} <span style={{ fontWeight: 400 }}>({t('repos.optional')})</span>
                </label>
                <input
                  type="url"
                  placeholder="https://sspillowy.com"
                  value={dastUrl}
                  onChange={(e) => setDastUrl(e.target.value)}
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
                <p style={{ fontSize: '0.75rem', color: '#656d76', marginTop: '0.35rem' }}>
                  {t('repos.dastUrlHint')}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('repos.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? t('common.loading') : t('repos.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
