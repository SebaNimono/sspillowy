import React, { useState } from 'react';
import { GripVertical, Settings2, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import {
  DashboardConfig,
  DashboardWidgetId,
  WIDGET_HINTS,
  WIDGET_IDS,
  WIDGET_LABELS,
  WIDGET_SPAN_OPTIONS,
  WidgetSpan,
  moveLayoutItem,
  normalizeLayout,
  saveDashboardConfig,
  setLayoutSpan,
  syncDashboardConfigToUrl,
} from '../config/dashboardConfig';

interface DashboardSettingsProps {
  config: DashboardConfig;
  onChange: (config: DashboardConfig) => void;
  /** false: el dashboard guarda su propia configuración en el servidor. */
  persistLocal?: boolean;
  arranging?: boolean;
  onArrangingChange?: (on: boolean) => void;
}

export const DashboardSettings: React.FC<DashboardSettingsProps> = ({
  config,
  onChange,
  persistLocal = true,
  arranging = false,
  onArrangingChange,
}) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  const [dragId, setDragId] = useState<DashboardWidgetId | null>(null);

  const openPanel = () => {
    setDraft({
      ...config,
      layout: normalizeLayout(config.layout),
    });
    setOpen(true);
  };

  const apply = () => {
    const next = { ...draft, layout: normalizeLayout(draft.layout) };
    if (persistLocal) {
      saveDashboardConfig(next);
      syncDashboardConfigToUrl(next);
    }
    onChange(next);
    setOpen(false);
  };

  const setAll = (on: boolean) => {
    const widgets = Object.fromEntries(WIDGET_IDS.map((id) => [id, on])) as DashboardConfig['widgets'];
    setDraft({ ...draft, widgets });
  };

  const enabledCount = WIDGET_IDS.filter((id) => draft.widgets[id]).length;

  if (!open) {
    return (
      <>
        <button
          type="button"
          className={`dash-settings-trigger ${arranging ? 'is-active' : ''}`}
          onClick={() => onArrangingChange?.(!arranging)}
          title={t('dashboard.move')}
        >
          <GripVertical size={16} />
          <span>{arranging ? t('dashboard.done') : t('dashboard.move')}</span>
        </button>
        <button type="button" className="dash-settings-trigger" onClick={openPanel} title={t('dashboard.customize')}>
          <Settings2 size={16} />
          <span>{t('dashboard.customize')}</span>
        </button>
      </>
    );
  }

  return (
    <div className="dash-settings-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <div
        className="dash-settings-panel"
        role="dialog"
        aria-labelledby="dash-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dash-settings-head">
          <div>
            <h2 id="dash-settings-title">{t('dashboard.settingsTitle')}</h2>
            <p className="dash-settings-sub">
              {t('dashboard.settingsSub', { enabled: enabledCount, total: WIDGET_IDS.length })}
            </p>
          </div>
          <button type="button" className="dash-settings-close" onClick={() => setOpen(false)} aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>

        <p className="dash-settings-lead">
          {t('dashboard.settingsLead')}{' '}
          {persistLocal ? t('dashboard.settingsLeadLocal') : t('dashboard.settingsLeadTeam')}
        </p>

        <section className="dash-settings-section">
          <div className="dash-settings-section-head">
            <h3>{t('dashboard.settingsOrderSize')}</h3>
            <div className="dash-settings-bulk">
              <button type="button" onClick={() => setAll(true)}>
                {t('dashboard.settingsAll')}
              </button>
              <button type="button" onClick={() => setAll(false)}>
                {t('dashboard.settingsNone')}
              </button>
            </div>
          </div>

          <div className="dash-settings-layout">
            {draft.layout.map((item) => (
              <div
                key={item.id}
                className={`dash-settings-layout-row ${draft.widgets[item.id] ? 'is-on' : ''} ${dragId === item.id ? 'is-dragging' : ''}`}
                draggable
                onDragStart={() => setDragId(item.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (!dragId) return;
                  setDraft({ ...draft, layout: moveLayoutItem(draft.layout, dragId, item.id) });
                  setDragId(null);
                }}
              >
                <span className="dash-settings-grip" aria-hidden>
                  <GripVertical size={14} />
                </span>
                <label className="dash-settings-layout-toggle">
                  <input
                    type="checkbox"
                    checked={draft.widgets[item.id]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        widgets: { ...draft.widgets, [item.id]: e.target.checked },
                      })
                    }
                  />
                  <span>
                    <strong>{WIDGET_LABELS[item.id]}</strong>
                    <em>{WIDGET_HINTS[item.id]}</em>
                  </span>
                </label>
                {item.id === 'kpis' ? (
                  <span className="dash-settings-span-fixed">{t('dashboard.settingsFullRow')}</span>
                ) : (
                  <select
                    className="dash-settings-span"
                    value={item.span}
                    disabled={!draft.widgets[item.id]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        layout: setLayoutSpan(draft.layout, item.id, Number(e.target.value) as WidgetSpan),
                      })
                    }
                    aria-label={WIDGET_LABELS[item.id]}
                  >
                    {WIDGET_SPAN_OPTIONS.map((opt) => (
                      <option key={opt.span} value={opt.span}>
                        {opt.span === 12 ? t('dashboard.settingsSpanWide') : opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="dash-settings-section">
          <h3>{t('dashboard.settingsThresholds')}</h3>
          <div className="dash-settings-fields">
            <label>
              <span>{t('dashboard.settingsCritMax')}</span>
              <em>{t('dashboard.settingsCritHint')}</em>
              <input
                type="number"
                min={0}
                value={draft.thresholds.critical_max}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    thresholds: { ...draft.thresholds, critical_max: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label>
              <span>{t('dashboard.settingsHighMax')}</span>
              <em>{t('dashboard.settingsHighHint')}</em>
              <input
                type="number"
                min={0}
                value={draft.thresholds.high_max}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    thresholds: { ...draft.thresholds, high_max: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label>
              <span>{t('dashboard.settingsOpenMax')}</span>
              <em>{t('dashboard.settingsOpenHint')}</em>
              <input
                type="number"
                min={0}
                value={draft.thresholds.open_max}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    thresholds: { ...draft.thresholds, open_max: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label>
              <span>{t('dashboard.settingsHealthMin')}</span>
              <em>{t('dashboard.settingsHealthHint')}</em>
              <input
                type="number"
                min={0}
                max={100}
                value={draft.thresholds.health_min}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    thresholds: { ...draft.thresholds, health_min: Number(e.target.value) },
                  })
                }
              />
            </label>
          </div>
        </section>

        {persistLocal && (
          <p className="dash-settings-query-hint">
            URL:{' '}
            <code>?w=kpis,health,heatmap&amp;layout=kpis:12,trend:8,gates:4&amp;crit_max=0</code>
          </p>
        )}

        <div className="dash-settings-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={apply}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
