import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Boxes, ChevronDown, ChevronRight, Download, RefreshCw, Search } from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { SbomComponent, SbomRepository, downloadCycloneDx, fetchSbom } from '../api/client';
import { SEVERITY_COLOR, SEVERITY_LABEL, SEVERITY_RANK, Severity } from '../utils/findingGroups';
import { formatDateTime } from '../utils/formatDateTime';
import '../styles/sbom.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

type LicenseRisk = 'copyleft' | 'unknown' | 'ok';
type Filter = 'all' | 'vulnerable' | 'copyleft' | 'unknown' | 'direct';

const COPYLEFT_RE = /\b(A?GPL|LGPL|SSPL|EUPL|OSL|MPL|CC-BY-SA)/i;

const licenseRisk = (licenses: string | null): LicenseRisk => {
  if (!licenses) return 'unknown';
  return COPYLEFT_RE.test(licenses) ? 'copyleft' : 'ok';
};

const ECOSYSTEM_LABEL: Record<string, string> = {
  pip: 'Python · pip',
  pipenv: 'Python · Pipenv',
  poetry: 'Python · Poetry',
  npm: 'Node · npm',
  yarn: 'Node · Yarn',
  pnpm: 'Node · pnpm',
  gomod: 'Go',
  cargo: 'Rust',
  pom: 'Java · Maven',
  gradle: 'Java · Gradle',
  composer: 'PHP',
  bundler: 'Ruby',
  nuget: '.NET',
};

const ecoLabel = (eco: string | null) => (eco ? ECOSYSTEM_LABEL[eco] ?? eco : 'Otro');

interface PackageGroup {
  key: string;
  name: string;
  ecosystem: string | null;
  items: SbomComponent[];
  versions: string[];
  repos: string[];
  licenses: string | null;
  risk: LicenseRisk;
  worst: Severity | null;
  vulnCount: number;
  fixVersion: string | null;
  direct: boolean;
}

const PAGE_SIZE = 80;

