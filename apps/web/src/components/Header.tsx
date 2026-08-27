import React, { useEffect, useState } from 'react';
import { Activity, Bell, Smartphone, Menu, ChevronRight, LogOut, Globe } from 'lucide-react';
import { SidebarState } from './Sidebar';
import { fetchNotifications, NotificationItem } from '../api/client';
import { FALLBACK_NOTIFICATIONS } from '../api/fallbacks';

interface HeaderProps {
  title: string;
  subtitle: string;
  healthScore?: number;
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  healthScore = 82,
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
}) => {
  const [hoveringMenuBtn, setHoveringMenuBtn] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [preview, setPreview] = useState<NotificationItem[]>([]);

  useEffect(() => {
    fetchNotifications()
      .then((data) => setPreview((data || []).slice(0, 4)))
      .catch(() => setPreview(FALLBACK_NOTIFICATIONS.slice(0, 4)));
  }, [unreadCount]);

  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Top-Left 3-Lines Menu Icon Button when sidebar is hidden */}
        {sidebarState === 'hidden' && (
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoveringMenuBtn(true)}
            onMouseLeave={() => setHoveringMenuBtn(false)}
          >
            <button
              onClick={() => setSidebarState('expanded')}
              style={{
                padding: '0.45rem 0.6rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #d0d7de',
                background: '#ffffff',
                cursor: 'pointer',
              }}
              title="Abrir menú de navegación"
            >
              <Menu size={18} color="#1f2328" />
            </button>

            {/* Datadog Peek Popup "Keep menu open" on hover */}
            {hoveringMenuBtn && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  left: 0,
                  zIndex: 1000,
                  background: '#1b1e2e',
                  color: '#ffffff',
                  border: '1px solid #2d334a',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
                onClick={() => setSidebarState('expanded')}
              >
                <ChevronRight size={14} color="#58a6ff" />
                <span>Keep menu open</span>
              </div>
            )}
          </div>
        )}

        <div className="page-title">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Security Health Score Pill Light */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: '#ddf4ff',
            border: '1px solid #54aeff',
            padding: '0.35rem 0.85rem',
            borderRadius: '20px',
            fontSize: '0.8rem',
          }}
        >
          <Activity size={14} color="#0969da" />
          <span style={{ color: '#0969da', fontWeight: 600 }}>Health Score:</span>
          <strong style={{ color: '#0969da', fontSize: '0.95rem' }}>{healthScore}/100</strong>
        </div>

        {/* Pulse Mobile App Sync Pill Light */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: '#dafbe1',
            border: '1px solid #4ac26b',
            padding: '0.35rem 0.85rem',
            borderRadius: '20px',
            fontSize: '0.8rem',
            color: '#1a7f37',
            fontWeight: 600,
          }}
        >
          <span className="status-dot"></span>
          <Smartphone size={13} color="#1a7f37" />
          <span>Pulse App Sync: Activa</span>
        </div>

        {/* Notifications Button */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.45rem', borderRadius: '6px', position: 'relative' }}
            onClick={() => setShowNotifMenu(!showNotifMenu)}
          >
            <Bell size={16} color="#656d76" />
            {(unreadCount || 0) > 0 && (
              <span className="notif-badge">{unreadCount}</span>
            )}
          </button>

          {showNotifMenu && (
            <div className="header-dropdown" style={{ width: '340px' }}>
              <div style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid #d0d7de', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Notificaciones</span>
                <button
                  type="button"
                  onClick={() => { setShowNotifMenu(false); onNavigate?.('notifications'); }}
                  style={{ background: 'none', border: 'none', color: '#0969da', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Ver todas
                </button>
              </div>
              {preview.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setShowNotifMenu(false); onNavigate?.(item.finding_id ? 'findings' : 'notifications'); }}
                  className="notif-preview"
                >
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1f2328' }}>{item.title}</div>
                  <div style={{ fontSize: '0.72rem', color: '#656d76', marginTop: '0.15rem' }}>{item.message}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile Pill & Dropdown Menu */}
        {user && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="btn btn-secondary"
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: '#0969da',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ color: '#1f2328' }}>{user.name}</span>
            </button>

            {showProfileMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  zIndex: 1000,
                  background: '#ffffff',
                  border: '1px solid #d0d7de',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  width: '200px',
                  boxShadow: '0 8px 24px rgba(140, 149, 159, 0.2)',
                }}
              >
                <div style={{ padding: '0.5rem', borderBottom: '1px solid #d0d7de', marginBottom: '0.4rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1f2328' }}>{user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#656d76', wordBreak: 'break-all' }}>{user.email}</div>
                </div>

                {onGoToSite && (
                  <button
                    onClick={() => { setShowProfileMenu(false); onGoToSite(); }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 0.65rem',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#1f2328',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Globe size={14} />
                    <span>Sitio público</span>
                  </button>
                )}

                <button
                  onClick={() => { setShowProfileMenu(false); if (onLogout) onLogout(); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.65rem',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#cf222e',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={14} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
