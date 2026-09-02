import React from 'react';
import { X } from 'lucide-react';
import { DashboardStats } from '../api/client';
import { PlacedPillowWidget, catalogLabel } from '../config/pillowWidgets';
import { PillowWidgetPreview } from './PillowWidgetPreview';

interface PillowWidgetBoardProps {
  widgets: PlacedPillowWidget[];
  stats: DashboardStats | null;
  onRemove: (id: string) => void;
}

export const PillowWidgetBoard: React.FC<PillowWidgetBoardProps> = ({ widgets, stats, onRemove }) => {
  if (!widgets.length) return null;

  return (
    <section className="pillow-board">
      <div className="pillow-board-head">
        <h2>Tu dashboard Pillow</h2>
        <p>Widgets añadidos manualmente o sugeridos por el agente. Usan datos reales del dashboard cuando existen.</p>
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
              <PillowWidgetPreview type={widget.type} stats={stats} metric={widget.metric} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
