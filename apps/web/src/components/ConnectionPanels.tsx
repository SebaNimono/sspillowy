import React, { useState } from 'react';
import { Check, Copy, KeyRound, RefreshCw, Unplug } from 'lucide-react';
import {
  IntegrationsOverview,
  createCiKey,
  createGithubWebhook,
  deleteCiKey,
  deleteGithubWebhook,
} from '../api/client';
import '../styles/integrations.css';

export const CopyField: React.FC<{ value: string; multiline?: boolean }> = ({ value, multiline }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`ig-copy ${multiline ? 'is-block' : ''}`}>
      {multiline ? <pre>{value}</pre> : <code>{value}</code>}
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

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : null);

function useAction(onChange: (d: IntegrationsOverview) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>, pick: (r: T) => IntegrationsOverview): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      const out = await fn();
      onChange(pick(out));
      return out;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export const GithubWebhookPanel: React.FC<{
  data: IntegrationsOverview;
  onChange: (d: IntegrationsOverview) => void;
}> = ({ data, onChange }) => {
  const gh = data.github;
  const [fresh, setFresh] = useState<{ url: string; secret: string } | null>(null);
  const { busy, error, run } = useAction(onChange);

  const generate = async () => {
    const out = await run(createGithubWebhook, (r) => r.overview);
    if (out) setFresh({ url: out.url, secret: out.secret });
  };

  if (fresh) {
    return (
      <>
        <p className="ig-notice">Listo. Copia estos datos en GitHub ahora: el secreto no se vuelve a mostrar.</p>
        <ol className="ig-steps">
          <li>
            En GitHub abre tu repositorio (o tu organización, para cubrir todos sus repositorios) y entra en{' '}
            <strong>Settings → Webhooks → Add webhook</strong>.
          </li>
          <li>
            En <strong>Payload URL</strong> pega:
            <CopyField value={fresh.url} />
          </li>
          <li>
            En <strong>Content type</strong> elige <code>application/json</code>.
          </li>
          <li>
            En <strong>Secret</strong> pega:
            <CopyField value={fresh.secret} />
          </li>
          <li>
            En eventos elige <strong>Let me select individual events</strong> y marca <strong>Pushes</strong> y{' '}
            <strong>Pull requests</strong>. Guarda.
          </li>
        </ol>
        <p className="ig-hint">
          GitHub enviará un aviso de prueba. Desde ese momento, cada push o pull request de un repositorio agregado en
          este espacio se analiza solo.
        </p>
        <div className="ig-actions">
          <button type="button" className="btn btn-primary" onClick={() => setFresh(null)}>
            Ya lo configuré
          </button>
        </div>
      </>
    );
  }

  if (gh.webhook_connected) {
    return (
      <>
        <ul className="ig-facts">
          {gh.webhook_since && <li>Conectado el {when(gh.webhook_since)}</li>}
          <li>
            {gh.webhook_last_event
              ? `Último aviso de GitHub: ${when(gh.webhook_last_event)}`
              : 'Aún no recibimos avisos de GitHub'}
          </li>
        </ul>
        <small className="ig-label">URL del webhook</small>
        <CopyField value={gh.webhook_url} />
        {data.can_manage && (
          <div className="ig-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => {
                if (window.confirm('¿Generar un secreto nuevo? El actual dejará de funcionar hasta que lo reemplaces en GitHub.')) {
                  void generate();
                }
              }}
            >
              <RefreshCw size={14} /> Nuevo secreto
            </button>
            {gh.webhook_since && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('¿Desconectar el webhook? Los push dejarán de analizarse solos.')) {
                    void run(deleteGithubWebhook, (r) => r);
                  }
                }}
              >
                <Unplug size={14} /> Desconectar
              </button>
            )}
          </div>
        )}
        {error && <p className="ig-error">{error}</p>}
      </>
    );
  }

  return data.can_manage ? (
    <>
      <p className="ig-hint">
        Generamos una dirección y un secreto exclusivos de este espacio. Los pegas en GitHub y listo.
      </p>
      <div className="ig-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void generate()}>
          {busy ? 'Generando…' : 'Conectar'}
        </button>
      </div>
      {error && <p className="ig-error">{error}</p>}
    </>
  ) : (
    <p className="ig-hint">Pide a un propietario o administrador del espacio que lo conecte.</p>
  );
};

