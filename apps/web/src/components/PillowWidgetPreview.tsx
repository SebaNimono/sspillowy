import React from 'react';
import { DashboardStats } from '../api/client';
import { PillowWidgetType, catalogLabel } from '../config/pillowWidgets';

interface PillowWidgetPreviewProps {
  type: PillowWidgetType;
  stats: DashboardStats | null;
  metric?: string;
}

function metricValue(stats: DashboardStats | null, metric?: string): number | null {
  if (!stats || !metric) return null;
  const map: Record<string, number> = {
    critical_findings: stats.critical_findings,
    high_findings: stats.high_findings,
    total_open_findings: stats.total_open_findings,
    monitored_repos: stats.monitored_repos,
    total_scans_run: stats.total_scans_run,
    overall_health_score: stats.overall_health_score,
    secrets_leaked_prevented: stats.secrets_leaked_prevented,
  };
  return metric in map ? map[metric] : null;
}

function engineEntries(stats: DashboardStats | null): { name: string; value: number }[] {
  if (!stats?.findings_by_engine) return [];
  return Object.entries(stats.findings_by_engine).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
  }));
}

const COLORS = ['#0969da', '#8250df', '#cf222e', '#bf8700', '#1a7f37', '#6e7781'];

export const PillowWidgetPreview: React.FC<PillowWidgetPreviewProps> = ({ type, stats, metric }) => {
  const engines = engineEntries(stats);
  const hasEngines = engines.some((e) => e.value > 0);
  const trend = stats?.trend_7d ?? [];
  const trendMax = Math.max(...trend, 1);
  const kpi = metricValue(stats, metric);

  if (type === 'query_value') {
    return (
      <div className="pillow-preview-kpi">
        {kpi !== null ? kpi : stats ? '0' : '—'}
        {metric && <small>{metric.replace(/_/g, ' ')}</small>}
      </div>
    );
  }

  if (type === 'notes') {
    return <p className="pillow-preview-note">Notas de auditoría, enlaces ISO o contexto HITL.</p>;
  }

  if (type === 'pie_chart') {
    if (!hasEngines) {
      return <p className="pillow-preview-empty">Sin datos por motor aún.</p>;
    }
    const total = engines.reduce((s, e) => s + e.value, 0);
    let acc = 0;
    const gradient = engines
      .map((e, i) => {
        const start = (acc / total) * 100;
        acc += e.value;
        const end = (acc / total) * 100;
        return `${COLORS[i % COLORS.length]} ${start}% ${end}%`;
      })
      .join(', ');
    return (
      <div className="pillow-preview-pie-wrap">
        <div className="pillow-preview-pie" style={{ background: `conic-gradient(${gradient})` }} />
        <ul className="pillow-preview-legend">
          {engines.map((e, i) => (
            <li key={e.name}>
              <span style={{ background: COLORS[i % COLORS.length] }} />
              {e.name} ({e.value})
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (type === 'bar_chart' || type === 'top_list') {
    const items = hasEngines ? engines : [{ name: 'Semgrep', value: 0 }, { name: 'Trivy', value: 0 }];
    const max = Math.max(...items.map((e) => e.value), 1);
    return (
      <div className="pillow-preview-bars-v">
        {items.slice(0, type === 'top_list' ? 5 : 4).map((e, i) => (
          <div key={e.name} className="pillow-preview-bar-row">
            <span>{e.name}</span>
            <div className="pillow-preview-bar-track">
              <div
                className="pillow-preview-bar-fill"
                style={{ width: `${(e.value / max) * 100}%`, background: COLORS[i % COLORS.length] }}
              />
            </div>
            <b>{e.value}</b>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'timeseries') {
    const points = trend.length ? trend : [0, 0, 0, 0, 0, 0, 0];
    return (
      <div className="pillow-preview-spark">
        {points.map((v, i) => (
          <span key={i} style={{ height: `${Math.max(8, (v / trendMax) * 100)}%` }} />
        ))}
        <p>Últimos 7 días</p>
      </div>
    );
  }

  if (type === 'heatmap') {
    return (
      <div className="pillow-preview-heatmap-mini">
        {Array.from({ length: 28 }).map((_, i) => (
          <span key={i} className={`lvl-${i % 5}`} />
        ))}
      </div>
    );
  }

  if (type === 'table' || type === 'list') {
    return (
      <ul className="pillow-preview-list">
        <li><span>CRITICAL</span><em>—</em></li>
        <li><span>HIGH</span><em>{stats?.high_findings ?? 0}</em></li>
        <li><span>MEDIUM</span><em>{stats?.medium_findings ?? 0}</em></li>
      </ul>
    );
  }

  if (type === 'treemap') {
    return (
      <div className="pillow-preview-treemap">
        {engines.slice(0, 4).map((e, i) => (
          <div key={e.name} style={{ background: COLORS[i % COLORS.length], opacity: 0.85 }}>
            {e.name}
          </div>
        ))}
        {!hasEngines && <div className="pillow-preview-empty-inline">Sin áreas</div>}
      </div>
    );
  }

  return (
    <div className="pillow-preview-chart">
      <p>Vista · {catalogLabel(type)}</p>
    </div>
  );
};
