import React, { useState } from 'react';
import { LayoutDashboard, FolderGit2, ShieldAlert, Sliders, Minus, Plus, X, Radar, Bell, FileArchive, BookOpen } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

export type SidebarState = 'expanded' | 'collapsed' | 'hidden';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  sidebarState,
  setSidebarState,
}) => {
  const { t } = useI18n();
  const [activeHoverItem, setActiveHoverItem] = useState<string | null>(null);

  if (sidebarState === 'hidden') return null;

  const isCollapsed = sidebarState === 'collapsed';

  const navGroups = [
    {
      id: 'overview',
      label: null,
      items: [{ id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard }],
    },
    {
      id: 'security',
      label: t('nav.groupSecurity'),
      items: [
        { id: 'repositories', label: t('nav.repositories'), icon: FolderGit2 },
        { id: 'findings', label: t('nav.findings'), icon: ShieldAlert },
        { id: 'scans', label: t('nav.scans'), icon: Radar },
      ],
    },
    {
      id: 'governance',
      label: t('nav.groupGovernance'),
      items: [
        { id: 'gates', label: t('nav.gates'), icon: Sliders },
        { id: 'reports', label: t('nav.reports'), icon: FileArchive },
        { id: 'notifications', label: t('nav.notifications'), icon: Bell },
      ],
    },
    {
      id: 'resources',
      label: t('nav.groupResources'),
      items: [{ id: 'docs', label: t('nav.docs'), icon: BookOpen }],
    },
  ];

  return (
    <aside
      className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
      style={{
        width: isCollapsed ? '56px' : '250px',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: isCollapsed ? '0.75rem 0' : '1.25rem 0.85rem',
      }}
    >
      {!isCollapsed ? (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.85rem',
              padding: '0 0.25rem',
            }}
          >
            <button
              onClick={() => setSidebarState('hidden')}
              title={t('nav.hideMenu')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9499b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>

            <button
              onClick={() => setSidebarState('collapsed')}
              title={t('nav.collapseMenu')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9499b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Minus size={18} />
            </button>
          </div>

          <div className="brand" style={{ paddingBottom: '1.25rem' }}>
            <div className="brand-icon" style={{ background: '#ffffff', padding: '2px' }}>
              <img src="/sspillowy_favicon.png" alt="Emblema" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
            </div>
            <div>
              <div className="brand-title">SSPILLOWY</div>
              <div className="brand-sub">{t('nav.brandSub')}</div>
            </div>
          </div>
        </>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid #2d334a',
          }}
        >
          <div className="brand-icon" style={{ width: '32px', height: '32px', background: '#ffffff', padding: '3px' }}>
            <img src="/sspillowy_favicon.png" alt="Emblema" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
          </div>

          <button
            onClick={() => setSidebarState('hidden')}
            title={t('nav.hideMenu')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9499b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>

          <button
            onClick={() => setSidebarState('expanded')}
            title={t('nav.expandMenu')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9499b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={18} />
          </button>
        </div>
      )}

      {navGroups.map((group, gi) => (
      <ul
        key={group.id}
        className="nav-list"
        style={{
          marginTop: gi === 0 ? (isCollapsed ? '0.25rem' : '1.25rem') : '0.5rem',
          paddingTop: gi === 0 ? 0 : '0.5rem',
          borderTop: gi === 0 ? 'none' : '1px solid #2d334a',
        }}
      >
        {group.label && !isCollapsed && (
          <li
            aria-hidden
            style={{
              fontSize: '0.66rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#6e7391',
              padding: '0.15rem 0.85rem 0.3rem',
            }}
          >
            {group.label}
          </li>
        )}
        {group.items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isHovered = activeHoverItem === item.id;

          return (
            <li
              key={item.id}
              className="nav-item"
              style={{ position: 'relative' }}
              onMouseEnter={() => isCollapsed && setActiveHoverItem(item.id)}
              onMouseLeave={() => isCollapsed && setActiveHoverItem(null)}
            >
              <button
                className={isActive ? 'active' : ''}
                onClick={() => setActiveTab(item.id)}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '0.75rem 0' : '0.65rem 0.85rem',
                }}
              >
                <Icon size={18} />
                {!isCollapsed && <span>{item.label}</span>}
              </button>

              {isCollapsed && isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    left: '60px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    background: '#1b1e2e',
                    color: '#ffffff',
                    border: '1px solid #2d334a',
                    borderRadius: '6px',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    pointerEvents: 'none',
                  }}
                >
                  {item.label}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      ))}
    </aside>
  );
};
