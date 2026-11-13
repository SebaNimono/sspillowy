import React, { useEffect, useState } from 'react';
import { Sidebar, SidebarState } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { LandingPage } from './pages/LandingPage';
import { LegalPage, LegalDoc } from './pages/LegalPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { UsersPage } from './pages/UsersPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
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
import { ExecutivePage } from './pages/ExecutivePage';
import { ObservabilityPage } from './pages/ObservabilityPage';
import { TraceabilityPage } from './pages/TraceabilityPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
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
import './styles/flat.css';

type AppView = 'site' | 'login' | 'console' | LegalDoc | 'reset-password' | 'accept-invite' | 'not-found';
export type LoginMode = 'login' | 'register' | 'forgot';

const TAB_TITLES: Record<string, string> = {
  dashboard: 'Risk Posture · SSPILLOWY',
  velocity: 'Security Velocity · SSPILLOWY',
  executive: 'Resumen Ejecutivo · SSPILLOWY',
  findings: 'Priorización Contextual (HITL) · SSPILLOWY',
  sbom: 'Supply Chain (SBOM) · SSPILLOWY',
  fixIntel: 'Fix Intelligence · SSPILLOWY',
  repositories: 'Repositorios · SSPILLOWY',
  scans: 'Escaneos · SSPILLOWY',
  gates: 'Security Gates y Excepciones · SSPILLOWY',
  secrets: 'Secret Management · SSPILLOWY',
  runbooks: 'Automatizaciones · SSPILLOWY',
  observability: 'Observabilidad · SSPILLOWY',
  users: 'Espacios y Miembros · SSPILLOWY',
  reports: 'Cumplimiento Normativo · SSPILLOWY',
  traceability: 'Trazabilidad y Auditoría · SSPILLOWY',
  notifications: 'Notificaciones · SSPILLOWY',
  docs: 'Documentación · SSPILLOWY',
  integrations: 'Integraciones CI/CD · SSPILLOWY',
};

const INVITATION_PATHS = new Set([
  '/invitacion',
  '/invitation',
  '/accept-invite',
  '/join',
]);

const RESET_PASSWORD_PATH = '/restablecer-contrasena';

const LEGAL_PATHS: Record<string, LegalDoc> = {
  '/privacidad': 'privacidad',
  '/privacy': 'privacidad',
  '/terminos': 'terminos',
  '/terms': 'terminos',
  '/cookies': 'cookies',
};

const RESET_PASSWORD_PATHS = new Set([
  '/restablecer-contrasena',
  '/reset-password',
]);

const AUTH_ROUTES: Record<string, LoginMode> = {
  '/login': 'login',
  '/iniciar-sesion': 'login',
  '/signin': 'login',
  '/register': 'register',
  '/registro': 'register',
  '/signup': 'register',
  '/crear-cuenta': 'register',
  '/forgot-password': 'forgot',
  '/olvide-clave': 'forgot',
  '/recuperar-contrasena': 'forgot',
  '/recuperar': 'forgot',
};

const HASH_TO_LEGAL: Record<string, LegalDoc> = {
  '#privacidad': 'privacidad',
  '#privacy': 'privacidad',
  '#terminos': 'terminos',
  '#terms': 'terminos',
  '#cookies': 'cookies',
};

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
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
  'executive',
  'runbooks',
  'scans',
  'gates',
  'notifications',
  'reports',
  'users',
  'observability',
  'traceability',
  'docs',
  'integrations',
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

interface RouteInfo {
  view: AppView;
  legalDoc?: LegalDoc;
  resetToken?: string | null;
  loginMode?: LoginMode;
  consoleTab?: string;
  inviteToken?: string | null;
}

