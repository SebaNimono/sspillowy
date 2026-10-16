import React, { useState } from 'react';
import { GripVertical, Settings2, X } from 'lucide-react';
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
          title="Mover y redimensionar widgets en el tablero"
        >
          <GripVertical size={16} />
          <span>{arranging ? 'Listo' : 'Mover'}</span>
        </button>
        <button type="button" className="dash-settings-trigger" onClick={openPanel} title="Personalizar dashboard">
          <Settings2 size={16} />
          <span>Personalizar</span>
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
            <h2 id="dash-settings-title">Personalizar dashboard</h2>
            <p className="dash-settings-sub">
              {enabledCount} de {WIDGET_IDS.length} bloques · arrastra para ordenar
            </p>
          </div>
          <button type="button" className="dash-settings-close" onClick={() => setOpen(false)} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <p className="dash-settings-lead">
          Activa bloques, cámbiales el ancho y reordénalos. También puedes usar <strong>Mover</strong> en el tablero para
          arrastrarlos en vivo.{' '}
          {persistLocal
            ? 'Los ajustes quedan en este navegador y en la URL.'
            : 'Los ajustes se guardan en este dashboard y los ve todo el equipo.'}
        </p>

        <section className="dash-settings-section">
          <div className="dash-settings-section-head">
            <h3>Orden y tamaño</h3>
            <div className="dash-settings-bulk">
              <button type="button" onClick={() => setAll(true)}>
                Todos
              </button>
              <button type="button" onClick={() => setAll(false)}>
                Ninguno
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
                  <span className="dash-settings-span-fixed">Fila completa</span>
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
                    aria-label={`Ancho de ${WIDGET_LABELS[item.id]}`}
                  >
                    {WIDGET_SPAN_OPTIONS.map((opt) => (
                      <option key={opt.span} value={opt.span}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="dash-settings-section">
          <h3>Umbrales de alerta</h3>
          <div className="dash-settings-fields">
            <label>
              <span>Críticas máx.</span>
              <em>Alerta si hay más que este número</em>
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
              <span>Altas máx.</span>
              <em>Alerta si hay más altas abiertas</em>
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
              <span>Hallazgos abiertos máx.</span>
              <em>Total activos antes de marcar en rojo</em>
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
              <span>Health score mín.</span>
              <em>Alerta si la puntuación baja de este valor</em>
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
            Ejemplo URL:{' '}
            <code>?w=kpis,health,heatmap&amp;layout=kpis:12,trend:8,gates:4&amp;crit_max=0</code>
          </p>
        )}

        <div className="dash-settings-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={apply}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
