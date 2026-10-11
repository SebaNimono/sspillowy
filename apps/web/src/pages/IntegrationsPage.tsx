import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search, Send, Unplug } from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { CiKeyPanel, CopyField, GithubWebhookPanel } from '../components/ConnectionPanels';
import { ProviderLogo } from '../components/ProviderLogo';
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

type Status = 'on' | 'ready' | 'off' | 'soon';

const STATUS_LABEL: Record<Status, string> = {
  on: 'Conectado',
  ready: 'Disponible',
  off: 'Sin configurar',
  soon: 'Próximamente',
};

const CATEGORIES = [
  'Repositorios',
  'CI/CD',
  'Alertas y chat',
  'Automatización',
  'Gestión de tareas',
  'Incidentes',
  'Monitoreo',
] as const;
type Category = (typeof CATEGORIES)[number];

interface Entry {
  id: string;
  name: string;
  logo?: RepoProvider;
  category: Category;
  status: Status;
  description: string;
  keywords?: string;
  body?: React.ReactNode;
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

const Badge: React.FC<{ status: Status }> = ({ status }) => (
  <span className={`ig-badge is-${status}`}>{STATUS_LABEL[status]}</span>
);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function buildEntries(
  data: IntegrationsOverview,
  onNavigate: ((tab: string) => void) | undefined,
  setData: (d: IntegrationsOverview) => void,
): Entry[] {
  const go = (tab: string, label: string, primary = false) => (
    <button type="button" className={primary ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => onNavigate?.(tab)}>
      {label}
    </button>
  );
  const repoEntry = (
    id: 'gitlab' | 'bitbucket' | 'azure',
    name: string,
    description: string,
    keywords: string,
  ): Entry => ({
    id,
    name,
    logo: id,
    category: 'Repositorios',
    status: data[id].repos ? 'on' : 'ready',
    description,
    keywords,
    body: (
      <>
        <ul className="ig-facts">
          <li>{plural(data[id].repos, 'repositorio agregado', 'repositorios agregados')}</li>
        </ul>
        <div className="ig-actions">{go('repositories', 'Agregar repositorio')}</div>
      </>
    ),
  });

  const entries: Entry[] = [
    {
      id: 'github',
      name: 'GitHub',
      logo: 'github',
      category: 'Repositorios',
      status: data.github.repos ? 'on' : 'ready',
      description: 'Agrega repositorios públicos o privados de GitHub y analízalos cuando quieras.',
      keywords: 'git repositorio privado token',
      body: (
        <>
          <ul className="ig-facts">
            <li>{plural(data.github.repos, 'repositorio agregado', 'repositorios agregados')}</li>
          </ul>
          <div className="ig-actions">{go('repositories', 'Agregar repositorio', true)}</div>
        </>
      ),
    },
    {
      id: 'github-webhook',
      name: 'Análisis automático con GitHub',
      logo: 'github',
      category: 'Repositorios',
      status: data.github.webhook_connected ? 'on' : 'ready',
      description: 'Cada push o pull request de tus repositorios de GitHub se analiza solo, sin entrar a SSPILLOWY.',
      keywords: 'webhook push pull request automatico',
      body: <GithubWebhookPanel data={data} onChange={setData} />,
    },
    repoEntry('gitlab', 'GitLab', 'Agrega proyectos de GitLab.com o de tu propio servidor GitLab, públicos o privados.', 'git self-hosted'),
    repoEntry('bitbucket', 'Bitbucket', 'Agrega repositorios de Bitbucket Cloud, públicos o privados.', 'git atlassian'),
    repoEntry('azure', 'Azure DevOps', 'Agrega repositorios de Azure Repos usando un token personal de acceso.', 'git microsoft repos'),
    {
      id: 'cicd',
      name: 'Security Gate en tu pipeline',
      category: 'CI/CD',
      status: data.cicd.key_ready ? 'on' : 'ready',
      description:
        'Tu pipeline (GitHub Actions, GitLab CI, Jenkins…) consulta el gate antes de desplegar y se detiene si hay problemas graves sin resolver.',
      keywords: 'github actions gitlab ci jenkins pipeline despliegue gate clave',
      body: (
        <>
          <ul className="ig-facts">
            <li>Gate del espacio: {data.cicd.gate_enabled ? 'activo' : 'desactivado'}</li>
          </ul>
          <CiKeyPanel data={data} onChange={setData} />
          <div className="ig-actions">{go('gates', 'Configurar reglas del gate')}</div>
        </>
      ),
    },
    {
      id: 'email',
      name: 'Correo',
      category: 'Alertas y chat',
      status: data.email.ready ? 'on' : 'off',
      description: 'Cuando el Security Gate bloquea un despliegue, avisamos por correo a los propietarios y administradores del espacio.',
      keywords: 'email mail alertas',
      body: (
        <ul className="ig-facts">
          {data.email.recipients.length ? data.email.recipients.map((e) => <li key={e}>{e}</li>) : <li>Sin destinatarios todavía</li>}
        </ul>
      ),
    },
    ...(['slack', 'teams'] as ChatKind[]).map(
      (kind): Entry => ({
        id: kind,
        name: CHAT_HELP[kind].name,
        category: 'Alertas y chat',
        status: data.chat[kind].connected ? 'on' : 'ready',
        description: `Recibe en un canal de ${CHAT_HELP[kind].name} las alertas cuando el Security Gate bloquea un despliegue.`,
        keywords: 'chat canal mensajes alertas webhook',
        body: <ChatBody kind={kind} data={data} onChange={setData} />,
      }),
    ),
    {
      id: 'google-chat',
      name: 'Google Chat',
      category: 'Alertas y chat',
      status: 'soon',
      description: 'Alertas del Security Gate en un espacio de Google Chat.',
      keywords: 'chat google workspace',
    },
    {
      id: 'webhooks',
      name: 'Webhooks personalizados',
      category: 'Automatización',
      status: 'ready',
      description:
        'Envía un aviso a cualquier servicio cuando se detecta un secreto, un hallazgo nuevo o un bloqueo del gate, desde una automatización.',
      keywords: 'webhook api runbook automatizacion json',
      body: <div className="ig-actions">{go('runbooks', 'Crear automatización')}</div>,
    },
    {
      id: 'jira',
      name: 'Jira',
      category: 'Gestión de tareas',
      status: 'soon',
      description: 'Crear una tarea desde un hallazgo y cerrarla sola cuando el siguiente análisis confirme la corrección.',
      keywords: 'atlassian tickets tareas',
    },
    {
      id: 'linear',
      name: 'Linear',
      category: 'Gestión de tareas',
      status: 'soon',
      description: 'Convertir hallazgos en issues de Linear con su severidad y plazo.',
      keywords: 'issues tareas',
    },
    {
      id: 'pagerduty',
      name: 'PagerDuty',
      category: 'Incidentes',
      status: 'soon',
      description: 'Abrir un incidente cuando aparece un secreto expuesto o un crítico en producción.',
      keywords: 'guardia on-call incidentes',
    },
  ];

  if (data.platform) {
    entries.push({
      id: 'prometheus',
      name: 'Prometheus y Grafana',
      category: 'Monitoreo',
      status: data.platform.prometheus ? 'on' : 'off',
      description: 'Métricas de funcionamiento de toda la plataforma. Solo las ven los administradores de la plataforma.',
      keywords: 'metricas observabilidad dashboards',
      body: (
        <>
          <CopyField value={data.platform.metrics_url} />
          <div className="ig-actions">
            {go('observability', 'Ver observabilidad')}
            {data.platform.grafana_url && (
              <a className="btn btn-secondary" href={data.platform.grafana_url} target="_blank" rel="noreferrer noopener">
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

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

let cached: IntegrationsOverview | null = null;

export const IntegrationsPage: React.FC<IntegrationsPageProps> = ({ onNavigate, ...headerProps }) => {
  const [data, setDataState] = useState<IntegrationsOverview | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [status, setStatus] = useState<Status | 'all'>('all');

  const setData = (d: IntegrationsOverview) => {
    cached = d;
    setDataState(d);
  };

  useEffect(() => {
    fetchIntegrations()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las integraciones.'));
  }, []);

  const entries = useMemo(() => (data ? buildEntries(data, onNavigate, setData) : []), [data, onNavigate]);
  const categories = CATEGORIES.filter((c) => entries.some((e) => e.category === c));

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return entries.filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (status === 'all' || e.status === status) &&
        (!q || normalize(`${e.name} ${e.category} ${e.description} ${e.keywords ?? ''}`).includes(q)),
    );
  }, [entries, query, category, status]);

  const connected = entries.filter((e) => e.status === 'on').length;

  return (
    <div>
      <Header
        title="Integraciones"
        subtitle="Conecta SSPILLOWY con las herramientas de tu equipo. Cada espacio configura las suyas."
        onNavigate={onNavigate}
        {...headerProps}
      />

      {error && !data && <div className="card ig-empty">{error}</div>}
      {!data && !error && <div className="card ig-empty">Cargando integraciones…</div>}

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
            <select value={status} onChange={(e) => setStatus(e.target.value as Status | 'all')} aria-label="Estado">
              <option value="all">Todos los estados</option>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <span className="ig-count">
              {connected} de {entries.length} conectadas
            </span>
          </div>

          <div className="ig-chips" role="group" aria-label="Categorías">
            <button type="button" className={category === 'all' ? 'is-active' : ''} onClick={() => setCategory('all')}>
              Todas
            </button>
            {categories.map((c) => (
              <button key={c} type="button" className={category === c ? 'is-active' : ''} onClick={() => setCategory(c)}>
                {c}
                <span>{entries.filter((e) => e.category === c).length}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="empty-state">
              <Search size={26} color="#656d76" />
              <h3>No hay integraciones que coincidan</h3>
              <p>Prueba con otra palabra o quita los filtros.</p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                  setStatus('all');
                }}
              >
                Quitar filtros
              </button>
            </div>
          ) : (
            categories
              .filter((c) => visible.some((e) => e.category === c))
              .map((c) => (
                <section key={c}>
                  <h2 className="ig-section">{c}</h2>
                  <div className="ig-grid">
                    {visible
                      .filter((e) => e.category === c)
                      .map((e) => (
                        <article key={e.id} className={`ig-card ${e.status === 'soon' ? 'is-muted' : ''}`}>
                          <header>
                            {e.logo && <ProviderLogo provider={e.logo} size={20} />}
                            <strong>{e.name}</strong>
                            <Badge status={e.status} />
                          </header>
                          <p>{e.description}</p>
                          {e.body}
                        </article>
                      ))}
                  </div>
                </section>
              ))
          )}
        </>
      )}
    </div>
  );
};

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
                  if (window.confirm(`¿Desconectar ${help.name}? Dejarán de llegar alertas a ese canal.`)) {
                    void run(() => disconnectChatIntegration(kind));
                  }
                }}
              >
                <Unplug size={14} /> Desconectar
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
              }, `${help.name} conectado. Envía una prueba para confirmar.`);
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
              Conectar
            </button>
          </form>
        </>
      ) : (
        <p className="ig-hint">Pide a un propietario o administrador del espacio que lo conecte.</p>
      )}

      {error && <p className="ig-error">{error}</p>}
      {notice && <p className="ig-notice">{notice}</p>}
    </>
  );
};