export function pipelineSnippet(checkUrl: string): string {
  return [
    '- name: Security Gate de SSPILLOWY',
    '  run: |',
    '    RESP=$(curl -fsS -H "X-SSPILLOWY-Key: ${{ secrets.SSPILLOWY_KEY }}" \\',
    `      "${checkUrl}?repository_url=https://github.com/\${{ github.repository }}")`,
    '    echo "$RESP"',
    '    echo "$RESP" | grep -q \'"allowed":true\' || { echo "El Security Gate bloqueó el despliegue"; exit 1; }',
  ].join('\n');
}

export const CiKeyPanel: React.FC<{
  data: IntegrationsOverview;
  onChange: (d: IntegrationsOverview) => void;
}> = ({ data, onChange }) => {
  const ci = data.cicd;
  const [fresh, setFresh] = useState<string | null>(null);
  const { busy, error, run } = useAction(onChange);

  const generate = async () => {
    const out = await run(createCiKey, (r) => r.overview);
    if (out) setFresh(out.key);
  };

  return (
    <>
      {fresh ? (
        <>
          <p className="ig-notice">Copia la clave ahora: no se vuelve a mostrar.</p>
          <CopyField value={fresh} />
          <ol className="ig-steps">
            <li>
              En tu repositorio de GitHub entra en <strong>Settings → Secrets and variables → Actions</strong>.
            </li>
            <li>
              Crea un secreto llamado <code>SSPILLOWY_KEY</code> con esta clave.
            </li>
            <li>Agrega el paso de abajo a tu workflow, antes del despliegue.</li>
          </ol>
        </>
      ) : ci.key_ready ? (
        <ul className="ig-facts">
          <li>
            <KeyRound size={13} /> Clave creada{ci.key_by ? ` por ${ci.key_by}` : ''}
            {ci.key_since ? ` el ${when(ci.key_since)}` : ''}
          </li>
          <li>{ci.key_last_used ? `Último uso: ${when(ci.key_last_used)}` : 'Tu pipeline aún no la ha usado'}</li>
        </ul>
      ) : (
        <p className="ig-hint">
          Tu pipeline se identifica con una clave de este espacio. Sin ella, la consulta no responde.
        </p>
      )}

      <small className="ig-label">Paso para GitHub Actions</small>
      <CopyField value={pipelineSnippet(ci.check_url)} multiline />
      <p className="ig-hint">
        En GitLab CI, Jenkins u otro, usa la misma llamada: envía la clave en la cabecera <code>X-SSPILLOWY-Key</code> y
        detén el despliegue si la respuesta trae <code>"allowed": false</code>.
      </p>

      {data.can_manage ? (
        <div className="ig-actions">
          {ci.key_ready ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('¿Renovar la clave? La actual dejará de funcionar en tus pipelines.')) void generate();
                }}
              >
                <RefreshCw size={14} /> Renovar clave
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('¿Revocar la clave? Los pipelines que la usan dejarán de poder consultar el gate.')) {
                    setFresh(null);
                    void run(deleteCiKey, (r) => r);
                  }
                }}
              >
                <Unplug size={14} /> Revocar
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void generate()}>
              {busy ? 'Creando…' : 'Crear clave'}
            </button>
          )}
        </div>
      ) : (
        !ci.key_ready && <p className="ig-hint">Pide a un propietario o administrador del espacio que cree la clave.</p>
      )}
      {error && <p className="ig-error">{error}</p>}
    </>
  );
};
