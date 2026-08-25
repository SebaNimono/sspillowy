import React, { useState } from 'react';
import { Sidebar, SidebarState } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { FindingsPage } from './pages/FindingsPage';
import { SecurityGatesPage } from './pages/SecurityGatesPage';
import './styles/index.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Authenticated user session state
  const [user, setUser] = useState<{ email: string; name: string } | null>(() => {
    try {
      const saved = localStorage.getItem('sspillowy_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return null;
  });

  const handleLoginSuccess = (email: string, name: string) => {
    const newUser = { email, name };
    setUser(newUser);
    try {
      localStorage.setItem('sspillowy_user', JSON.stringify(newUser));
    } catch (e) {
      // ignore
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem('sspillowy_user');
    } catch (e) {
      // ignore
    }
  };

  // Initialize sidebarState from localStorage
  const [sidebarState, setSidebarStateInternal] = useState<SidebarState>(() => {
    try {
      const saved = localStorage.getItem('sspillowy_sidebar_state');
      if (saved === 'expanded' || saved === 'collapsed' || saved === 'hidden') {
        return saved as SidebarState;
      }
    } catch (e) {
      // ignore
    }
    return 'expanded';
  });

  const setSidebarState = (newState: SidebarState) => {
    setSidebarStateInternal(newState);
    try {
      localStorage.setItem('sspillowy_sidebar_state', newState);
    } catch (e) {
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

  // If user is not logged in, display the minimalist GitHub-style login page
  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage sidebarState={sidebarState} setSidebarState={setSidebarState} user={user} onLogout={handleLogout} />;
      case 'repositories':
        return <RepositoriesPage sidebarState={sidebarState} setSidebarState={setSidebarState} user={user} onLogout={handleLogout} />;
      case 'findings':
        return <FindingsPage sidebarState={sidebarState} setSidebarState={setSidebarState} user={user} onLogout={handleLogout} />;
      case 'gates':
        return <SecurityGatesPage sidebarState={sidebarState} setSidebarState={setSidebarState} user={user} onLogout={handleLogout} />;
      default:
        return <DashboardPage sidebarState={sidebarState} setSidebarState={setSidebarState} user={user} onLogout={handleLogout} />;
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
    </div>
  );
};

export default App;
