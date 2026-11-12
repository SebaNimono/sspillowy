import React from 'react';
import { ArrowLeft, Compass, Home, LayoutDashboard, ShieldAlert } from 'lucide-react';
import { CookieBanner } from '../components/CookieBanner';

interface NotFoundPageProps {
  isAuthenticated?: boolean;
  requestedPath?: string;
  onGoHome: () => void;
  onGoConsole: () => void;
  onGoLogin: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  isAuthenticated = false,
  requestedPath,
  onGoHome,
  onGoConsole,
  onGoLogin,
}) => {
  const path = requestedPath || (typeof window !== 'undefined' ? window.location.pathname : '/404');

  return (
    <div className="site site-legal-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="site-nav">
        <div className="site-nav-inner">
          <a
            href="/"
            className="site-brand"
            onClick={(e) => {
              e.preventDefault();
              onGoHome();
            }}
          >
            <img src="/sspillowy_favicon.png" alt="Logo de SSPILLOWY" width={22} height={22} />
            <span>SSPILLOWY</span>
          </a>
          <nav className="site-nav-links" aria-label="Navegación rápida">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onGoHome();
              }}
            >
              Inicio
            </a>
            <a
              href={isAuthenticated ? '/console' : '/login'}
              onClick={(e) => {
                e.preventDefault();
                if (isAuthenticated) onGoConsole();
                else onGoLogin();
              }}
            >
              {isAuthenticated ? 'Consola' : 'Iniciar sesión'}
            </a>
            <a href="/privacidad">Privacidad</a>
            <a href="/terminos">Términos</a>
          </nav>
        </div>
      </header>

      <main
        className="site-shell site-legal-main"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          maxWidth: '720px',
          paddingTop: '3.5rem',
          paddingBottom: '4rem',
        }}
      >
        <nav aria-label="Migas de pan" style={{ fontSize: '0.78rem', color: '#656d76', marginBottom: '1.25rem' }}>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onGoHome();
            }}
            style={{ color: '#0969da', textDecoration: 'none', fontWeight: 600 }}
          >
            Inicio
          </a>
          <span style={{ margin: '0 0.45rem' }}>/</span>
          <span>Error 404</span>
        </nav>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.3rem 0.7rem',
            border: '1px solid #d0d7de',
            background: '#f6f8fa',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#cf222e',
            width: 'fit-content',
            marginBottom: '1rem',
          }}
        >
          <ShieldAlert size={14} />
          <span>Error 404 · Ruta no encontrada</span>
        </div>

        <h1 className="site-h2" style={{ marginBottom: '0.65rem' }}>
          Esta ruta no existe en SSPILLOWY
        </h1>
        <p className="site-lead" style={{ marginBottom: '1.25rem' }}>
          No encontramos ninguna página ni módulo asociado a{' '}
          <code
            style={{
              padding: '0.15rem 0.45rem',
              background: '#eaeef2',
              border: '1px solid #d0d7de',
              fontSize: '0.88em',
              color: '#1f2328',
            }}
          >
            {path}
          </code>
          . Es posible que el enlace haya cambiado o que la dirección esté mal escrita.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '2.25rem' }}>
          <button type="button" className="btn btn-primary" onClick={onGoHome} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Home size={15} />
            <span>Volver al inicio</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={isAuthenticated ? onGoConsole : onGoLogin}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <LayoutDashboard size={15} />
            <span>{isAuthenticated ? 'Ir a la Consola Web' : 'Iniciar sesión en el Hub'}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.history.back()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <ArrowLeft size={15} />
            <span>Página anterior</span>
          </button>
        </div>

        <div
          style={{
            padding: '1.1rem 1.25rem',
            border: '1px solid #d0d7de',
            background: '#f6f8fa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.55rem', color: '#1f2328' }}>
            <Compass size={15} />
            <span>Enlaces directos recomendados</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.82rem' }}>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onGoHome();
              }}
              style={{ color: '#0969da', fontWeight: 600 }}
            >
              Landing y Arquitectura
            </a>
            <a
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                onGoLogin();
              }}
              style={{ color: '#0969da', fontWeight: 600 }}
            >
              Acceso al Web Hub
            </a>
            <a href="/privacidad" style={{ color: '#0969da', fontWeight: 600 }}>
              Política de Privacidad
            </a>
            <a href="/terminos" style={{ color: '#0969da', fontWeight: 600 }}>
              Términos y Condiciones
            </a>
            <a href="/cookies" style={{ color: '#0969da', fontWeight: 600 }}>
              Política de Cookies
            </a>
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <div className="site-shell site-footer-grid">
          <div>
            <strong>SSPILLOWY</strong>
          </div>
          <div>
            <span>Legal</span>
            <a href="/privacidad">Privacidad</a>
            <a href="/terminos">Términos</a>
            <a href="/cookies">Cookies</a>
          </div>
        </div>
      </footer>

      <CookieBanner />
    </div>
  );
};
