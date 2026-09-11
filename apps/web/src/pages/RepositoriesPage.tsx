import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { Repository, fetchRepositories, createRepository, triggerScan } from '../api/client';
import { FolderGit2, Plus, Play, GitBranch, RefreshCw } from 'lucide-react';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

export const RepositoriesPage: React.FC<PageProps> = ({ sidebarState, setSidebarState, user, onLogout, onNavigate, unreadCount, onGoToSite }) => {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [submitting, setSubmitting] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  const loadRepos = () => {
    setLoading(true);
    fetchRepositories()
      .then((data) => setRepos(data || []))
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
  };

  useEffect(() => {
    loadRepos();
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
    setScanStatus(`Semgrep en curso para ${repoName} (clone + análisis)…`);
    try {
      await triggerScan(repoId);
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Escaneo iniciado',
        message: `Semgrep está analizando ${repoName}. En unos segundos refresca Hallazgos / Escaneos.`,
      });
      // Dar tiempo al background job y refrescar contadores del repo
      setTimeout(() => {
        loadRepos();
        setScanStatus(`Escaneo de ${repoName} encolado. Revisa Escaneos/Hallazgos para el resultado.`);
        setTimeout(() => setScanStatus(null), 4000);
      }, 8000);
    } catch (err) {
      setScanStatus(null);
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'No se pudo iniciar el escaneo',
        message: err instanceof Error ? err.message : 'Error de API',
      });
    }
  };

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <Header
        title="Gestión de Repositorios"
        subtitle="Registro de repositorios Git monitoreados, estado de salud y escaneo bajo demanda"
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      {scanStatus && (
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
          <span>{scanStatus}</span>
        </div>
      )}

      {/* Repositories Card Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FolderGit2 size={20} color="#0969da" />
            <span>Repositorios Monitoreados ({repos.length})</span>
          </div>

          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            <span>+ Nuevo Repositorio</span>
          </button>
        </div>

        {loading ? (
          <div style={{ color: '#656d76', padding: '2rem', textAlign: 'center' }}>
            <RefreshCw size={20} className="spin" style={{ marginBottom: '0.5rem' }} />
            <div>Cargando inventario de repositorios...</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Nombre Repositorio</th>
                  <th>Rama</th>
                  <th>Health Score</th>
                  <th>Críticas</th>
                  <th>Total Hallazgos</th>
                  <th>Acciones DevSecOps</th>
                </tr>
              </thead>
              <tbody>
                {repos.map((repo) => (
                  <tr key={repo.id}>
                    <td>
                      <span className="status-dot" title="Monitoreo activo"></span>
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
                        {repo.open_criticals} Críticas
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, color: '#656d76' }}>{repo.total_findings} hallazgos</td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => handleTriggerScan(repo.id, repo.name)}
                      >
                        <Play size={14} color="#0969da" />
                        <span>Ejecutar Escaneo</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para agregar repositorio */}
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
