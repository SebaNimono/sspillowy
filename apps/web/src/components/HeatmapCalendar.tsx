import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HeatmapData } from '../api/client';
import { useI18n } from '../i18n/I18nProvider';

interface HeatmapCalendarProps {
  data: HeatmapData;
}

const LEVEL_COLORS = ['#ebedf0', '#ffc1bc', '#ff8182', '#fa4549', '#82071e'];

export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({ data }) => {
  const { t } = useI18n();
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
              {week.map((cell, ci) => (
                <motion.button
                  key={cell.date}
                  type="button"
                  className="heatmap-cell"
                  style={{ background: LEVEL_COLORS[cell.level] }}
                  title={t('dashboard.heatmapHover', { date: cell.date, count: cell.count })}
                  onMouseEnter={() => setHover({ date: cell.date, count: cell.count })}
                  onMouseLeave={() => setHover(null)}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (wi * 7 + ci) * 0.004, duration: 0.25 }}
                  whileHover={{ scale: 1.35, zIndex: 2 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="heatmap-legend">
        <span className="heatmap-legend-label">
          {hover
            ? t('dashboard.heatmapHover', { date: hover.date, count: hover.count })
            : t('dashboard.heatmapPeriod', { count: data.total_findings_period })}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="heatmap-legend-label">{t('dashboard.less')}</span>
          {LEVEL_COLORS.map((color) => (
            <span key={color} className="heatmap-cell" style={{ background: color }} />
          ))}
          <span className="heatmap-legend-label">{t('dashboard.more')}</span>
        </div>
      </div>
    </div>
  );
};
