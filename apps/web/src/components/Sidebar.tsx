import React, { useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  ClipboardCheck,
  FileText,
  FolderGit2,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  LucideIcon,
  Minus,
  Plus,
  Puzzle,
  Radar,
  Sliders,
  Sparkles,
  Target,
  Workflow,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

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
  const [hover, setHover] = useState<{ id: string; top: number } | null>(null);

  if (sidebarState === 'hidden') return null;

  const isCollapsed = sidebarState === 'collapsed';

  const navItem = (id: string, icon: LucideIcon, soon = false) => ({ id, label: t(`nav.${id}`), icon, soon });

  const navGroups = [
    {
      id: 'overview',
      label: t('nav.groupOverview'),
      items: [navItem('dashboard', LayoutDashboard), navItem('velocity', Gauge), navItem('executive', FileText)],
    },
    {
      id: 'risk',
      label: t('nav.groupRisk'),
      items: [navItem('findings', Target), navItem('sbom', Boxes), navItem('fixIntel', Sparkles)],
    },
    {
      id: 'orchestration',
      label: t('nav.groupOrchestration'),
      items: [
        navItem('repositories', FolderGit2),
        navItem('scans', Radar),
        navItem('gates', Sliders),
        navItem('secrets', KeyRound),
        navItem('runbooks', Workflow),
      ],
    },
    {
      id: 'observability',
      label: t('nav.groupObservability'),
      items: [navItem('observability', Activity)],
    },
    {
      id: 'governance',
      label: t('nav.groupGovernance'),
      items: [navItem('reports', ClipboardCheck), navItem('traceability', History), navItem('notifications', Bell)],
    },
    {
      id: 'resources',
      label: t('nav.groupResources'),
      items: [navItem('docs', BookOpen), navItem('integrations', Puzzle)],
    },
  ];

  return (
    <aside
      className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
      style={{
        width: isCollapsed ? '56px' : '268px',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: isCollapsed ? '0.75rem 0' : '1.25rem 0.85rem',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
      }}
      onScroll={() => hover && setHover(null)}
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
          <WorkspaceSwitcher collapsed={false} />
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
          marginTop: gi === 0 ? (isCollapsed ? '0.25rem' : '1.25rem') : isCollapsed ? '0.3rem' : '0.5rem',
          paddingTop: gi === 0 ? 0 : isCollapsed ? '0.3rem' : '0.5rem',
          gap: isCollapsed ? '0.1rem' : undefined,
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
          const isHovered = hover?.id === item.id;

          return (
            <li
              key={item.id}
              className="nav-item"
              style={{ position: 'relative' }}
              onMouseEnter={(e) => {
                if (!isCollapsed) return;
                const r = e.currentTarget.getBoundingClientRect();
                setHover({ id: item.id, top: r.top + r.height / 2 });
              }}
              onMouseLeave={() => isCollapsed && setHover(null)}
            >
              <button
                className={isActive ? 'active' : ''}
                onClick={() => setActiveTab(item.id)}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '0.45rem 0' : '0.5rem 0.7rem',
                  gap: '0.6rem',
                  position: 'relative',
                  opacity: item.soon && !isActive ? 0.72 : 1,
                }}
              >
                <Icon size={18} />
                {!isCollapsed && (
                  <span
                    title={item.label}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.label}
                  </span>
                )}
                {item.soon && !isCollapsed && (
                  <span
                    style={{
                      flex: '0 0 auto',
                      fontSize: '0.56rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      padding: '0.08rem 0.35rem',
                      borderRadius: '999px',
                      background: 'rgba(130, 80, 223, 0.22)',
                      color: '#c297ff',
                    }}
                  >
                    {t('nav.soon')}
                  </span>
                )}
                {item.soon && isCollapsed && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '12px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#a371f7',
                    }}
                  />
                )}
              </button>

              {isCollapsed && isHovered && hover && (
                <div
                  style={{
                    position: 'fixed',
                    left: '62px',
                    top: hover.top,
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
                  {item.soon && ` · ${t('nav.soon')}`}
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
