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
      'Documento público exigido para el uso de proveedores de identidad (p. ej. Google OAuth) y para informar a las personas usuarias del Web Hub.',
  },
  terminos: {
    title: 'Términos y Condiciones',
    lead:
      'Condiciones de uso de SSPILLOWY. Al utilizar la plataforma acepta estas normas junto con la Política de Privacidad.',
  },
  cookies: {
    title: 'Cookies',
    lead: 'Cómo usamos el almacenamiento local del navegador en el Web Hub.',
  },
};

interface LegalPageProps {
  doc: LegalDoc;
  onHome: () => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ doc, onHome }) => {
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
            <img src="/sspillowy_favicon.png" alt="" width={22} height={22} />
            <span>SSPILLOWY</span>
          </a>
          <nav className="site-nav-links site-legal-nav">
            <a href="/privacidad" className={doc === 'privacidad' ? 'is-active' : ''}>
              Privacidad
            </a>
            <a href="/terminos" className={doc === 'terminos' ? 'is-active' : ''}>
              Términos
            </a>
            <a href="/cookies" className={doc === 'cookies' ? 'is-active' : ''}>
              Cookies
            </a>
          </nav>
        </div>
      </header>

      <main className="site-shell site-legal-main">
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
            <p>Software Security Platform for Intelligent, Low-latency Oversight &amp; Warning Yield.</p>
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
