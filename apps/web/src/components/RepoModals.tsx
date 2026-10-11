import React, { useState } from 'react';
import { ArrowLeft, ExternalLink, Lock, ShieldCheck } from 'lucide-react';
import {
  RepoAccessResult,
  RepoProvider,
  Repository,
  checkRepoAccess,
  createRepository,
  updateRepository,
} from '../api/client';
import { PROVIDER_LABEL, ProviderLogo } from './ProviderLogo';
import '../styles/repos.css';

const PROVIDERS: RepoProvider[] = ['github', 'gitlab', 'bitbucket', 'azure', 'other'];

const URL_PLACEHOLDER: Record<RepoProvider, string> = {
  github: 'https://github.com/mi-org/mi-repo',
  gitlab: 'https://gitlab.com/mi-grupo/mi-proyecto',
  bitbucket: 'https://bitbucket.org/mi-equipo/mi-repo',
  azure: 'https://dev.azure.com/mi-org/mi-proyecto/_git/mi-repo',
  other: 'https://git.miempresa.com/equipo/repo',
};

const TOKEN_HELP: Record<RepoProvider, { steps: React.ReactNode[]; link?: string }> = {
  github: {
    link: 'https://github.com/settings/personal-access-tokens/new',
    steps: [
      <>En GitHub abre <strong>Settings → Developer settings → Personal access tokens → Fine-grained tokens</strong> y pulsa <strong>Generate new token</strong>.</>,
      <>En <strong>Repository access</strong> elige <strong>Only select repositories</strong> y marca este repositorio.</>,
      <>En <strong>Repository permissions</strong> da a <strong>Contents</strong> el permiso <strong>Read-only</strong>.</>,
      <>Genera el token, cópialo y pégalo aquí abajo.</>,
    ],
  },
  gitlab: {
    steps: [
      <>En el proyecto de GitLab abre <strong>Settings → Access tokens</strong> y pulsa <strong>Add new token</strong>.</>,
      <>Elige el rol <strong>Reporter</strong> y marca solo el alcance <strong>read_repository</strong>.</>,
      <>Crea el token, cópialo y pégalo aquí abajo.</>,
    ],
  },
  bitbucket: {
    steps: [
      <>En el repositorio de Bitbucket abre <strong>Repository settings → Access tokens</strong> y pulsa <strong>Create repository access token</strong>.</>,
      <>Marca solo el permiso <strong>Repositories: Read</strong>.</>,
      <>Crea el token, cópialo y pégalo aquí abajo.</>,
    ],
  },
  azure: {
    steps: [
      <>En Azure DevOps abre <strong>User settings → Personal access tokens</strong> y pulsa <strong>New Token</strong>.</>,
      <>Elige la organización del repositorio y en <strong>Scopes</strong> marca solo <strong>Code: Read</strong>.</>,
      <>Crea el token, cópialo y pégalo aquí abajo.</>,
    ],
  },
  other: {
    steps: [
      <>En tu servidor Git crea un token (o contraseña de aplicación) con permiso de <strong>solo lectura</strong> sobre este repositorio.</>,
      <>Cópialo y pégalo aquí abajo.</>,
    ],
  },
};

