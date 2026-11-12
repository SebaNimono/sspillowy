import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Finding, Repository, Scan } from '../api/client';
import { WidgetSpan } from '../config/dashboardConfig';
import {
  Database,
  Plus,
  Trash2,
  X,
  BarChart3,
  Hash,
  Table2,
  Filter,
  Sparkles,
  GitPullRequestDraft,
  TerminalSquare,
  Radar,
  CheckCircle2,
} from 'lucide-react';

export type QueryDataSource = 'findings' | 'scans' | 'repositories';
export type QueryGroupBy = 'severity' | 'engine' | 'repository' | 'status' | 'gate';
export type QueryChartType = 'kpi' | 'bar' | 'table';

export interface CustomQueryWidget {
  id: string;
  title: string;
  source: QueryDataSource;
  severityFilter: string; // 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  engineFilter: string;   // 'ALL' | 'semgrep' | 'gitleaks' | 'trivy' | 'owasp_zap'
  statusFilter: string;   // 'ALL' | 'OPEN' | 'IN_REVIEW' | 'FIXED' | 'FALSE_POSITIVE' | 'ACCEPTED_RISK'
  tagFilter: string;      // 'ALL' or tag name
  groupBy: QueryGroupBy;
  chartType: QueryChartType;
  span: WidgetSpan;
  createdAt: string;
}

const CUSTOM_QUERY_WIDGETS_KEY = 'sspillowy_custom_query_widgets_v1';