function parseCurrentRoute(): RouteInfo {
  const pathname = normalizePath(window.location.pathname);
  const search = window.location.search;
  const hash = window.location.hash.toLowerCase();

  // 1. Legal paths
  if (LEGAL_PATHS[pathname]) {
    return { view: LEGAL_PATHS[pathname], legalDoc: LEGAL_PATHS[pathname] };
  }
  if (HASH_TO_LEGAL[hash]) {
    return { view: HASH_TO_LEGAL[hash], legalDoc: HASH_TO_LEGAL[hash] };
  }

  // 2. Reset password
  if (RESET_PASSWORD_PATHS.has(pathname)) {
    const token = new URLSearchParams(search).get('token');
    return { view: 'reset-password', resetToken: token };
  }

  // 2.1 Workspace Invitation
  if (INVITATION_PATHS.has(pathname)) {
    const token = new URLSearchParams(search).get('token');
    return { view: 'accept-invite', inviteToken: token };
  }

  // 3. Auth routes (/login, /register, /forgot-password, etc.)
  if (AUTH_ROUTES[pathname]) {
    return { view: 'login', loginMode: AUTH_ROUTES[pathname] };
  }

  // 4. Console routes: /console, /console/:tab, /consola, or /:tab in VALID_TABS
  if (pathname === '/console' || pathname === '/consola') {
    return { view: 'console', consoleTab: initialConsoleTab() };
  }
  if (pathname.startsWith('/console/')) {
    const tabCandidate = pathname.slice('/console/'.length);
    if (VALID_TABS.has(tabCandidate)) {
      return { view: 'console', consoleTab: tabCandidate };
    }
    return { view: 'not-found' };
  }
  const directTab = pathname.slice(1);
  if (VALID_TABS.has(directTab)) {
    return { view: 'console', consoleTab: directTab };
  }

  // 5. Default root /: if logged in, console; otherwise landing page (site)
  const params = new URLSearchParams(search);
  const hasAuthCallback =
    params.has('sspillowy_session') ||
    params.has('oauth_error') ||
    params.get('email_verified') === '1';

  if (pathname === '/' || hasAuthCallback) {
    if (getStoredUser() && getStoredSessionId()) {
      return { view: 'console', consoleTab: initialConsoleTab() };
    }
    return { view: 'site' };
  }

  // 6. Cualquier otra ruta desconocida → 404 personalizada
  return { view: 'not-found' };
}

function pathForView(
  view: AppView,
  mode: LoginMode = 'login',
  consoleTab = 'dashboard',
  inviteToken?: string | null
): string {
  if (view === 'privacidad' || view === 'terminos' || view === 'cookies') return `/${view}`;
  if (view === 'reset-password') return RESET_PASSWORD_PATH;
  if (view === 'accept-invite') return inviteToken ? `/invitacion?token=${encodeURIComponent(inviteToken)}` : '/invitacion';
  if (view === 'login') {
    if (mode === 'register') return '/register';
    if (mode === 'forgot') return '/forgot-password';
    return '/login';
  }
  if (view === 'console') {
    return consoleTab === 'dashboard' ? '/console' : `/console/${consoleTab}`;
  }
  if (view === 'not-found') {
    return window.location.pathname || '/404';
  }
  return '/';
}

export const App: React.FC = () => (
  <>
    <AppToaster />
    <AppShell />
  </>
);

