import React from 'react';
import { X } from 'lucide-react';
import { DashboardStats } from '../api/client';
import { PlacedPillowWidget, catalogLabel } from '../config/pillowWidgets';

interface PillowWidgetBoardProps {
  widgets: PlacedPillowWidget[];
  stats: DashboardStats | null;
  onRemove: (id: string) => void;
}

function placeholderMetric(stats: DashboardStats | null, metric?: string): string {
  if (!stats || !metric) return '—';
  const map: Record<string, number> = {
    critical_findings: stats.critical_findings,
    high_findings: stats.high_findings,
    total_open_findings: stats.total_open_findings,
    monitored_repos: stats.monitored_repos,
    total_scans_run: stats.total_scans_run,
    overall_health_score: stats.overall_health_score,
    secrets_leaked_prevented: stats.secrets_leaked_prevented,
  };
  if (metric in map) return String(map[metric]);
  return '—';
}

export const PillowWidgetBoard: React.FC<PillowWidgetBoardProps> = ({ widgets, stats, onRemove }) => {
  if (!widgets.length) return null;

  return (
    <section className="pillow-board">
      <div className="pillow-board-head">
        <h2>Tu dashboard Pillow</h2>
        <p>Widgets añadidos manualmente o sugeridos por el agente. Se conectarán a datos reales en la siguiente fase.</p>
      </div>
      <div className="pillow-board-grid">
        {widgets.map((widget) => (
          <article key={widget.id} className={`pillow-widget-card pillow-widget-card--${widget.type}`}>
            <header>
              <div>
                <span className="pillow-widget-type">{catalogLabel(widget.type)}</span>
                <h3>{widget.title}</h3>
              </div>
              <button type="button" className="pillow-widget-remove" onClick={() => onRemove(widget.id)} aria-label="Quitar widget">
                <X size={14} />
              </button>
            </header>
            <div className="pillow-widget-preview">
              {widget.type === 'query_value' && (
                <div className="pillow-preview-kpi">{placeholderMetric(stats, widget.metric)}</div>
              )}
              {widget.type === 'notes' && (
                <p className="pillow-preview-note">Espacio para notas de auditoría o enlaces ISO.</p>
              )}
              {widget.type !== 'query_value' && widget.type !== 'notes' && (
                <div className="pillow-preview-chart" aria-hidden="true">
                  <div className="pillow-preview-bars">
                    <span style={{ height: '45%' }} />
                    <span style={{ height: '70%' }} />
                    <span style={{ height: '35%' }} />
                    <span style={{ height: '55%' }} />
                  </div>
                  <p>Vista previa · {catalogLabel(widget.type)}</p>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