export function loadCustomQueryWidgets(): CustomQueryWidget[] {
  try {
    const raw = localStorage.getItem(CUSTOM_QUERY_WIDGETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomQueryWidgets(widgets: CustomQueryWidget[]): void {
  try {
    localStorage.setItem(CUSTOM_QUERY_WIDGETS_KEY, JSON.stringify(widgets));
  } catch {
    // ignore
  }
}

const BAR_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  INFO: '#64748b',
  PASSED: '#16a34a',
  BLOCKED: '#dc2626',
  BYPASSED: '#7c3aed',
  semgrep: '#2563eb',
  trivy: '#0891b2',
  gitleaks: '#d97706',
  owasp_zap: '#7c3aed',
};

function evaluateQueryWidget(
  w: CustomQueryWidget,
  findings: Finding[],
  scans: Scan[],
  repositories: Repository[],
): { total: number; rows: { key: string; label: string; value: number; color: string; extra?: string }[]; sqlPreview: string } {
  const repoById = new Map(repositories.map((r) => [r.id, r]));

  const allowedRepoIds =
    w.tagFilter && w.tagFilter !== 'ALL'
      ? new Set(repositories.filter((r) => (r.tags || []).includes(w.tagFilter)).map((r) => r.id))
      : null;

  if (w.source === 'findings') {
    const filtered = findings.filter((f) => {
      if (allowedRepoIds && !allowedRepoIds.has(f.repository_id)) return false;
      if (w.severityFilter !== 'ALL' && f.severity !== w.severityFilter) return false;
      if (w.engineFilter !== 'ALL' && f.engine !== w.engineFilter) return false;
      if (w.statusFilter !== 'ALL' && f.status !== w.statusFilter) return false;
      return true;
    });

    const counts = new Map<string, number>();
    for (const f of filtered) {
      let k = 'OTRO';
      if (w.groupBy === 'severity') k = f.severity || 'INFO';
      else if (w.groupBy === 'engine') k = f.engine || 'unknown';
      else if (w.groupBy === 'status') k = f.status || 'OPEN';
      else if (w.groupBy === 'repository') k = f.repository_name || repoById.get(f.repository_id)?.name || f.repository_id;
      else k = f.severity || 'INFO';
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    const rows = [...counts.entries()]
      .map(([key, value]) => ({
        key,
        label: key,
        value,
        color: BAR_COLORS[key] || '#2563eb',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const whereParts: string[] = [];
    if (w.severityFilter !== 'ALL') whereParts.push(`severity = '${w.severityFilter}'`);
    if (w.engineFilter !== 'ALL') whereParts.push(`engine = '${w.engineFilter}'`);
    if (w.statusFilter !== 'ALL') whereParts.push(`status = '${w.statusFilter}'`);
    if (w.tagFilter !== 'ALL') whereParts.push(`repo.tags CONTAINS '${w.tagFilter}'`);
    const whereClause = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';
    const sqlPreview = `SELECT ${w.groupBy}, COUNT(*) FROM findings${whereClause} GROUP BY ${w.groupBy}`;

    return { total: filtered.length, rows, sqlPreview };
  }

  if (w.source === 'scans') {
    const filtered = scans.filter((s) => {
      if (allowedRepoIds && !allowedRepoIds.has(s.repository_id)) return false;
      if (w.statusFilter !== 'ALL' && s.status !== w.statusFilter) return false;
      return true;
    });

    const counts = new Map<string, number>();
    for (const s of filtered) {
      let k = 'OTRO';
      if (w.groupBy === 'gate') k = s.gate_status || 'SIN_GATE';
      else if (w.groupBy === 'repository') k = repoById.get(s.repository_id)?.name || s.repository_id;
      else k = s.status || 'COMPLETED';
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    const rows = [...counts.entries()]
      .map(([key, value]) => ({
        key,
        label: key,
        value,
        color: BAR_COLORS[key] || '#2563eb',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const sqlPreview = `SELECT ${w.groupBy}, COUNT(*) FROM scans${w.tagFilter !== 'ALL' ? ` WHERE repo.tag = '${w.tagFilter}'` : ''} GROUP BY ${w.groupBy}`;
    return { total: filtered.length, rows, sqlPreview };
  }

  // source === 'repositories'
  const filteredRepos = repositories.filter((r) => {
    if (w.tagFilter !== 'ALL' && !(r.tags || []).includes(w.tagFilter)) return false;
    return true;
  });

  const rows = filteredRepos
    .map((r) => ({
      key: r.id,
      label: r.name,
      value: r.health_score ?? 100,
      color: (r.health_score ?? 100) >= 80 ? '#16a34a' : (r.health_score ?? 100) >= 60 ? '#d97706' : '#dc2626',
      extra: (r.tags || []).map((t) => `#${t}`).join(' ') || r.branch,
    }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 8);

  const sqlPreview = `SELECT name, health_score FROM repositories${w.tagFilter !== 'ALL' ? ` WHERE '${w.tagFilter}' = ANY(tags)` : ''} ORDER BY health_score ASC`;
  return { total: filteredRepos.length, rows, sqlPreview };
}

export const CustomQueryWidgetCard: React.FC<{
  widget: CustomQueryWidget;
  findings: Finding[];
  scans: Scan[];
  repositories: Repository[];
  onDelete: (id: string) => void;
}> = ({ widget, findings, scans, repositories, onDelete }) => {
  const result = useMemo(
    () => evaluateQueryWidget(widget, findings, scans, repositories),
    [widget, findings, scans, repositories],
  );

  return (
    <section className={`card dw-widget dw-span-${widget.span} ss-query-widget`}>
      <header className="dw-head">
        <div className="card-title">
          <Database size={16} color="#2563eb" />
          <span>{widget.title}</span>
        </div>
        <div className="dw-head-right">
          <span className="ss-chart-pill" title={result.sqlPreview}>
            <Filter size={11} />
            <span>Consulta · {result.total} reg.</span>
          </span>
          <button
            type="button"
            className="ss-kpi-more"
            onClick={() => onDelete(widget.id)}
            title="Eliminar widget personalizado"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      <div className="dw-body">
        <div className="ss-query-sql-bar">
          <code>{result.sqlPreview}</code>
        </div>

        {widget.chartType === 'kpi' && (
          <div className="ss-query-kpi-view">
            <div className="ss-query-kpi-big">{result.total}</div>
            <div className="ss-query-kpi-meta">
              <span>Registros que cumplen la consulta</span>
              <div className="ss-query-kpi-chips">
                {result.rows.slice(0, 4).map((r) => (
                  <span key={r.key} className="ss-gate-pill">
                    <i style={{ background: r.color }} />
                    <span>{r.label}:</span>
                    <b>{r.value}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {widget.chartType === 'bar' && (
          <div className="dash-chart" style={{ height: 195 }}>
            {result.rows.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.rows} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="value" name="Cantidad" radius={[6, 6, 3, 3]} maxBarSize={28}>
                    {result.rows.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="dash-panel-empty">Sin resultados para los filtros seleccionados.</p>
            )}
          </div>
        )}

        {widget.chartType === 'table' && (
          <div className="ss-service-table-wrap" style={{ marginTop: 4 }}>
            <table className="ss-service-table">
              <thead>
                <tr>
                  <th>Grupo / Clave</th>
                  <th>Valor</th>
                  <th>Porcentaje</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: '#6b7280' }}>
                      Sin datos para esta consulta
                    </td>
                  </tr>
                ) : (
                  result.rows.map((r) => (
                    <tr key={r.key}>
                      <td className="ss-service-name">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                          {r.label}
                        </span>
                      </td>
                      <td>
                        <b>{r.value}</b>
                      </td>
                      <td className="ss-service-url">
                        {widget.source === 'repositories'
                          ? r.extra || 'Health %'
                          : result.total > 0
                            ? `${Math.round((r.value / result.total) * 100)}%`
                            : '0%'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export const QueryWidgetBuilderModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSave: (widget: CustomQueryWidget) => void;
  availableTags: string[];
  findings: Finding[];
  scans: Scan[];
  repositories: Repository[];
}> = ({ open, onClose, onSave, availableTags, findings, scans, repositories }) => {
  const [title, setTitle] = useState('Hallazgos críticos y altos por motor');
  const [source, setSource] = useState<QueryDataSource>('findings');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [engineFilter, setEngineFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [groupBy, setGroupBy] = useState<QueryGroupBy>('engine');
  const [chartType, setChartType] = useState<QueryChartType>('bar');
  const [span, setSpan] = useState<WidgetSpan>(6);

  const draftWidget: CustomQueryWidget = useMemo(
    () => ({
      id: 'preview',
      title: title.trim() || 'Widget personalizado',
      source,
      severityFilter,
      engineFilter,
      statusFilter,
      tagFilter,
      groupBy,
      chartType,
      span,
      createdAt: new Date().toISOString(),
    }),
    [title, source, severityFilter, engineFilter, statusFilter, tagFilter, groupBy, chartType, span],
  );

  const preview = useMemo(
    () => evaluateQueryWidget(draftWidget, findings, scans, repositories),
    [draftWidget, findings, scans, repositories],
  );

  if (!open) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...draftWidget,
      id: `qw-${Date.now()}`,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 680, width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Database size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                Crear Widget basado en Consulta
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: 0 }}>
                Construye un panel a medida filtrando hallazgos, escaneos o repositorios por severidad, motor, estado o tag.
              </p>
            </div>
          </div>
          <button type="button" className="ss-kpi-more" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Título del Widget
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Secretos abiertos en repositorios de producción"
                required
                style={{
                  width: '100%',
                  padding: '0.55rem 0.7rem',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  fontSize: '0.84rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Fuente de datos (`FROM`)
              </label>
              <select
                value={source}
                onChange={(e) => {
                  const next = e.target.value as QueryDataSource;
                  setSource(next);
                  if (next === 'scans') setGroupBy('gate');
                  else if (next === 'repositories') setGroupBy('repository');
                  else setGroupBy('engine');
                }}
                style={{ width: '100%', padding: '0.52rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.83rem' }}
              >
                <option value="findings">Hallazgos de seguridad (findings)</option>
                <option value="scans">Historial de escaneos (scans)</option>
                <option value="repositories">Repositorios monitoreados (repositories)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Agrupar por (`GROUP BY`)
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as QueryGroupBy)}
                style={{ width: '100%', padding: '0.52rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.83rem' }}
              >
                {source === 'findings' && (
                  <>
                    <option value="engine">Motor (Semgrep / Trivy / GitLeaks / ZAP)</option>
                    <option value="severity">Severidad (Crítico / Alto / Medio / Bajo)</option>
                    <option value="repository">Repositorio</option>
                    <option value="status">Estado HITL (Abierto / En revisión / Corregido)</option>
                  </>
                )}
                {source === 'scans' && (
                  <>
                    <option value="gate">Resultado Security Gate (PASSED / BLOCKED)</option>
                    <option value="repository">Repositorio</option>
                    <option value="status">Estado de ejecución</option>
                  </>
                )}
                {source === 'repositories' && <option value="repository">Health Score por repositorio</option>}
              </select>
            </div>

            {source === 'findings' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Filtro Severidad
                  </label>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    style={{ width: '100%', padding: '0.52rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.83rem' }}
                  >
                    <option value="ALL">Todas las severidades</option>
                    <option value="CRITICAL">Solo CRITICAL</option>
                    <option value="HIGH">Solo HIGH</option>
                    <option value="MEDIUM">Solo MEDIUM</option>
                    <option value="LOW">Solo LOW</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Filtro Motor
                  </label>
                  <select
                    value={engineFilter}
                    onChange={(e) => setEngineFilter(e.target.value)}
                    style={{ width: '100%', padding: '0.52rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.83rem' }}
                  >
                    <option value="ALL">Todos los motores</option>
                    <option value="semgrep">Semgrep (SAST)</option>
                    <option value="trivy">Trivy (SCA / IaC)</option>
                    <option value="gitleaks">GitLeaks (Secretos)</option>
                    <option value="owasp_zap">OWASP ZAP (DAST)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Filtro Estado
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '100%', padding: '0.52rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.83rem' }}
              >
                <option value="ALL">Cualquier estado</option>
                <option value="OPEN">Abiertos (OPEN)</option>
                <option value="IN_REVIEW">En revisión (IN_REVIEW)</option>
                <option value="FIXED">Corregidos (FIXED)</option>
                <option value="FALSE_POSITIVE">Falsos positivos</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Filtro por Tag de Repositorio
              </label>
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                style={{ width: '100%', padding: '0.52rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.83rem' }}
              >
                <option value="ALL">Todos los repositorios (sin filtro de tag)</option>
                {availableTags.map((tg) => (
                  <option key={tg} value={tg}>
                    #{tg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Tipo de Visualización
              </label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {(
                  [
                    { id: 'bar' as const, label: 'Barras', icon: <BarChart3 size={14} /> },
                    { id: 'kpi' as const, label: 'KPI + Chips', icon: <Hash size={14} /> },
                    { id: 'table' as const, label: 'Tabla', icon: <Table2 size={14} /> },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setChartType(opt.id)}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      padding: '0.48rem',
                      borderRadius: 8,
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      border: chartType === opt.id ? '1px solid #2563eb' : '1px solid #d1d5db',
                      background: chartType === opt.id ? '#eff6ff' : '#ffffff',
                      color: chartType === opt.id ? '#1d4ed8' : '#374151',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Tamaño en el Dashboard
              </label>
              <select
                value={span}
                onChange={(e) => setSpan(Number(e.target.value) as WidgetSpan)}
                style={{ width: '100%', padding: '0.52rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.83rem' }}
              >
                <option value={4}>⅓ ancho (4 columnas)</option>
                <option value={6}>½ ancho (6 columnas)</option>
                <option value={12}>Ancho completo (12 columnas)</option>
              </select>
            </div>
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '0.75rem 0.9rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Vista previa de consulta en vivo
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>
                {preview.total} registros coincidentes
              </span>
            </div>
            <code style={{ display: 'block', fontSize: '0.74rem', color: '#0f172a', marginBottom: 8 }}>
              {preview.sqlPreview}
            </code>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {preview.rows.slice(0, 6).map((r) => (
                <span key={r.key} className="ss-gate-pill">
                  <i style={{ background: r.color }} />
                  <span>{r.label}:</span>
                  <b>{r.value}</b>
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              <Plus size={15} />
              <span>Agregar Widget al Dashboard</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const PillowyAgentRoadmapCard: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  return (
    <section className="card ss-agent-roadmap-card">
      <div className="ss-agent-roadmap-top">
        <div className="ss-agent-roadmap-title-wrap">
          <span className="ss-agent-badge">
            <Sparkles size={12} />
            <span>PRÓXIMAMENTE · LAB v2.0</span>
          </span>
          <h3>Pillowy Autonomous Agent — Remediación y Prevención Autónoma</h3>
          <p>
            Evolución planificada del asistente contextual Pillow hacia un agente autónomo con capacidad de acción
            directa en repositorios, terminal de desarrollador y vigilancia continua de dependencias.
          </p>
        </div>
        {onNavigate && (
          <button type="button" className="ss-download-btn" onClick={() => onNavigate('docs')}>
            <span>Ver especificación técnica en Docs →</span>
          </button>
        )}
      </div>

      <div className="ss-agent-roadmap-grid">
        <div className="ss-agent-feature-box">
          <div className="ss-agent-feature-head">
            <span className="ss-agent-icon">
              <GitPullRequestDraft size={16} />
            </span>
            <div>
              <strong>Auto-PR Remediation Agent</strong>
              <span className="ss-agent-phase">Fase 1 · En diseño</span>
            </div>
          </div>
          <p>
            Generación automática de ramas y Pull Requests en GitHub/GitLab con el parche validado por un re-escaneo
            local de Semgrep antes de solicitar revisión humana (HITL).
          </p>
        </div>

        <div className="ss-agent-feature-box">
          <div className="ss-agent-feature-head">
            <span className="ss-agent-icon">
              <TerminalSquare size={16} />
            </span>
            <div>
              <strong>Pillow CLI & Pre-Commit Gate</strong>
              <span className="ss-agent-phase">Fase 2 · Roadmap</span>
            </div>
          </div>
          <p>
            Agente ligero en terminal (`npx pillowy scan --staged`) conectado al motor de archivo único para bloquear
            secretos e inyecciones en local en menos de 2 segundos antes del `git push`.
          </p>
        </div>

        <div className="ss-agent-feature-box">
          <div className="ss-agent-feature-head">
            <span className="ss-agent-icon">
              <Radar size={16} />
            </span>
            <div>
              <strong>Continuous SBOM Zero-Day Watch</strong>
              <span className="ss-agent-phase">Fase 3 · Roadmap</span>
            </div>
          </div>
          <p>
            Cruza automáticamente el inventario CycloneDX almacenado de cada repositorio contra nuevos CVEs publicados
            diariamente sin necesidad de volver a clonar el código fuente.
          </p>
        </div>
      </div>

      <div className="ss-agent-roadmap-foot">
        <span>
          <CheckCircle2 size={13} color="#16a34a" /> <b>Disponible hoy:</b> Copiloto contextual Pillow, Fix Intelligence
          con parches sugeridos, escaneo de 1 archivo instantáneo y Security Gate determinista.
        </span>
      </div>
    </section>
  );
};
