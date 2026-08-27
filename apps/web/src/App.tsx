import React, { useEffect, useState } from 'react';
import { Sidebar, SidebarState } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { FindingsPage } from './pages/FindingsPage';
import { SecurityGatesPage } from './pages/SecurityGatesPage';
import { ScansPage } from './pages/ScansPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { fetchNotifications, fetchAuthSession } from './api/client';
import { FALLBACK_NOTIFICATIONS } from './api/fallbacks';
import { CookieBanner } from './components/CookieBanner';

type AppView = 'site' | 'login' | 'console';

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>('site');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const [user, setUser] = useState<{ email: string; name: string } | null>(() => {
    try {
      const saved = localStorage.getItem('sspillowy_user');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });

  const refreshUnread = () => {
    fetchNotifications()
      .then((data) => setUnreadCount((data || []).filter((n) => !n.read).length))
      .catch(() => setUnreadCount(FALLBACK_NOTIFICATIONS.filter((n) => !n.read).length));
  };

  useEffect(() => {
    if (user && view === 'console') refreshUnread();
  }, [user, activeTab, view]);

  const handleLoginSuccess = (email: string, name: string) => {
    const newUser = { email, name };
    setUser(newUser);
    setView('console');
    try {
      localStorage.setItem('sspillowy_user', JSON.stringify(newUser));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sspillowy_session');
    const error = params.get('oauth_error');

    const clearQuery = () => {
      window.history.replaceState({}, '', window.location.pathname);
    };

    if (error) {
      setOauthError(error);
      setView('login');
      clearQuery();
      setBootstrapping(false);
      return;
    }

    if (sessionId) {
      fetchAuthSession(sessionId)
        .then((session) => {
          handleLoginSuccess(session.email, session.name);
        })
        .catch(() => {
          setOauthError('session_expired');
          setView('login');
        })
        .finally(() => {
          clearQuery();
          setBootstrapping(false);
        });
      return;
    }

    setBootstrapping(false);
  }, []);

  const handleLogout = () => {
    setUser(null);
    setView('site');
    try {
      localStorage.removeItem('sspillowy_user');
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
        return '250px';
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

  if (view === 'site') {
    return (
      <>
        <LandingPage
          user={user}
          onCuenta={() => setView('login')}
          onOpenConsole={() => setView('console')}
          onLogout={handleLogout}
        />
        <CookieBanner onPrivacy={() => setView('site')} />
      </>
    );
  }

  if (view === 'login' || !user) {
    return (
      <>
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onBack={() => { setOauthError(null); setView('site'); }}
          oauthError={oauthError}
        />
        <CookieBanner
          onPrivacy={() => {
            setOauthError(null);
            setView('site');
            window.setTimeout(() => {
              document.getElementById('privacidad')?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }}
        />
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
    onGoToSite: () => setView('site'),
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage {...pageProps} />;
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
      default:
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
      <CookieBanner
        onPrivacy={() => {
          setView('site');
          window.setTimeout(() => {
            document.getElementById('privacidad')?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }}
      />
    </div>
  );
};

export default App;
