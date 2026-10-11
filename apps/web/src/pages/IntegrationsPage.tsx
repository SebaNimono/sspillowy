import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Plus, Search, Send, Settings, Unplug, X } from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { CiKeyPanel, CopyField, GithubWebhookPanel } from '../components/ConnectionPanels';
import { IntegrationLogo, LogoId } from '../components/IntegrationLogo';
import { AddRepoModal } from '../components/RepoModals';
import {
  ChatKind,
  IntegrationsOverview,
  RepoProvider,
  connectChatIntegration,
  disconnectChatIntegration,
  fetchIntegrations,
  testChatIntegration,
} from '../api/client';
import '../styles/integrations.css';

interface IntegrationsPageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const CATEGORIES = ['Repositorios', 'Motores de escaneo', 'CI/CD', 'Alertas y chat', 'Automatización', 'Gestión de tareas', 'Incidentes', 'Monitoreo'] as const;
type Category = (typeof CATEGORIES)[number];

interface Entry {
  id: string;
  name: string;
  logo: LogoId;
  category: Category;
  summary: string;
  installed: boolean;
  soon?: boolean;
  note?: string;
  warn?: boolean;
  keywords?: string;
  config?: React.ReactNode;
}

const CHAT_HELP: Record<ChatKind, { name: string; placeholder: string; steps: string[] }> = {
  slack: {
    name: 'Slack',
    placeholder: 'https://hooks.slack.com/services/…',
    steps: [
      'En Slack, abre api.slack.com/apps y crea una app para tu espacio de trabajo.',
      'Activa "Incoming Webhooks" y pulsa "Add New Webhook to Workspace".',
      'Elige el canal donde quieres las alertas y copia la URL que te entrega.',
    ],
  },
  teams: {
    name: 'Microsoft Teams',
    placeholder: 'https://….webhook.office.com/… o URL de un flujo',
    steps: [
      'En el canal de Teams, abre el menú ••• y elige "Flujos de trabajo".',
      'Usa la plantilla "Publicar en un canal cuando se reciba una solicitud de webhook".',
      'Al terminar, Teams te muestra una URL: cópiala.',
    ],
  },
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const REPO_PROVIDERS: { id: Exclude<RepoProvider, 'other'>; name: string; summary: string; keywords: string }[] = [
  { id: 'github', name: 'GitHub', summary: 'Repositorios públicos o privados de GitHub.', keywords: 'git' },
  { id: 'gitlab', name: 'GitLab', summary: 'Proyectos de GitLab.com o de tu propio servidor GitLab.', keywords: 'git self-hosted' },
  { id: 'bitbucket', name: 'Bitbucket', summary: 'Repositorios de Bitbucket Cloud.', keywords: 'git atlassian' },
  { id: 'azure', name: 'Azure DevOps', summary: 'Repositorios de Azure Repos.', keywords: 'git microsoft repos' },
];

const SCAN_ENGINES: { id: string; name: string; logo: LogoId; summary: string; keywords: string }[] = [
  { id: 'osv-scanner', name: 'OSV-Scanner', logo: 'osv', summary: 'Dependencias vulnerables usando la base pública OSV.dev.', keywords: 'sca dependencias google gratuito' },
  { id: 'grype', name: 'Grype', logo: 'grype', summary: 'Vulnerabilidades en imágenes de contenedor y paquetes.', keywords: 'contenedores docker imagenes anchore gratuito' },
  { id: 'dependency-check', name: 'OWASP Dependency-Check', logo: 'owasp', summary: 'Busca componentes con CVE conocidos en tus dependencias.', keywords: 'sca cve dependencias owasp gratuito' },
  { id: 'checkov', name: 'Checkov', logo: 'checkov', summary: 'Malas configuraciones en Terraform, Kubernetes y Dockerfiles.', keywords: 'iac infraestructura terraform kubernetes gratuito' },
  { id: 'bandit', name: 'Bandit', logo: 'bandit', summary: 'Análisis estático de seguridad para código Python.', keywords: 'sast python gratuito' },
  { id: 'sonarqube', name: 'SonarQube Community', logo: 'sonarqube', summary: 'Calidad y seguridad del código con la edición gratuita.', keywords: 'sast calidad codigo gratuito' },
  { id: 'nuclei', name: 'Nuclei', logo: 'nuclei', summary: 'Pruebas sobre la aplicación desplegada con plantillas abiertas.', keywords: 'dast web plantillas gratuito' },
  { id: 'trufflehog', name: 'TruffleHog', logo: 'trufflehog', summary: 'Secretos en el historial y verificación de si siguen activos.', keywords: 'secretos credenciales gratuito' },
];

function buildEntries(
  data: IntegrationsOverview,
  setData: (d: IntegrationsOverview) => void,
  go: (tab: string) => void,
  addRepo: (p: RepoProvider) => void,
): Entry[] {
  const entries: Entry[] = REPO_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    logo: p.id,
    category: 'Repositorios',
    summary: p.summary,
    keywords: p.keywords,
    installed: data[p.id].repos > 0,
    note: data[p.id].repos ? plural(data[p.id].repos, 'repositorio', 'repositorios') : undefined,
    config: (
      <>
        <p className="ig-hint">
          {data[p.id].repos
            ? `Tienes ${plural(data[p.id].repos, 'repositorio agregado', 'repositorios agregados')} de ${p.name} en este espacio.`
            : `Agrega tu primer repositorio de ${p.name}. Si es privado, te guiamos para crear un token de solo lectura.`}
        </p>
        <div className="ig-actions">
          <button type="button" className="btn btn-primary" onClick={() => addRepo(p.id)}>
            <Plus size={14} /> Agregar repositorio
          </button>
          {data[p.id].repos > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => go('repositories')}>
              Ver repositorios
            </button>
          )}
        </div>
      </>
    ),
  }));

  entries.push(
    {
      id: 'github-auto',
      name: 'Análisis automático con GitHub',
      logo: 'github-auto',
      category: 'Repositorios',
      summary: 'Analiza solo cada push y pull request.',
      keywords: 'webhook push pull request',
      installed: data.github.webhook_connected,
      note: data.github.webhook_connected
        ? data.github.webhook_last_event
          ? 'Recibiendo avisos'
          : 'Esperando el primer aviso'
        : undefined,
      config: <GithubWebhookPanel data={data} onChange={setData} />,
    },
    {
      id: 'pipeline',
      name: 'Security Gate en tu pipeline',
      logo: 'pipeline',
      category: 'CI/CD',
      summary: 'Detén el despliegue si el gate está bloqueado.',
      keywords: 'github actions gitlab ci jenkins pipeline despliegue gate clave',
      installed: data.cicd.key_ready,
      note: data.cicd.key_ready ? (data.cicd.key_last_used ? 'En uso' : 'Clave creada, sin usar aún') : undefined,
      config: (
        <>
          <p className="ig-hint">
            Gate del espacio: <strong>{data.cicd.gate_enabled ? 'activo' : 'apagado'}</strong>.{' '}
            <button type="button" className="ig-link" onClick={() => go('gates')}>
              Configurar reglas
            </button>
          </p>
          <CiKeyPanel data={data} onChange={setData} />
        </>
      ),
    },
    {
      id: 'email',
      name: 'Correo',
      logo: 'email',
      category: 'Alertas y chat',
      summary: 'Aviso por correo cuando el gate bloquea un despliegue.',
      keywords: 'email mail alertas',
      installed: data.email.ready,
      note: data.email.ready ? plural(data.email.recipients.length, 'destinatario', 'destinatarios') : undefined,
      config: (
        <>
          <p className="ig-hint">
            Incluido en SSPILLOWY. Avisamos a los propietarios y administradores del espacio; para sumar personas,
            invítalas como administradoras.
          </p>
          <ul className="ig-facts">
            {data.email.recipients.length ? data.email.recipients.map((e) => <li key={e}>{e}</li>) : <li>Sin destinatarios todavía</li>}
          </ul>
        </>
      ),
    },
    ...(['slack', 'teams'] as ChatKind[]).map(
      (kind): Entry => ({
        id: kind,
        name: CHAT_HELP[kind].name,
        logo: kind,
        category: 'Alertas y chat',
        summary: `Alertas del gate en un canal de ${CHAT_HELP[kind].name}.`,
        keywords: 'chat canal mensajes alertas webhook',
        installed: data.chat[kind].connected,
        note: data.chat[kind].connected ? (data.chat[kind].last_error ? 'Error en el último envío' : 'Conectado') : undefined,
        warn: Boolean(data.chat[kind].connected && data.chat[kind].last_error),
        config: <ChatBody kind={kind} data={data} onChange={setData} />,
      }),
    ),
    {
      id: 'webhooks',
      name: 'Webhooks personalizados',
      logo: 'webhooks',
      category: 'Automatización',
      summary: 'Envía avisos a cualquier servicio desde una automatización.',
      keywords: 'webhook api runbook automatizacion json',
      installed: false,
      config: (
        <>
          <p className="ig-hint">
            Crea una automatización que, al detectarse un secreto, un hallazgo nuevo o un bloqueo del gate, envíe un aviso
            en formato JSON a la URL que elijas.
          </p>
          <div className="ig-actions">
            <button type="button" className="btn btn-primary" onClick={() => go('runbooks')}>
              Crear automatización
            </button>
          </div>
        </>
      ),
    },
    { id: 'google-chat', name: 'Google Chat', logo: 'google-chat', category: 'Alertas y chat', summary: 'Alertas del gate en un espacio de Google Chat.', installed: false, soon: true, keywords: 'google workspace' },
    { id: 'jira', name: 'Jira', logo: 'jira', category: 'Gestión de tareas', summary: 'Crea tareas desde un hallazgo y ciérralas al corregirlo.', installed: false, soon: true, keywords: 'atlassian tickets' },
    { id: 'linear', name: 'Linear', logo: 'linear', category: 'Gestión de tareas', summary: 'Convierte hallazgos en issues con su severidad.', installed: false, soon: true, keywords: 'issues' },
    { id: 'pagerduty', name: 'PagerDuty', logo: 'pagerduty', category: 'Incidentes', summary: 'Abre un incidente ante un secreto expuesto o un crítico.', installed: false, soon: true, keywords: 'guardia on-call' },
    ...SCAN_ENGINES.map((e) => ({ ...e, category: 'Motores de escaneo' as const, installed: false, soon: true })),
  );

  if (data.platform) {
    const platform = data.platform;
    entries.push({
      id: 'prometheus',
      name: 'Prometheus y Grafana',
      logo: 'prometheus',
      category: 'Monitoreo',
      summary: 'Métricas de toda la plataforma (solo administradores).',
      keywords: 'metricas observabilidad dashboards',
      installed: platform.prometheus,
      config: (
        <>
          <small className="ig-label">Dirección de las métricas</small>
          <CopyField value={platform.metrics_url} />
          <div className="ig-actions">
            <button type="button" className="btn btn-secondary" onClick={() => go('observability')}>
              Ver observabilidad
            </button>
            {platform.grafana_url && (
              <a className="btn btn-secondary" href={platform.grafana_url} target="_blank" rel="noreferrer noopener">
                <ExternalLink size={14} /> Abrir Grafana
              </a>
            )}
          </div>
        </>
      ),
    });
  }
  return entries;
}