export const SbomPage: React.FC<PageProps> = ({ onNavigate, ...headerProps }) => {
  const [repos, setRepos] = useState<SbomRepository[]>([]);
  const [components, setComponents] = useState<SbomComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [query, setQuery] = useState('');
  const [repoFilter, setRepoFilter] = useState('');
  const [ecoFilter, setEcoFilter] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [openChanges, setOpenChanges] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSbom();
      setRepos(data.repositories);
      setComponents(data.components);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el inventario');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scoped = useMemo(
    () => components.filter((c) => (!repoFilter || c.repository_id === repoFilter) && (!ecoFilter || c.ecosystem === ecoFilter)),
    [components, repoFilter, ecoFilter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, PackageGroup>();
    for (const c of scoped) {
      const key = `${c.ecosystem ?? ''}:${c.name}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          name: c.name,
          ecosystem: c.ecosystem,
          items: [],
          versions: [],
          repos: [],
          licenses: null,
          risk: 'unknown',
          worst: null,
          vulnCount: 0,
          fixVersion: null,
          direct: false,
        };
        map.set(key, g);
      }
      g.items.push(c);
      if (c.version && !g.versions.includes(c.version)) g.versions.push(c.version);
      const repoName = c.repository_name ?? c.repository_id;
      if (!g.repos.includes(repoName)) g.repos.push(repoName);
      if (c.licenses && !g.licenses) g.licenses = c.licenses;
      if (c.direct) g.direct = true;
      const v = c.vulnerabilities;
      if (v) {
        g.vulnCount += v.count;
        if (!g.worst || SEVERITY_RANK[v.max_severity] < SEVERITY_RANK[g.worst]) g.worst = v.max_severity;
        if (v.fix_version) g.fixVersion = v.fix_version;
      }
    }
    for (const g of map.values()) g.risk = licenseRisk(g.licenses);
    return [...map.values()].sort(
      (a, b) =>
        (a.worst ? SEVERITY_RANK[a.worst] : 9) - (b.worst ? SEVERITY_RANK[b.worst] : 9) ||
        b.repos.length - a.repos.length ||
        a.name.localeCompare(b.name),
    );
  }, [scoped]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => {
      if (filter === 'vulnerable' && !g.worst) return false;
      if (filter === 'copyleft' && g.risk !== 'copyleft') return false;
      if (filter === 'unknown' && g.risk !== 'unknown') return false;
      if (filter === 'direct' && !g.direct) return false;
      if (!q) return true;
      return g.name.toLowerCase().includes(q) || (g.licenses ?? '').toLowerCase().includes(q) || g.items.some((c) => (c.purl ?? '').toLowerCase().includes(q));
    });
  }, [groups, filter, query]);

  useEffect(() => setVisible(PAGE_SIZE), [filter, query, repoFilter, ecoFilter]);

  const kpis = useMemo(
    () => ({
      packages: groups.length,
      components: scoped.length,
      vulnerable: groups.filter((g) => g.worst).length,
      copyleft: groups.filter((g) => g.risk === 'copyleft').length,
      unknown: groups.filter((g) => g.risk === 'unknown').length,
    }),
    [groups, scoped],
  );

  const ecosystems = useMemo(() => [...new Set(components.map((c) => c.ecosystem).filter(Boolean) as string[])].sort(), [components]);
  const reposWithSbom = repos.filter((r) => r.generated_at);
  const shownRepos = repoFilter ? repos.filter((r) => r.id === repoFilter) : reposWithSbom;

  const exportRepo = async (repo: SbomRepository) => {
    try {
      const blob = await downloadCycloneDx(repo.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${repo.name.replace(/[^\w.-]+/g, '_')}.cdx.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'No se pudo exportar',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const chips: { id: Filter; label: string; count?: number }[] = [
    { id: 'all', label: 'Todos', count: kpis.packages },
    { id: 'vulnerable', label: 'Vulnerables', count: kpis.vulnerable },
    { id: 'copyleft', label: 'Licencia a revisar', count: kpis.copyleft },
    { id: 'unknown', label: 'Sin licencia', count: kpis.unknown },
    { id: 'direct', label: 'Directas' },
  ];

  const empty = loaded && !error && components.length === 0;

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header
        title="Supply Chain & SBOM"
        subtitle="Inventario vivo de las librerías que usa cada repositorio, con su versión, licencia y riesgo."
        onNavigate={onNavigate}
        {...headerProps}
      />

      {!loaded && (
        <div className="card sb-empty">
          <RefreshCw size={22} className="sb-spin" />
          <p>Cargando inventario de dependencias…</p>
        </div>
      )}

      {loaded && error && <div className="card sb-empty sb-error">{error}</div>}

      {empty && (
        <div className="card sb-empty">
          <Boxes size={30} />
          <h3>Aún no hay inventario de dependencias</h3>
          <p>
            El SBOM se genera en cada análisis que incluye dependencias. Lanza un escaneo con el perfil "Código completo" o "Solo SCA / IaC" y
            vuelve aquí.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('scans')}>
            <span>Ir a Escaneos</span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {loaded && !empty && !error && (
        <>
          <div className="sb-kpis">
            <div className="sb-kpi" style={{ ['--c' as string]: '#0969da' }}>
              <span className="sb-kpi-label">Paquetes únicos</span>
              <span className="sb-kpi-value">{kpis.packages}</span>
              <span className="sb-kpi-hint">{kpis.components} componentes en {repoFilter ? 1 : reposWithSbom.length} repos</span>
            </div>
            <div className="sb-kpi" style={{ ['--c' as string]: '#cf222e' }}>
              <span className="sb-kpi-label">Vulnerables</span>
              <span className="sb-kpi-value">{kpis.vulnerable}</span>
              <span className="sb-kpi-hint">con CVE activos</span>
            </div>
            <div className="sb-kpi" style={{ ['--c' as string]: '#9a6700' }}>
              <span className="sb-kpi-label">Licencia a revisar</span>
              <span className="sb-kpi-value">{kpis.copyleft}</span>
              <span className="sb-kpi-hint">GPL, AGPL, LGPL, MPL…</span>
            </div>
            <div className="sb-kpi" style={{ ['--c' as string]: '#6e7781' }}>
              <span className="sb-kpi-label">Sin licencia</span>
              <span className="sb-kpi-value">{kpis.unknown}</span>
              <span className="sb-kpi-hint">no declarada en el manifiesto</span>
            </div>
          </div>

          <div className="sb-layout">
            <div className="sb-main">
              <div className="card sb-toolbar">
                <label className="sb-search">
                  <Search size={14} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='Busca un paquete en toda la organización, p. ej. "log4j"'
                  />
                </label>
                <select className="sb-select" value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)}>
                  <option value="">Todos los repositorios</option>
                  {reposWithSbom.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select className="sb-select" value={ecoFilter} onChange={(e) => setEcoFilter(e.target.value)}>
                  <option value="">Todos los ecosistemas</option>
                  {ecosystems.map((e) => (
                    <option key={e} value={e}>
                      {ecoLabel(e)}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} title="Actualizar">
                  <RefreshCw size={14} className={loading ? 'sb-spin' : ''} />
                </button>
                <div className="sb-chips">
                  {chips.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`sb-chip ${filter === c.id ? 'is-active' : ''}`}
                      onClick={() => setFilter(c.id)}
                    >
                      {c.label}
                      {c.count !== undefined && <em>{c.count}</em>}
                    </button>
                  ))}
                </div>
              </div>

              {query.trim() && (
                <div className="sb-answer">
                  {filtered.length === 0 ? (
                    <>
                      <strong>No</strong>, ningún repositorio usa un paquete que coincida con "{query.trim()}".
                    </>
                  ) : (
                    <>
                      <strong>Sí</strong>: {filtered.length} paquete{filtered.length === 1 ? '' : 's'} coincide
                      {filtered.length === 1 ? '' : 'n'}, presente{filtered.length === 1 ? '' : 's'} en{' '}
                      {new Set(filtered.flatMap((g) => g.repos)).size} repositorio(s).
                    </>
                  )}
                </div>
              )}

              <div className="card sb-table-card">
                <table className="sb-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Paquete</th>
                      <th>Versiones</th>
                      <th>Licencia</th>
                      <th>Repositorios</th>
                      <th>Riesgo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, visible).map((g) => {
                      const open = expanded === g.key;
                      return (
                        <React.Fragment key={g.key}>
                          <tr className={open ? 'is-open' : ''} onClick={() => setExpanded(open ? null : g.key)}>
                            <td className="sb-caret">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                            <td>
                              <strong className="sb-name">{g.name}</strong>
                              <span className="sb-eco">
                                {ecoLabel(g.ecosystem)}
                                {g.direct && <span className="sb-direct">directa</span>}
                              </span>
                            </td>
                            <td>
                              <div className="sb-versions">
                                {g.versions.slice(0, 4).map((v) => (
                                  <code key={v}>{v}</code>
                                ))}
                                {g.versions.length > 4 && <span>+{g.versions.length - 4}</span>}
                              </div>
                            </td>
                            <td>
                              <span className={`sb-license is-${g.risk}`}>{g.licenses ?? 'Sin declarar'}</span>
                            </td>
                            <td className="sb-repos">{g.repos.length === 1 ? g.repos[0] : `${g.repos.length} repositorios`}</td>
                            <td>
                              {g.worst ? (
                                <div className="sb-risk">
                                  <span className="sb-sev" style={{ ['--c' as string]: SEVERITY_COLOR[g.worst] }}>
                                    {SEVERITY_LABEL[g.worst]} · {g.vulnCount} CVE
                                  </span>
                                  {g.fixVersion && <small>Actualizar a {g.fixVersion}</small>}
                                </div>
                              ) : (
                                <span className="sb-ok">Sin CVE conocidos</span>
                              )}
                            </td>
                          </tr>
                          {open && (
                            <tr className="sb-detail-row">
                              <td />
                              <td colSpan={5}>
                                <table className="sb-occ">
                                  <thead>
                                    <tr>
                                      <th>Repositorio</th>
                                      <th>Versión</th>
                                      <th>Manifiesto</th>
                                      <th>Vulnerabilidades</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {g.items.map((c) => (
                                      <tr key={c.id}>
                                        <td>{c.repository_name ?? c.repository_id}</td>
                                        <td>
                                          <code>{c.version ?? '—'}</code>
                                        </td>
                                        <td>
                                          <code>{c.manifest ?? '—'}</code>
                                        </td>
                                        <td>
                                          {c.vulnerabilities ? (
                                            <span className="sb-cves">
                                              {c.vulnerabilities.cves.join(', ')}
                                              {c.vulnerabilities.fix_version && ` → ${c.vulnerabilities.fix_version}`}
                                            </span>
                                          ) : (
                                            '—'
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {g.worst && (
                                  <button type="button" className="sb-link" onClick={() => onNavigate?.('findings')}>
                                    Ver los CVE en Priorización contextual <ArrowRight size={13} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && !loading && <p className="sb-none">Ningún paquete coincide con los filtros.</p>}
                {filtered.length > visible && (
                  <div className="sb-more">
                    <button type="button" className="btn btn-secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                      Ver más ({filtered.length - visible} restantes)
                    </button>
                  </div>
                )}
              </div>
            </div>

            <aside className="sb-side">
              <h3>Repositorios</h3>
              {shownRepos.map((r) => {
                const { added, removed, updated } = r.changes;
                const changes = added.length + removed.length + updated.length;
                const open = openChanges === r.id;
                return (
                  <div key={r.id} className="card sb-repo">
                    <div className="sb-repo-head">
                      <strong>{r.name}</strong>
                      <button
                        type="button"
                        className="sb-icon-btn"
                        title="Exportar CycloneDX"
                        disabled={!r.generated_at}
                        onClick={() => exportRepo(r)}
                      >
                        <Download size={15} />
                      </button>
                    </div>
                    {r.generated_at ? (
                      <>
                        <p className="sb-repo-meta">
                          {r.component_count} componentes · <span className={r.vulnerable_count ? 'is-bad' : ''}>{r.vulnerable_count} vulnerables</span>
                        </p>
                        <p className="sb-repo-date">SBOM del {formatDateTime(r.generated_at)}</p>
                        <div className="sb-ecos">
                          {Object.entries(r.ecosystems).map(([eco, n]) => (
                            <span key={eco}>
                              {ecoLabel(eco)} · {n}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="sb-changes-toggle"
                          disabled={!changes}
                          onClick={() => setOpenChanges(open ? null : r.id)}
                        >
                          {changes ? (
                            <>
                              Cambios del último análisis: <b className="is-add">+{added.length}</b> <b className="is-del">−{removed.length}</b>{' '}
                              <b className="is-upd">↑{updated.length}</b>
                            </>
                          ) : (
                            'Sin cambios respecto al análisis anterior'
                          )}
                        </button>
                        {open && (
                          <ul className="sb-changes">
                            {added.map((c) => (
                              <li key={`a${c.ecosystem}${c.name}`} className="is-add">
                                + {c.name} <code>{c.version}</code>
                              </li>
                            ))}
                            {updated.map((c) => (
                              <li key={`u${c.ecosystem}${c.name}`} className="is-upd">
                                ↑ {c.name} <code>{c.from}</code> → <code>{c.to}</code>
                              </li>
                            ))}
                            {removed.map((c) => (
                              <li key={`r${c.ecosystem}${c.name}`} className="is-del">
                                − {c.name} <code>{c.version}</code>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <p className="sb-repo-meta">Sin SBOM todavía: lanza un análisis de dependencias.</p>
                    )}
                  </div>
                );
              })}
            </aside>
          </div>
        </>
      )}
    </div>
  );
};
