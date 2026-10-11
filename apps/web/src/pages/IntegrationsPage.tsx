import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Send, Unplug } from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import {
  ChatKind,
  IntegrationsOverview,
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

const CopyField: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ig-copy">
      <code>{value}</code>
      <button
        type="button"
        className="ig-icon-btn"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
        aria-label="Copiar"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
};

let cached: IntegrationsOverview | null = null;

export const IntegrationsPage: React.FC<IntegrationsPageProps> = ({ onNavigate, ...headerProps }) => {
  const [data, setDataState] = useState<IntegrationsOverview | null>(cached);
  const [error, setError] = useState<string | null>(null);

  const setData = (d: IntegrationsOverview) => {
    cached = d;
    setDataState(d);
  };

  useEffect(() => {
    fetchIntegrations()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las integraciones.'));
  }, []);

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
          <h2 className="ig-section">Repositorios</h2>
          <div className="ig-grid">
            <article className="ig-card">
              <header>
                <strong>GitHub</strong>
                <Badge status={data.github.repos ? 'on' : 'ready'} />
              </header>
              <p>
                Analiza repositorios de GitHub con solo pegar su URL. Con el webhook, cada push o pull request se analiza
                solo.
              </p>
              <ul className="ig-facts">
                <li>
                  {data.github.repos} {data.github.repos === 1 ? 'repositorio conectado' : 'repositorios conectados'}
                </li>
                <li>Análisis automático por webhook: {data.github.webhook_ready ? 'disponible' : 'no habilitado en el servidor'}</li>
              </ul>
              {data.github.webhook_ready && (
                <>
                  <small className="ig-label">URL del webhook</small>
                  <CopyField value={data.github.webhook_url} />
                </>
              )}
              <div className="ig-actions">
                <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('repositories')}>
                  Conectar repositorio
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => onNavigate?.('docs')}>
                  Guía del webhook
                </button>
              </div>
            </article>

            <article className="ig-card">
              <header>
                <strong>GitLab</strong>
                <Badge status={data.gitlab.repos ? 'on' : 'ready'} />
              </header>
              <p>Analiza proyectos de GitLab igual que los de GitHub: pega la URL del repositorio y lanza el análisis.</p>
              <ul className="ig-facts">
                <li>
                  {data.gitlab.repos} {data.gitlab.repos === 1 ? 'repositorio conectado' : 'repositorios conectados'}
                </li>
              </ul>
              <div className="ig-actions">
                <button type="button" className="btn btn-secondary" onClick={() => onNavigate?.('repositories')}>
                  Conectar repositorio
                </button>
              </div>
            </article>

            <article className="ig-card">
              <header>
                <strong>CI/CD · Security Gate</strong>
                <Badge status={data.cicd.repos && data.cicd.gate_enabled ? 'on' : 'ready'} />
              </header>
              <p>
                Tu pipeline (GitHub Actions, GitLab CI, Jenkins…) consulta el gate antes de desplegar y se detiene si hay
                problemas graves sin resolver.
              </p>
              <ul className="ig-facts">
                <li>Gate del espacio: {data.cicd.gate_enabled ? 'activo' : 'desactivado'}</li>
              </ul>
              <small className="ig-label">Consulta desde tu pipeline</small>
              <CopyField value={`${data.cicd.check_url}?repository_url=<URL de tu repositorio>`} />
              <div className="ig-actions">
                <button type="button" className="btn btn-secondary" onClick={() => onNavigate?.('gates')}>
                  Configurar gate
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => onNavigate?.('docs')}>
                  Ver ejemplo de pipeline
                </button>
              </div>
            </article>
          </div>

          <h2 className="ig-section">Alertas</h2>
          <div className="ig-grid">
            <article className="ig-card">
              <header>
                <strong>Correo</strong>
                <Badge status={data.email.ready ? 'on' : 'off'} />
              </header>
              <p>Cuando el Security Gate bloquea un despliegue, avisamos por correo a los propietarios y administradores del espacio.</p>
              <ul className="ig-facts">
                {data.email.recipients.length ? (
                  data.email.recipients.map((e) => <li key={e}>{e}</li>)
                ) : (
                  <li>Sin destinatarios todavía</li>
                )}
              </ul>
            </article>

            {(['slack', 'teams'] as ChatKind[]).map((kind) => (
              <ChatCard key={kind} kind={kind} data={data} onChange={setData} />
            ))}
          </div>

          <h2 className="ig-section">Gestión de tareas</h2>
          <div className="ig-grid">
            <article className="ig-card is-muted">
              <header>
                <strong>Jira</strong>
                <Badge status="soon" />
              </header>
              <p>Crear una tarea en Jira desde un hallazgo y cerrarla sola cuando el siguiente análisis confirme la corrección.</p>
            </article>
          </div>

          {data.platform && (
            <>
              <h2 className="ig-section">Monitoreo de la plataforma</h2>
              <div className="ig-grid">
                <article className="ig-card">
                  <header>
                    <strong>Prometheus y Grafana</strong>
                    <Badge status={data.platform.prometheus ? 'on' : 'off'} />
                  </header>
                  <p>Métricas de funcionamiento de toda la plataforma. Solo las ven los administradores de la plataforma.</p>
                  <CopyField value={data.platform.metrics_url} />
                  <div className="ig-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => onNavigate?.('observability')}>
                      Ver observabilidad
                    </button>
                    {data.platform.grafana_url && (
                      <a className="btn btn-secondary" href={data.platform.grafana_url} target="_blank" rel="noreferrer noopener">
                        <ExternalLink size={14} /> Abrir Grafana
                      </a>
                    )}
                  </div>
                </article>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

const ChatCard: React.FC<{
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
    <article className="ig-card">
      <header>
        <strong>{help.name}</strong>
        <Badge status={chat.connected ? 'on' : 'ready'} />
      </header>
      <p>Recibe en un canal de {help.name} las alertas cuando el Security Gate bloquea un despliegue.</p>

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
    </article>
  );
};