const AppShell: React.FC = () => {
  const [view, setView] = useState<AppView>(() => parseCurrentRoute().view);
  const [resetToken, setResetToken] = useState<string | null>(() => parseCurrentRoute().resetToken ?? null);
  const [inviteToken, setInviteToken] = useState<string | null>(() => parseCurrentRoute().inviteToken ?? null);
  const [loginMode, setLoginMode] = useState<LoginMode>(() => parseCurrentRoute().loginMode ?? 'login');
  const [activeTab, setActiveTabState] = useState<string>(() => parseCurrentRoute().consoleTab ?? initialConsoleTab());
  const [unreadCount, setUnreadCount] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthDetail, setOauthDetail] = useState<string | null>(null);

  const [user, setUser] = useState<{ email: string; name: string } | null>(() =>
    getStoredSessionId() ? getStoredUser() : null,
  );
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (view === 'site') {
      document.title = 'SSPILLOWY — Plataforma Open Source de Gobernanza DevSecOps';
    } else if (view === 'login') {
      if (loginMode === 'register') document.title = 'Crear cuenta · SSPILLOWY';
      else if (loginMode === 'forgot') document.title = 'Recuperar contraseña · SSPILLOWY';
      else document.title = 'Iniciar sesión · SSPILLOWY';
    } else if (view === 'privacidad') {
      document.title = 'Política de Privacidad · SSPILLOWY';
    } else if (view === 'terminos') {
      document.title = 'Términos y Condiciones · SSPILLOWY';
    } else if (view === 'cookies') {
      document.title = 'Política de Cookies · SSPILLOWY';
    } else if (view === 'reset-password') {
      document.title = 'Restablecer contraseña · SSPILLOWY';
    } else if (view === 'accept-invite') {
      document.title = 'Invitación a Espacio de Trabajo · SSPILLOWY';
    } else if (view === 'not-found') {
      document.title = '404 Ruta no encontrada · SSPILLOWY';
    } else if (view === 'console') {
      document.title = TAB_TITLES[activeTab] || 'Consola DevSecOps · SSPILLOWY';
    }
  }, [view, loginMode, activeTab]);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem(CONSOLE_TAB_KEY, tab);
    } catch {
      // ignore
    }
    const targetPath = tab === 'dashboard' ? '/console' : `/console/${tab}`;
    if (normalizePath(window.location.pathname) !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const goHome = () => {
    window.history.pushState({}, '', '/');
    setView('site');
    setResetToken(null);
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
    const returnTo = new URLSearchParams(window.location.search).get('return_to');
    if (returnTo && returnTo.startsWith('/')) {
      window.history.replaceState({}, '', returnTo);
      const nextRoute = parseCurrentRoute();
      setView(nextRoute.view);
      if (nextRoute.inviteToken) setInviteToken(nextRoute.inviteToken);
      return;
    }
    setView('console');
    window.history.replaceState({}, '', activeTab === 'dashboard' ? '/console' : `/console/${activeTab}`);
  };

  const expireSession = () => {
    clearStoredSession();
    setUser(null);
    setSessionExpiresAt(null);
    setOauthError('session_ended');
    setOauthDetail(null);
    setLoginMode('login');
    setView('login');
    window.history.replaceState({}, '', '/login');
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
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('401') || msg.includes('404') || msg.toLowerCase().includes('expirada')) {
            expireSession();
          }
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
      const route = parseCurrentRoute();
      setView(route.view);
      if (route.legalDoc) {
        setResetToken(null);
        setInviteToken(null);
      } else if (route.view === 'reset-password') {
        setResetToken(route.resetToken ?? null);
        setInviteToken(null);
      } else if (route.view === 'accept-invite') {
        setInviteToken(route.inviteToken ?? null);
        setResetToken(null);
      } else if (route.view === 'login') {
        setResetToken(null);
        if (route.loginMode) setLoginMode(route.loginMode);
      } else if (route.view === 'console') {
        setResetToken(null);
        setInviteToken(null);
        if (route.consoleTab) setActiveTabState(route.consoleTab);
      } else if (route.view === 'site' || route.view === 'not-found') {
        setResetToken(null);
        setInviteToken(null);
      }
    };
    window.addEventListener('popstate', onPop);

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sspillowy_session');
    const error = params.get('oauth_error');
    const detail = params.get('oauth_detail');

    const clearQuery = () => {
      const currentRoute = parseCurrentRoute();
      window.history.replaceState(
        {},
        '',
        pathForView(currentRoute.view, currentRoute.loginMode ?? 'login', activeTab)
      );
    };

    if (error) {
      setOauthError(error);
      setOauthDetail(detail);
      setLoginMode('login');
      setView('login');
      clearQuery();
      setBootstrapping(false);
      return () => window.removeEventListener('popstate', onPop);
    }

    if (params.get('email_verified') === '1') {
      setLoginMode('login');
      setView('login');
      setBootstrapping(false);
      return () => window.removeEventListener('popstate', onPop);
    }

    const currentRoute = parseCurrentRoute();
    if (currentRoute.view === 'reset-password' && currentRoute.resetToken) {
      setResetToken(currentRoute.resetToken);
      setView('reset-password');
      setBootstrapping(false);
      return () => window.removeEventListener('popstate', onPop);
    }

    if (currentRoute.view === 'accept-invite') {
      setInviteToken(currentRoute.inviteToken ?? null);
      setView('accept-invite');
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
        // Sin conexión con la API no cerramos la sesión; solo si la API la rechaza explícitamente como expirada.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('401') || msg.includes('404') || msg.toLowerCase().includes('expirada')) {
          expireSession();
        }
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
        return '256px';
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

  if (view === 'not-found') {
    return (
      <NotFoundPage
        isAuthenticated={Boolean(user)}
        onGoHome={goHome}
        onGoConsole={() => {
          window.history.pushState({}, '', activeTab === 'dashboard' ? '/console' : `/console/${activeTab}`);
          setView('console');
        }}
        onGoLogin={() => {
          window.history.pushState({}, '', '/login');
          setLoginMode('login');
          setView('login');
        }}
      />
    );
  }

  if (view === 'privacidad' || view === 'terminos' || view === 'cookies') {
    return (
      <LegalPage
        doc={view}
        onHome={goHome}
        onNavigate={(doc) => {
          window.history.pushState({}, '', `/${doc}`);
          setView(doc);
        }}
      />
    );
  }

  if (view === 'reset-password' && resetToken) {
    return (
      <>
        <ResetPasswordPage
          token={resetToken}
          onGoLogin={() => {
            window.history.pushState({}, '', '/login?password_reset=1');
            setResetToken(null);
            setLoginMode('login');
            setView('login');
          }}
          onBack={goHome}
        />
        <CookieBanner />
      </>
    );
  }

  if (view === 'accept-invite') {
    return (
      <>
        <AcceptInvitePage
          token={inviteToken || new URLSearchParams(window.location.search).get('token') || ''}
          currentUser={user}
          onGoHome={goHome}
          onGoLogin={(returnTo) => {
            const url = returnTo ? `/login?return_to=${encodeURIComponent(returnTo)}` : '/login';
            window.history.pushState({}, '', url);
            setLoginMode('login');
            setView('login');
          }}
          onGoRegister={(returnTo) => {
            const url = returnTo ? `/register?return_to=${encodeURIComponent(returnTo)}` : '/register';
            window.history.pushState({}, '', url);
            setLoginMode('register');
            setView('login');
          }}
          onAcceptSuccess={() => {
            window.history.pushState({}, '', '/console');
            setView('console');
            setActiveTab('dashboard');
          }}
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
          onCuenta={(mode = 'login') => {
            setLoginMode(mode);
            setView('login');
            window.history.pushState({}, '', mode === 'register' ? '/register' : '/login');
          }}
          onOpenConsole={() => {
            window.history.pushState({}, '', activeTab === 'dashboard' ? '/console' : `/console/${activeTab}`);
            setView('console');
          }}
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
          onBack={goHome}
          oauthError={oauthError}
          oauthDetail={oauthDetail}
          initialMode={loginMode}
          onModeChange={setLoginMode}
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
      case 'users':
        return <UsersPage {...pageProps} />;
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
      case 'executive':
        return <ExecutivePage {...pageProps} />;
      case 'observability':
        return <ObservabilityPage {...pageProps} />;
      case 'traceability':
        return <TraceabilityPage {...pageProps} />;
      case 'integrations':
        return <IntegrationsPage {...pageProps} />;
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
