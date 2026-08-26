import React, { useState } from 'react';
import { HeatmapData } from '../api/client';

interface HeatmapCalendarProps {
  data: HeatmapData;
}

const LEVEL_COLORS = ['#ebedf0', '#ffc1bc', '#ff8182', '#fa4549', '#82071e'];

export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({ data }) => {
  const [hover, setHover] = useState<{ date: string; count: number } | null>(null);

  const weeks: HeatmapData['cells'][] = [];
  for (let i = 0; i < data.cells.length; i += 7) {
    weeks.push(data.cells.slice(i, i + 7));
  }

  return (
    <div>
      <div className="heatmap-wrap">
        <div className="heatmap-weekdays">
          <span>L</span>
          <span>M</span>
          <span>X</span>
          <span>J</span>
          <span>V</span>
          <span>S</span>
          <span>D</span>
        </div>
        <div className="heatmap-grid">
          {weeks.map((week, wi) => (
            <div key={wi} className="heatmap-col">
              {week.map((cell) => (
                <button
                  key={cell.date}
                  type="button"
                  className="heatmap-cell"
                  style={{ background: LEVEL_COLORS[cell.level] }}
                  title={`${cell.date}: ${cell.count} hallazgos`}
                  onMouseEnter={() => setHover({ date: cell.date, count: cell.count })}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="heatmap-legend">
        <span className="heatmap-legend-label">
          {hover ? `${hover.date} · ${hover.count} hallazgos` : `${data.total_findings_period} hallazgos en 12 semanas`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="heatmap-legend-label">Menos</span>
          {LEVEL_COLORS.map((color) => (
            <span key={color} className="heatmap-cell" style={{ background: color }} />
          ))}
          <span className="heatmap-legend-label">Más</span>
        </div>
      </div>
    </div>
  );
};
