import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { NotificationItem, fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/client';
import { ApiOfflineBanner } from '../components/ApiOfflineBanner';
import { Bell, CheckCheck, KeyRound, ShieldAlert, Sliders, Sparkles, Smartphone, Radar } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
  onNotificationsChange?: () => void;
}

const typeIcon = (type: NotificationItem['type']) => {
  switch (type) {
    case 'SECRET_LEAK':
      return <KeyRound size={16} color="#cf222e" />;
    case 'GATE_BLOCK':
      return <Sliders size={16} color="#cf222e" />;
    case 'AI_TRIAGE':
      return <Sparkles size={16} color="#8250df" />;
    case 'PULSE_BYPASS':
      return <Smartphone size={16} color="#8250df" />;
    case 'SCAN_COMPLETED':
      return <Radar size={16} color="#0969da" />;
    default:
      return <ShieldAlert size={16} color="#9a6700" />;
  }
};

export const NotificationsPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
  onNotificationsChange,
}) => {
  const { t } = useI18n();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const [apiOffline, setApiOffline] = useState(false);

  const load = () => {
    fetchNotifications()
      .then((data) => {
        setApiOffline(false);
        setItems(data || []);
      })
      .catch(() => {
        setApiOffline(true);
        setItems([]);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const visible = items.filter((item) => {
    if (filter === 'unread') return !item.read;
    if (filter === 'critical') return item.severity === 'CRITICAL';
    return true;
  });

  const handleRead = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await markNotificationRead(item.id);
      } catch {
        // local
      }
      setItems(items.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      onNotificationsChange?.();
    }
    if (item.finding_id && onNavigate) onNavigate('findings');
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
    } catch {
      // local
    }
    setItems(items.map((n) => ({ ...n, read: true })));
    onNotificationsChange?.();
  };

  return (
    <div>
      <Header
        title={t('pages.notifications.title')}
        subtitle={t('pages.notifications.subtitle')}
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      {apiOffline && <ApiOfflineBanner />}

      <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(['all', 'unread', 'critical'] as const).map((key) => (
            <button
              key={key}
              className={filter === key ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => setFilter(key)}
            >
              {key === 'all' ? 'Todas' : key === 'unread' ? 'No leídas' : 'Críticas'}
            </button>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-secondary" onClick={handleReadAll}>
              <CheckCheck size={14} />
              <span>Marcar todas como leídas</span>
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Bell size={20} color="#0969da" />
            <span>Eventos ({visible.length})</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleRead(item)}
              className={`notif-row ${item.read ? '' : 'unread'}`}
            >
              <div className="notif-icon">{typeIcon(item.type)}</div>
              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {!item.read && <span className="unread-dot" />}
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2328' }}>{item.title}</span>
                  <span className={`badge ${item.severity === 'CRITICAL' ? 'badge-critical' : item.severity === 'HIGH' ? 'badge-high' : 'badge-low'}`}>
                    {item.severity}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#656d76', marginTop: '0.2rem' }}>{item.message}</div>
                <div style={{ fontSize: '0.7rem', color: '#8c959f', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                  {item.type} · {new Date(item.created_at).toLocaleString('es-CL')}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
