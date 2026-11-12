import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { LegalPrivacy, LegalTerms, LegalCookies } from '../components/LegalDocuments';
import { CookieBanner } from '../components/CookieBanner';

export type LegalDoc = 'privacidad' | 'terminos' | 'cookies';

const META: Record<
  LegalDoc,
  { title: string; lead: string }
> = {
  privacidad: {
    title: 'Política de Privacidad',
    lead:
      'Qué datos trata SSPILLOWY, para qué, cómo se protegen y qué derechos tiene usted. Aplica al Hub, a la API y a los espacios de trabajo.',
  },
  terminos: {
    title: 'Términos y Condiciones',
    lead:
      'Reglas de uso de la plataforma: cuentas, espacios, repositorios, Security Gate y asistencia de Pillow. Complementa la Política de Privacidad.',
  },
  cookies: {
    title: 'Cookies',
    lead: 'Qué guardamos en su navegador para la sesión y la interfaz, y cómo puede cambiarlo.',
  },
};

interface LegalPageProps {
  doc: LegalDoc;
  onHome: () => void;
  onNavigate?: (doc: LegalDoc) => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ doc, onHome, onNavigate }) => {
  const meta = META[doc];

  return (
    <div className="site site-legal-page">
      <header className="site-nav">
        <div className="site-nav-inner">
          <a
            href="/"
            className="site-brand"
            onClick={(e) => {
              e.preventDefault();
              onHome();
            }}
          >
            <img src="/sspillowy_favicon.png" alt="Logo de SSPILLOWY" width={22} height={22} />
            <span>SSPILLOWY</span>
          </a>
          <nav className="site-nav-links site-legal-nav">
            <a
              href="/privacidad"
              className={doc === 'privacidad' ? 'is-active' : ''}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate('privacidad');
                }
              }}
            >
              Privacidad
            </a>
            <a
              href="/terminos"
              className={doc === 'terminos' ? 'is-active' : ''}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate('terminos');
                }
              }}
            >
              Términos
            </a>
            <a
              href="/cookies"
              className={doc === 'cookies' ? 'is-active' : ''}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate('cookies');
                }
              }}
            >
              Cookies
            </a>
          </nav>
        </div>
      </header>

      <main className="site-shell site-legal-main">
        <nav aria-label="Migas de pan" style={{ fontSize: '0.78rem', color: '#656d76', marginBottom: '0.75rem' }}>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onHome();
            }}
            style={{ color: '#0969da', textDecoration: 'none', fontWeight: 600 }}
          >
            Inicio
          </a>
          <span style={{ margin: '0 0.45rem' }}>/</span>
          <span>Legal</span>
          <span style={{ margin: '0 0.45rem' }}>/</span>
          <span>{meta.title}</span>
        </nav>

        <a
          href="/"
          className="site-legal-back"
          onClick={(e) => {
            e.preventDefault();
            onHome();
          }}
        >
          <ArrowLeft size={16} />
          Volver al inicio
        </a>
        <div className="site-kicker">Legal</div>
        <h1 className="site-h2">{meta.title}</h1>
        <p className="site-lead">{meta.lead}</p>

        {doc === 'privacidad' && <LegalPrivacy />}
        {doc === 'terminos' && <LegalTerms />}
        {doc === 'cookies' && (
          <>
            <LegalCookies />
            <button
              type="button"
              className="site-footer-link"
              style={{ marginTop: '1rem' }}
              onClick={() => window.dispatchEvent(new Event('sspillowy-cookie-open'))}
            >
              Cambiar preferencia de cookies
            </button>
          </>
        )}
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
