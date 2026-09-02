import React, { useState } from 'react';
import { Settings2, X } from 'lucide-react';
import {
  DashboardConfig,
  DashboardWidgetId,
  WIDGET_LABELS,
  saveDashboardConfig,
  syncDashboardConfigToUrl,
} from '../config/dashboardConfig';

interface DashboardSettingsProps {
  config: DashboardConfig;
  onChange: (config: DashboardConfig) => void;
}

const WIDGET_ORDER: DashboardWidgetId[] = ['kpis', 'engines', 'trend', 'health', 'heatmap', 'audit'];

export const DashboardSettings: React.FC<DashboardSettingsProps> = ({ config, onChange }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);

  const openPanel = () => {
    setDraft(config);
    setOpen(true);
  };

  const apply = () => {
    saveDashboardConfig(draft);
    syncDashboardConfigToUrl(draft);
    onChange(draft);
    setOpen(false);
  };

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
          <h2 id="dash-settings-title">Personalizar dashboard</h2>
          <button type="button" className="dash-settings-close" onClick={() => setOpen(false)} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <p className="dash-settings-lead">
          Elige qué bloques ver y los umbrales de alerta. Si un valor supera el máximo (o el health baja del mínimo), se
          marca en rojo. Los ajustes se guardan en este navegador y se reflejan en la URL.
        </p>

        <section className="dash-settings-section">
          <h3>Bloques visibles</h3>
          <div className="dash-settings-checks">
            {WIDGET_ORDER.map((id) => (
              <label key={id}>
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
                <span>{WIDGET_LABELS[id]}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="dash-settings-section">
          <h3>Umbrales de alerta</h3>
          <div className="dash-settings-fields">
            <label>
              <span>Críticas máx. (alerta si hay más)</span>
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
              <span>Health score mín. (alerta si baja)</span>
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

        <p className="dash-settings-query-hint">
          Ejemplo URL:{' '}
          <code>?w=kpis,health,heatmap&amp;crit_max=0&amp;health_min=80</code>
        </p>

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
