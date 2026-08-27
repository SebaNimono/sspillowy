import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'sspillowy_cookie_consent';

export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  at: string;
};

export function readCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
}

function persist(analytics: boolean) {
  const value: CookieConsent = {
    necessary: true,
    analytics,
    at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

interface CookieBannerProps {
  onPrivacy?: () => void;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ onPrivacy }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!readCookieConsent());
    const reopen = () => setVisible(true);
    window.addEventListener('sspillowy-cookie-open', reopen);
    return () => window.removeEventListener('sspillowy-cookie-open', reopen);
  }, []);

  if (!visible) return null;

  const decide = (analytics: boolean) => {
    persist(analytics);
    setVisible(false);
  };

  return (
    <aside className="cookie-banner" role="dialog" aria-labelledby="cookie-title" aria-describedby="cookie-copy">
      <div className="cookie-banner-inner">
        <div>
          <strong id="cookie-title">Cookies</strong>
          <p id="cookie-copy">
            Usamos las estrictamente necesarias para la sesión SSO y recordar esta elección.
            No hay publicidad ni analítica de terceros. Puedes aceptar esa preferencia o dejar solo las necesarias.
            {' '}
            <button
              type="button"
              className="cookie-inline"
              onClick={() => {
                onPrivacy?.();
                document.getElementById('privacidad')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Privacidad
            </button>
          </p>
        </div>
        <div className="cookie-banner-actions">
          <button type="button" className="btn btn-secondary" onClick={() => decide(false)}>
            Solo necesarias
          </button>
          <button type="button" className="btn btn-primary" onClick={() => decide(true)}>
            Aceptar
          </button>
        </div>
      </div>
    </aside>
  );
};
