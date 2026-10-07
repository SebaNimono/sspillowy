import React, { useEffect, useState } from 'react';
import { Sidebar, SidebarState } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { LandingPage } from './pages/LandingPage';
import { LegalPage, LegalDoc } from './pages/LegalPage';
import { DashboardPage } from './pages/DashboardPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { FindingsPage } from './pages/FindingsPage';
import { SecurityGatesPage } from './pages/SecurityGatesPage';
import { ScansPage } from './pages/ScansPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { DocsPage } from './pages/DocsPage';
import { SecretsPage } from './pages/SecretsPage';
import { SbomPage } from './pages/SbomPage';
import { FixIntelPage } from './pages/FixIntelPage';
import { RiskPosturePage } from './pages/RiskPosturePage';
import { VelocityPage } from './pages/VelocityPage';
import { RunbooksPage } from './pages/RunbooksPage';
import { PillowAgent } from './components/PillowAgent';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { ROADMAP } from './config/roadmap';
import {
  SESSION_EXPIRED_EVENT,
  clearStoredSession,
  fetchAuthSession,
  fetchNotifications,
  getRememberPreference,
  getStoredSessionId,
  getStoredUser,
  logoutSession,
  storeSession,
} from './api/client';
import { CookieBanner } from './components/CookieBanner';
import { AppToaster } from './components/Toast';

type AppView = 'site' | 'login' | 'console' | LegalDoc | 'reset-password';

const RESET_PASSWORD_PATH = '/restablecer-contrasena';

const LEGAL_PATHS: Record<string, LegalDoc> = {
  '/privacidad': 'privacidad',
  '/terminos': 'terminos',
  '/cookies': 'cookies',
};

const HASH_TO_LEGAL: Record<string, LegalDoc> = {
  '#privacidad': 'privacidad',
  '#terminos': 'terminos',
  '#cookies': 'cookies',
};

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function legalFromLocation(): LegalDoc | null {
  const path = normalizePath(window.location.pathname);
  if (LEGAL_PATHS[path]) return LEGAL_PATHS[path];
  const hash = window.location.hash.toLowerCase();
  return HASH_TO_LEGAL[hash] ?? null;
}

function resetTokenFromLocation(): string | null {
  if (normalizePath(window.location.pathname) === RESET_PASSWORD_PATH) {
    return new URLSearchParams(window.location.search).get('token');
  }
  return null;
}

function initialView(): AppView {
  const legal = legalFromLocation();
  if (legal) return legal;
  if (resetTokenFromLocation()) return 'reset-password';
  // Si hay sesión guardada, no mandar al landing al recargar (se valida contra la API al arrancar)
  if (getStoredUser() && getStoredSessionId()) return 'console';
  return 'site';
}

const CONSOLE_TAB_KEY = 'sspillowy_console_tab';
const VALID_TABS = new Set([
  'dashboard',
  'repositories',
  'findings',
  'secrets',
  'sbom',
  'fixIntel',
  'velocity',
  'runbooks',
  'scans',
  'gates',
  'notifications',
  'reports',
  'docs',
  ...Object.keys(ROADMAP),
]);

function initialConsoleTab(): string {
  try {
    const saved = localStorage.getItem(CONSOLE_TAB_KEY);
    if (saved && VALID_TABS.has(saved)) return saved;
  } catch {
    // ignore
  }
  return 'dashboard';
}

function pathForView(view: AppView): string {
  if (view === 'privacidad' || view === 'terminos' || view === 'cookies') return `/${view}`;
  return '/';
}

export const App: React.FC = () => (
  <>
    <AppToaster />
    <AppShell />
  </>
);