const TokenSteps: React.FC<{ provider: RepoProvider }> = ({ provider }) => {
  const help = TOKEN_HELP[provider];
  return (
    <>
      <ol className="rp-steps">
        {help.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {help.link && (
        <a className="rp-link" href={help.link} target="_blank" rel="noreferrer noopener">
          <ExternalLink size={13} /> Crear el token en {PROVIDER_LABEL[provider]}
        </a>
      )}
      <p className="rp-note">
        <Lock size={12} /> Guardamos el token cifrado y solo lo usamos para descargar el código al analizarlo.
      </p>
    </>
  );
};

const nameFromUrl = (u: string) =>
  u
    .trim()
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
    .split('/')
    .pop() || '';

export const AddRepoModal: React.FC<{
  onClose: () => void;
  onCreated: (repo: Repository) => void;
}> = ({ onClose, onCreated }) => {
  const [provider, setProvider] = useState<RepoProvider | null>(null);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [token, setToken] = useState('');
  const [access, setAccess] = useState<RepoAccessResult | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  const reset = (p: RepoProvider | null) => {
    setProvider(p);
    setAccess(null);
    setNeedsToken(false);
    setToken('');
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let result = access;
      if (!result?.ok) {
        result = await checkRepoAccess(url, provider, needsToken ? token : undefined);
        setAccess(result);
        if (!result.ok) {
          if (result.reason === 'needs_token' || result.reason === 'bad_token') setNeedsToken(true);
          return;
        }
        setUrl(result.url);
        if (!name.trim()) setName(result.suggested_name);
        if (!branch.trim() && result.default_branch) setBranch(result.default_branch);
      }
      const repo = await createRepository({
        name: name.trim() || result.suggested_name,
        url: result.url,
        branch: branch.trim() || result.default_branch || 'main',
        dastUrl: appUrl,
        provider,
        accessToken: needsToken ? token : undefined,
      });
      onCreated(repo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el repositorio.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content rp-modal">
        {!provider ? (
          <>
            <h2 className="rp-title">¿Dónde está tu repositorio?</h2>
            <p className="rp-sub">Elige la plataforma. Después te pediremos la dirección y, si es privado, un token de lectura.</p>
            <div className="rp-providers">
              {PROVIDERS.map((p) => (
                <button key={p} type="button" className="rp-provider" onClick={() => reset(p)}>
                  <ProviderLogo provider={p} size={30} />
                  <span>{PROVIDER_LABEL[p]}</span>
                </button>
              ))}
            </div>
            <div className="rp-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="rp-head">
              <button type="button" className="rp-back" onClick={() => reset(null)} aria-label="Cambiar plataforma">
                <ArrowLeft size={16} />
              </button>
              <ProviderLogo provider={provider} size={24} />
              <h2 className="rp-title">Repositorio de {PROVIDER_LABEL[provider]}</h2>
            </div>

            <label className="rp-field">
              <span>Dirección del repositorio</span>
              <input
                type="text"
                value={url}
                placeholder={URL_PLACEHOLDER[provider]}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setAccess(null);
                }}
                onBlur={() => !name.trim() && setName(nameFromUrl(url))}
                required
                autoFocus
              />
            </label>

            <label className="rp-field">
              <span>Nombre para mostrar</span>
              <input type="text" value={name} placeholder="mi-repo" onChange={(e) => setName(e.target.value)} />
            </label>

            {access?.ok && (
              <p className="rp-ok">
                <ShieldCheck size={14} /> {needsToken ? 'El token funciona: tenemos acceso de lectura.' : 'Repositorio público: tenemos acceso de lectura.'}
              </p>
            )}

            {needsToken && (
              <div className="rp-private">
                <strong>
                  <Lock size={14} /> Repositorio privado
                </strong>
                {access && !access.ok && <p className="rp-warn">{access.message}</p>}
                <TokenSteps provider={provider} />
                <label className="rp-field">
                  <span>Token de lectura</span>
                  <input
                    type="password"
                    value={token}
                    autoComplete="off"
                    onChange={(e) => {
                      setToken(e.target.value);
                      setAccess(null);
                    }}
                    required
                  />
                </label>
              </div>
            )}

            {access && !access.ok && !needsToken && <p className="rp-error">{access.message}</p>}

            <button type="button" className="rp-more" onClick={() => setMore((v) => !v)}>
              {more ? 'Menos opciones' : 'Más opciones'}
            </button>
            {more && (
              <>
                <label className="rp-field">
                  <span>Rama a analizar</span>
                  <input type="text" value={branch} placeholder="La rama principal del repositorio" onChange={(e) => setBranch(e.target.value)} />
                </label>
                <label className="rp-field">
                  <span>URL donde está publicada la aplicación (opcional)</span>
                  <input type="url" value={appUrl} placeholder="https://miapp.com" onChange={(e) => setAppUrl(e.target.value)} />
                  <small>La usamos para revisar su disponibilidad y para el análisis de la aplicación en vivo.</small>
                </label>
              </>
            )}

            {error && <p className="rp-error">{error}</p>}

            <div className="rp-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy || (needsToken && !token.trim())}>
                {busy ? 'Comprobando…' : 'Agregar repositorio'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export const EditRepoModal: React.FC<{
  repo: Repository;
  onClose: () => void;
  onSaved: (repo: Repository) => void;
}> = ({ repo, onClose, onSaved }) => {
  const provider = (repo.provider || 'other') as RepoProvider;
  const [name, setName] = useState(repo.name);
  const [branch, setBranch] = useState(repo.branch);
  const [appUrl, setAppUrl] = useState(repo.dast_url || '');
  const [tokenMode, setTokenMode] = useState<'keep' | 'replace' | 'remove'>('keep');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const changes: Parameters<typeof updateRepository>[1] = {};
      if (name.trim() !== repo.name) changes.name = name.trim();
      if (branch.trim() !== repo.branch) changes.branch = branch.trim();
      if (appUrl.trim() !== (repo.dast_url || '')) changes.dast_url = appUrl.trim();
      if (tokenMode === 'replace') changes.access_token = token.trim();
      if (tokenMode === 'remove') changes.access_token = '';
      onSaved(Object.keys(changes).length ? await updateRepository(repo.id, changes) : repo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <form className="modal-content rp-modal" onSubmit={save}>
        <div className="rp-head">
          <ProviderLogo provider={provider} size={24} />
          <h2 className="rp-title">Editar {repo.name}</h2>
        </div>
        <p className="rp-sub rp-mono">{repo.url}</p>

        <label className="rp-field">
          <span>Nombre para mostrar</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="rp-field">
          <span>Rama a analizar</span>
          <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} required />
        </label>
        <label className="rp-field">
          <span>URL donde está publicada la aplicación (opcional)</span>
          <input type="url" value={appUrl} placeholder="https://miapp.com" onChange={(e) => setAppUrl(e.target.value)} />
        </label>

        <div className="rp-private">
          <strong>
            <Lock size={14} /> Acceso a repositorio privado
          </strong>
          {tokenMode === 'keep' ? (
            <>
              <p className="rp-note">
                {repo.has_access_token
                  ? 'Hay un token de lectura guardado.'
                  : 'Sin token: lo tratamos como repositorio público.'}
              </p>
              <div className="rp-inline">
                <button type="button" className="btn btn-secondary" onClick={() => setTokenMode('replace')}>
                  {repo.has_access_token ? 'Reemplazar token' : 'Agregar token'}
                </button>
                {repo.has_access_token && (
                  <button type="button" className="btn btn-secondary" onClick={() => setTokenMode('remove')}>
                    Quitar token
                  </button>
                )}
              </div>
            </>
          ) : tokenMode === 'remove' ? (
            <p className="rp-warn">
              Al guardar quitaremos el token. Si el repositorio es privado, los próximos análisis fallarán.{' '}
              <button type="button" className="rp-more" onClick={() => setTokenMode('keep')}>
                Deshacer
              </button>
            </p>
          ) : (
            <>
              <TokenSteps provider={provider} />
              <label className="rp-field">
                <span>Token de lectura</span>
                <input type="password" value={token} autoComplete="off" onChange={(e) => setToken(e.target.value)} required />
              </label>
              <button type="button" className="rp-more" onClick={() => setTokenMode('keep')}>
                Cancelar cambio de token
              </button>
            </>
          )}
        </div>

        {error && <p className="rp-error">{error}</p>}

        <div className="rp-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
};