let cached: IntegrationsOverview | null = null;

export const IntegrationsPage: React.FC<IntegrationsPageProps> = ({ onNavigate, ...headerProps }) => {
  const [data, setDataState] = useState<IntegrationsOverview | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [addProvider, setAddProvider] = useState<RepoProvider | null>(null);

  const setData = (d: IntegrationsOverview) => {
    cached = d;
    setDataState(d);
  };

  const reload = () =>
    fetchIntegrations()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las integraciones.'));

  useEffect(() => {
    void reload();
  }, []);

  const go = (tab: string) => {
    setOpenId(null);
    onNavigate?.(tab);
  };

  const entries = useMemo(
    () => (data ? buildEntries(data, setData, go, (p) => setAddProvider(p)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return entries.filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (!q || normalize(`${e.name} ${e.category} ${e.summary} ${e.keywords ?? ''}`).includes(q)),
    );
  }, [entries, query, category]);

  const groups = [
    { key: 'installed', title: 'Instaladas', items: visible.filter((e) => e.installed) },
    { key: 'available', title: 'Disponibles', items: visible.filter((e) => !e.installed && !e.soon) },
    { key: 'soon', title: 'Próximamente', items: visible.filter((e) => e.soon) },
  ].filter((g) => g.items.length > 0);

  const open = entries.find((e) => e.id === openId) ?? null;
  const installedCount = entries.filter((e) => e.installed).length;

  return (
    <div>
      <Header
        title="Integraciones"
        subtitle="Conecta SSPILLOWY con las herramientas de tu equipo. Cada espacio configura las suyas."
        onNavigate={onNavigate}
        {...headerProps}
      />

      {error && !data && <div className="ig-empty">{error}</div>}
      {!data && !error && <div className="ig-empty">Cargando integraciones…</div>}

      {data && (
        <>
          <div className="ig-toolbar">
            <label className="ig-search">
              <Search size={15} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar integraciones"
                aria-label="Buscar integraciones"
              />
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category | 'all')} aria-label="Categoría">
              <option value="all">Todas las categorías</option>
              {CATEGORIES.filter((c) => entries.some((e) => e.category === c)).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="ig-count">
              {installedCount} de {entries.filter((e) => !e.soon).length} instaladas
            </span>
          </div>

          {groups.length === 0 ? (
            <div className="empty-state">
              <Search size={26} color="#656d76" />
              <h3>No hay integraciones que coincidan</h3>
              <p>Prueba con otra palabra o elige otra categoría.</p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                }}
              >
                Quitar filtros
              </button>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="ig-group">
                <h2 className="ig-section">
                  {g.title} <span>{g.items.length}</span>
                </h2>
                <div className="ig-grid">
                  {g.items.map((e) => (
                    <IntegrationCard key={e.id} entry={e} onOpen={() => setOpenId(e.id)} />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      {open && !addProvider && (
        <div className="modal-overlay" onClick={() => setOpenId(null)}>
          <div className="modal-content ig-modal" onClick={(ev) => ev.stopPropagation()}>
            <header className="ig-modal-head">
              <IntegrationLogo id={open.logo} size={28} />
              <div>
                <h2>{open.name}</h2>
                <span>
                  {open.category} · {open.installed ? 'Instalada' : 'No instalada'}
                </span>
              </div>
              <button type="button" className="ig-icon-btn" onClick={() => setOpenId(null)} aria-label="Cerrar">
                <X size={16} />
              </button>
            </header>
            <p className="ig-modal-summary">{open.summary}</p>
            <div className="ig-modal-body">{open.config}</div>
          </div>
        </div>
      )}

      {addProvider && (
        <AddRepoModal
          initialProvider={addProvider}
          onClose={() => setAddProvider(null)}
          onCreated={() => {
            setAddProvider(null);
            void reload();
          }}
        />
      )}
    </div>
  );
};

const IntegrationCard: React.FC<{ entry: Entry; onOpen: () => void }> = ({ entry: e, onOpen }) => (
  <article className={`ig-card ${e.soon ? 'is-soon' : ''}`}>
    <div className="ig-card-top">
      <IntegrationLogo id={e.logo} />
      <div className="ig-card-title">
        <strong>{e.name}</strong>
        <span>{e.category}</span>
      </div>
    </div>
    <p>{e.summary}</p>
    <footer>
      {e.soon ? (
        <span className="ig-state">Próximamente</span>
      ) : e.installed ? (
        <>
          <span className={`ig-state ${e.warn ? 'is-warn' : 'is-on'}`}>
            <i />
            {e.note || 'Instalada'}
          </span>
          <button type="button" className="ig-icon-btn" onClick={onOpen} aria-label={`Configurar ${e.name}`} title="Configurar">
            <Settings size={15} />
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-secondary ig-install" onClick={onOpen}>
          Instalar
        </button>
      )}
    </footer>
  </article>
);

const ChatBody: React.FC<{
  kind: ChatKind;
  data: IntegrationsOverview;
  onChange: (d: IntegrationsOverview) => void;
}> = ({ kind, data, onChange }) => {
  const help = CHAT_HELP[kind];
  const chat = data.chat[kind];
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<IntegrationsOverview>, ok?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      onChange(await fn());
      if (ok) setNotice(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {chat.connected ? (
        <>
          <ul className="ig-facts">
            <li>Canal: {chat.target}</li>
            {chat.last_ok_at && <li>Último mensaje entregado: {new Date(chat.last_ok_at).toLocaleString()}</li>}
            {chat.updated_by && <li>Conectado por {chat.updated_by}</li>}
          </ul>
          {chat.last_error && <p className="ig-error">{chat.last_error}</p>}
          {data.can_manage && (
            <div className="ig-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void run(() => testChatIntegration(kind), 'Mensaje de prueba enviado. Revisa el canal.')}
              >
                <Send size={14} /> Enviar prueba
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`¿Desinstalar ${help.name}? Dejarán de llegar alertas a ese canal.`)) {
                    void run(() => disconnectChatIntegration(kind));
                  }
                }}
              >
                <Unplug size={14} /> Desinstalar
              </button>
            </div>
          )}
        </>
      ) : data.can_manage ? (
        <>
          <ol className="ig-steps">
            {help.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <form
            className="ig-connect"
            onSubmit={(e) => {
              e.preventDefault();
              const value = url.trim();
              if (!value) return;
              void run(async () => {
                const out = await connectChatIntegration(kind, value);
                setUrl('');
                return out;
              }, `${help.name} instalado. Envía una prueba para confirmar.`);
            }}
          >
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={help.placeholder}
              aria-label={`URL del webhook de ${help.name}`}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Instalar
            </button>
          </form>
        </>
      ) : (
        <p className="ig-hint">Pide a un propietario o administrador del espacio que lo instale.</p>
      )}

      {error && <p className="ig-error">{error}</p>}
      {notice && <p className="ig-notice">{notice}</p>}
    </>
  );
};
