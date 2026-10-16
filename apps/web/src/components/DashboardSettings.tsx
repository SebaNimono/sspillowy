import React, { useState } from 'react';
import { Settings2, X } from 'lucide-react';
import {
  DashboardConfig,
  WIDGET_GROUPS,
  WIDGET_HINTS,
  WIDGET_IDS,
  WIDGET_LABELS,
  saveDashboardConfig,
  syncDashboardConfigToUrl,
} from '../config/dashboardConfig';

interface DashboardSettingsProps {
  config: DashboardConfig;
  onChange: (config: DashboardConfig) => void;
  /** false: el dashboard guarda su propia configuración en el servidor. */
  persistLocal?: boolean;
}

export const DashboardSettings: React.FC<DashboardSettingsProps> = ({ config, onChange, persistLocal = true }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);

  const openPanel = () => {
    setDraft(config);
    setOpen(true);
  };

  const apply = () => {
    if (persistLocal) {
      saveDashboardConfig(draft);
      syncDashboardConfigToUrl(draft);
    }
    onChange(draft);
    setOpen(false);
  };

  const setAll = (on: boolean) => {
    const widgets = Object.fromEntries(WIDGET_IDS.map((id) => [id, on])) as DashboardConfig['widgets'];
    setDraft({ ...draft, widgets });
  };

  const enabledCount = WIDGET_IDS.filter((id) => draft.widgets[id]).length;

  if (!open) {
    return (
      <button type="button" className="dash-settings-trigger" onClick={openPanel} title="Personalizar dashboard">
        <Settings2 size={16} />
        <span>Personalizar</span>
      </button>
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
            <p className="dash-settings-sub">{enabledCount} de {WIDGET_IDS.length} bloques activos</p>
          </div>
          <button type="button" className="dash-settings-close" onClick={() => setOpen(false)} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <p className="dash-settings-lead">
          Activa solo lo que necesitas y define umbrales. Si un valor supera el máximo (o el health baja del mínimo), el
          KPI se tiñe en rojo suave.{' '}
          {persistLocal
            ? 'Los ajustes quedan en este navegador y en la URL.'
            : 'Los ajustes se guardan en este dashboard y los ve todo el equipo.'}
        </p>

        <section className="dash-settings-section">
          <div className="dash-settings-section-head">
            <h3>Bloques visibles</h3>
            <div className="dash-settings-bulk">
              <button type="button" onClick={() => setAll(true)}>
                Todos
              </button>
              <button type="button" onClick={() => setAll(false)}>
                Ninguno
              </button>
            </div>
          </div>

          {WIDGET_GROUPS.map((group) => (
            <div key={group.title} className="dash-settings-group">
              <h4>{group.title}</h4>
              <div className="dash-settings-tiles">
                {group.ids.map((id) => (
                  <label key={id} className={`dash-settings-tile ${draft.widgets[id] ? 'is-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={draft.widgets[id]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          widgets: { ...draft.widgets, [id]: e.target.checked },
                        })
                      }
                    />
                    <span className="dash-settings-tile-title">{WIDGET_LABELS[id]}</span>
                    <span className="dash-settings-tile-hint">{WIDGET_HINTS[id]}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
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
            <code>?w=kpis,health,heatmap&amp;crit_max=0&amp;health_min=80</code>
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