const AppShell: React.FC = () => {
  const [view, setView] = useState<AppView>(initialView);
  const [resetToken, setResetToken] = useState<string | null>(() => resetTokenFromLocation());
  const [activeTab, setActiveTabState] = useState<string>(initialConsoleTab);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthDetail, setOauthDetail] = useState<string | null>(null);

  const [user, setUser] = useState<{ email: string; name: string } | null>(() =>
    getStoredSessionId() ? getStoredUser() : null,
  );
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem(CONSOLE_TAB_KEY, tab);
    } catch {
      // ignore
    }
  };

  const goHome = () => {
    window.history.pushState({}, '', '/');
    setView('site');
    window.scrollTo(0, 0);
  };

  const refreshUnread = () => {
    fetchNotifications()
      .then((data) => setUnreadCount((data || []).filter((n) => !n.read).length))
      .catch(() => setUnreadCount(0));
  };

  useEffect(() => {
    if (user && view === 'console') refreshUnread();
  }, [user, activeTab, view]);

  const handleLoginSuccess = (email: string, name: string, sessionId?: string, expiresAt?: string) => {
    const newUser = { email, name };
    if (sessionId) storeSession(sessionId, newUser, getRememberPreference());
    setUser(newUser);
    setSessionExpiresAt(expiresAt ?? null);
    setOauthError(null);
    setOauthDetail(null);
    setView('console');
  };

  const expireSession = () => {
    clearStoredSession();
    setUser(null);
    setSessionExpiresAt(null);
    setOauthError('session_ended');
    setOauthDetail(null);
    setView('login');
  };

  useEffect(() => {
    if (!user) return;
    const onExpired = () => expireSession();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [user]);

  useEffect(() => {
    if (!user || !sessionExpiresAt) return;
    const ms = new Date(sessionExpiresAt).getTime() - Date.now();
    if (Number.isNaN(ms)) return;
    const timer = window.setTimeout(expireSession, Math.min(Math.max(ms, 0), 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [user, sessionExpiresAt]);

  useEffect(() => {
    if (!user) return;
    let lastCheck = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      const sid = getStoredSessionId();
      if (!sid) return expireSession();
      fetchAuthSession(sid)
        .then((s) => setSessionExpiresAt(s.expires_at ?? null))
        .catch((err) => {
          if (!(err instanceof TypeError)) expireSession();
        });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user]);

  useEffect(() => {
    // Legacy #privacidad → /privacidad (Google / enlaces viejos)
    const hashLegal = HASH_TO_LEGAL[window.location.hash.toLowerCase()];
    if (hashLegal) {
      window.history.replaceState({}, '', `/${hashLegal}`);
      setView(hashLegal);
    }

    const onPop = () => {
      const legal = legalFromLocation();
      if (legal) {
        setView(legal);
        setResetToken(null);
        return;
      }
      const token = resetTokenFromLocation();
      if (token) {
        setResetToken(token);
        setView('reset-password');
        return;
      }
      if (normalizePath(window.location.pathname) === '/') {
        setResetToken(null);
        setView((current) => (current === 'login' || current === 'console' ? current : 'site'));
      }
    };
    window.addEventListener('popstate', onPop);

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sspillowy_session');
    const error = params.get('oauth_error');
    const detail = params.get('oauth_detail');

    const clearQuery = () => {
      window.history.replaceState({}, '', pathForView(legalFromLocation() ?? 'site'));
    };

    if (error) {
      setOauthError(error);
      setOauthDetail(detail);
      setView('login');
      clearQuery();
      setBootstrapping(false);
      return () => window.removeEventListener('popstate', onPop);
    }

    if (params.get('email_verified') === '1') {
      setView('login');
      setBootstrapping(false);
      return () => window.removeEventListener('popstate', onPop);
    }

    const resetTokenParam = resetTokenFromLocation();
    if (resetTokenParam) {
      setResetToken(resetTokenParam);
      setView('reset-password');
      setBootstrapping(false);
      return () => window.removeEventListener('popstate', onPop);
    }

    if (sessionId) {
      fetchAuthSession(sessionId)
        .then((session) => {
          handleLoginSuccess(session.email, session.name, session.id || sessionId, session.expires_at);
        })
        .catch(() => {
          setOauthError('session_expired');
          setView('login');
        })
        .finally(() => {
          clearQuery();
          setBootstrapping(false);
        });
      return () => window.removeEventListener('popstate', onPop);
    }

    const storedSid = getStoredSessionId();
    if (!storedSid) {
      clearStoredSession();
      setUser(null);
      setView((current) => (current === 'console' ? 'site' : current));
      setBootstrapping(false);
      return () => window.removeEventListener('popstate', onPop);
    }

    fetchAuthSession(storedSid)
      .then((session) => setSessionExpiresAt(session.expires_at ?? null))
      .catch((err) => {
        // Sin conexión con la API no cerramos la sesión; solo si la API la rechaza.
        if (!(err instanceof TypeError)) expireSession();
      })
      .finally(() => setBootstrapping(false));
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleLogout = () => {
    logoutSession().finally(clearStoredSession);
    setUser(null);
    setSessionExpiresAt(null);
    setView('site');
    setActiveTabState('dashboard');
    window.history.pushState({}, '', '/');
    try {
      localStorage.removeItem(CONSOLE_TAB_KEY);
    } catch {
      // ignore
    }
  };

  const [sidebarState, setSidebarStateInternal] = useState<SidebarState>(() => {
    try {
      const saved = localStorage.getItem('sspillowy_sidebar_state');
      if (saved === 'expanded' || saved === 'collapsed' || saved === 'hidden') {
        return saved as SidebarState;
      }
    } catch {
      // ignore
    }
    return 'expanded';
  });

  const setSidebarState = (newState: SidebarState) => {
    setSidebarStateInternal(newState);
    try {
      localStorage.setItem('sspillowy_sidebar_state', newState);
    } catch {
      // ignore
    }
  };

  const getMarginLeft = () => {
    switch (sidebarState) {
      case 'expanded':
        return '268px';
      case 'collapsed':
        return '56px';
      case 'hidden':
        return '0px';
    }
  };

  if (bootstrapping) {
    return (
      <div style={{ minHeight: '100vh', background: '#f6f8fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#656d76', fontSize: '0.85rem', fontWeight: 600 }}>
        Conectando sesión…
      </div>
    );
  }

  if (view === 'privacidad' || view === 'terminos' || view === 'cookies') {
    return <LegalPage doc={view} onHome={goHome} />;
  }

  if (view === 'reset-password' && resetToken) {
    return (
      <>
        <ResetPasswordPage
          token={resetToken}
          onGoLogin={() => {
            window.history.pushState({}, '', '/?password_reset=1');
            setResetToken(null);
            setView('login');
          }}
          onBack={goHome}
        />
        <CookieBanner />
      </>
    );
  }

  if (view === 'site') {
    return (
      <>
        <LandingPage
          user={user}
          onCuenta={() => setView('login')}
          onOpenConsole={() => setView('console')}
          onLogout={handleLogout}
        />
        <CookieBanner />
      </>
    );
  }

  if (view === 'login' || !user) {
    return (
      <>
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onBack={() => { setOauthError(null); setOauthDetail(null); setView('site'); }}
          oauthError={oauthError}
          oauthDetail={oauthDetail}
        />
        <CookieBanner />
      </>
    );
  }

  const pageProps = {
    sidebarState,
    setSidebarState,
    user,
    onLogout: handleLogout,
    onNavigate: setActiveTab,
    unreadCount,
    onGoToSite: () => {
      window.history.pushState({}, '', '/');
      setView('site');
    },
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <RiskPosturePage {...pageProps} />;
      case 'repositories':
        return <RepositoriesPage {...pageProps} />;
      case 'findings':
        return <FindingsPage {...pageProps} />;
      case 'scans':
        return <ScansPage {...pageProps} />;
      case 'gates':
        return <SecurityGatesPage {...pageProps} />;
      case 'notifications':
        return <NotificationsPage {...pageProps} onNotificationsChange={refreshUnread} />;
      case 'reports':
        return <ReportsPage {...pageProps} />;
      case 'docs':
        return <DocsPage {...pageProps} />;
      case 'secrets':
        return <SecretsPage {...pageProps} />;
      case 'sbom':
        return <SbomPage {...pageProps} />;
      case 'fixIntel':
        return <FixIntelPage {...pageProps} />;
      case 'velocity':
        return <VelocityPage {...pageProps} />;
      case 'runbooks':
        return <RunbooksPage {...pageProps} />;
      default:
        if (ROADMAP[activeTab]) return <ComingSoonPage key={activeTab} module={ROADMAP[activeTab]} {...pageProps} />;
        return <DashboardPage {...pageProps} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
      />
      <main
        className="main-content"
        style={{
          marginLeft: getMarginLeft(),
          transition: 'margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {renderContent()}
      </main>
      <PillowAgent key={user?.email ?? 'anon'} userEmail={user?.email} page={activeTab} />
      <CookieBanner />
    </div>
  );
};

export default App;
