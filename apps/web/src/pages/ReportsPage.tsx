import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  MinusCircle,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { Toast, ToastMessage } from '../components/Toast';
import { ApiOfflineBanner } from '../components/ApiOfflineBanner';
import {
  ComplianceControl,
  ComplianceControlPatch,
  ComplianceFramework,
  ComplianceOverview,
  ComplianceStatus,
  fetchCompliance,
  fetchComplianceEvidence,
  setComplianceFramework,
  updateComplianceControl,
} from '../api/client';
import { formatDateTime } from '../utils/formatDateTime';
import { usePillowPageContext } from '../config/pillowContext';
import { useI18n } from '../i18n/I18nProvider';
import PageSkeleton from '../components/PageSkeleton';
import '../styles/compliance.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const STATUS_META: Record<ComplianceStatus, { label: string; color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  COMPLIANT: { label: 'Cumple', color: '#1a7f37', bg: '#dafbe1', Icon: CheckCircle2 },
  PARTIAL: { label: 'Parcial', color: '#9a6700', bg: '#fff8c5', Icon: AlertTriangle },
  GAP: { label: 'Brecha', color: '#cf222e', bg: '#ffebe9', Icon: XCircle },
  PENDING: { label: 'Falta evidencia', color: '#8250df', bg: '#fbefff', Icon: Clock },
  NOT_APPLICABLE: { label: 'No aplica', color: '#656d76', bg: '#eaeef2', Icon: MinusCircle },
};

const STATUS_ORDER: ComplianceStatus[] = ['GAP', 'PENDING', 'PARTIAL', 'COMPLIANT', 'NOT_APPLICABLE'];

const SELECTED_KEY = 'sspillowy_compliance_framework';

const scoreTone = (score: number) => (score >= 80 ? '#1a7f37' : score >= 50 ? '#bf8700' : '#cf222e');

const StatusBadge: React.FC<{ status: ComplianceStatus }> = ({ status }) => {
  const m = STATUS_META[status];
  return (
    <span className="cp-status" style={{ color: m.color, background: m.bg }}>
      <m.Icon size={12} /> {m.label}
    </span>
  );
};

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export const ReportsPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
}) => {
  const { t } = useI18n();
  const [data, setData] = useState<ComplianceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiOffline, setApiOffline] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [view, setView] = useState<'frameworks' | 'controls'>('frameworks');
  const [selected, setSelected] = useState<string | null>(() => localStorage.getItem(SELECTED_KEY));
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | 'ALL'>('ALL');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [openControl, setOpenControl] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const notify = (type: ToastMessage['type'], title: string, message: string) =>
    setToast({ id: Date.now().toString(), type, title, message });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchCompliance());
      setApiOffline(false);
    } catch {
      setApiOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => (data?.frameworks ?? []).filter((f) => f.enabled), [data]);
  const framework: ComplianceFramework | undefined = active.find((f) => f.id === selected) ?? active[0];
  const controlsById = useMemo(() => new Map((data?.controls ?? []).map((c) => [c.id, c])), [data]);
  const domainName = useMemo(() => new Map((data?.domains ?? []).map((d) => [d.id, d.name])), [data]);
  const drawerControl = openControl ? controlsById.get(openControl) : undefined;

  const selectFramework = (id: string) => {
    setSelected(id);
    setStatusFilter('ALL');
    localStorage.setItem(SELECTED_KEY, id);
  };

  const toggleFramework = async (id: string, enabled: boolean) => {
    setBusy(true);
    try {
      setData(await setComplianceFramework(id, enabled));
    } catch (e) {
      notify('error', 'No se pudo cambiar el marco', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const saveControl = async (id: string, patch: ComplianceControlPatch, success: string) => {
    setBusy(true);
    try {
      setData(await updateComplianceControl(id, patch));
      notify('success', success, 'El estado de los marcos se recalculó.');
      return true;
    } catch (e) {
      notify('error', 'No se pudo guardar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const exportJson = async (fw: ComplianceFramework) => {
    try {
      const pack = await fetchComplianceEvidence(fw.id);
      download(`sspillowy-${fw.id}-evidencia-${data?.period ?? ''}.json`, JSON.stringify(pack, null, 2), 'application/json');
      notify('success', 'Paquete de evidencia generado', `Se descargó la evidencia de ${fw.name}.`);
    } catch (e) {
      notify('error', 'No se pudo generar la evidencia', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    }
  };

  const exportCsv = (fw: ComplianceFramework) => {
    const rows = [['Marco', 'Requisito', 'Título', 'Grupo', 'Estado', 'Motivo', 'Controles', 'Responsables']];
    for (const r of fw.requirements) {
      const owners = r.controls.map((id) => controlsById.get(id)?.owner_email).filter(Boolean);
      rows.push([
        fw.short,
        r.id,
        r.title,
        r.group,
        STATUS_META[r.status].label,
        r.reason,
        r.controls.join(' '),
        Array.from(new Set(owners)).join(' '),
      ] as string[]);
    }
    const csv = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\n');
    download(`sspillowy-${fw.id}-${data?.period ?? ''}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const pillowContext = useMemo(() => {
    if (!data) return null;
    return {
      periodo: data.period,
      marcos_activos: active.map((f) => ({ marco: f.name, preparacion: `${f.score}%`, estados: f.counts })),
      marco_seleccionado: framework?.name,
      controles: data.summary,
      controles_con_brecha: data.controls.filter((c) => c.status === 'GAP').map((c) => `${c.id} ${c.name}: ${c.reason}`),
      controles_sin_evidencia: data.controls.filter((c) => c.status === 'PENDING').map((c) => `${c.id} ${c.name}`),
    };
  }, [data, active, framework]);
  usePillowPageContext('reports', pillowContext);

  const groupedRequirements = useMemo(() => {
    if (!framework) return [];
    const reqs = framework.requirements.filter((r) => statusFilter === 'ALL' || r.status === statusFilter);
    const groups = new Map<string, typeof reqs>();
    for (const r of reqs) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
    return Array.from(groups.entries());
  }, [framework, statusFilter]);

  const filteredControls = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.controls ?? [])
      .filter((c) => domainFilter === 'ALL' || c.domain === domainFilter)
      .filter((c) => statusFilter === 'ALL' || c.status === statusFilter)
      .filter((c) => !q || `${c.id} ${c.name} ${c.description}`.toLowerCase().includes(q))
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  }, [data, domainFilter, statusFilter, query]);

  const s = data?.summary;

  return (
    <div className="cp-page">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header
        title={t('pages.reports.title')}
        subtitle="Un control se prueba una vez y cuenta para todos los marcos que lo piden: ISO 27001, SOC 2, NIST, PCI DSS, CIS, OWASP y la Ley Marco de Ciberseguridad."
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      {apiOffline && <ApiOfflineBanner />}

      <div className="card cp-toolbar">
        <div className="vl-ranges" role="tablist" aria-label="Vista">
          <button type="button" className={`vl-range ${view === 'frameworks' ? 'is-active' : ''}`} onClick={() => { setView('frameworks'); setStatusFilter('ALL'); }}>
            <Layers size={14} /> Marcos
          </button>
          <button type="button" className={`vl-range ${view === 'controls' ? 'is-active' : ''}`} onClick={() => { setView('controls'); setStatusFilter('ALL'); }}>
            <ShieldCheck size={14} /> Controles
          </button>
        </div>
        <div className="cp-toolbar-actions">
          {data && <span className="cp-muted">Periodo {data.period}</span>}
          <button type="button" className="btn btn-secondary" onClick={() => setCatalogOpen(true)}>
            <Settings2 size={15} /> Gestionar marcos
          </button>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} aria-label="Actualizar">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {s && active.length > 0 && (
        <div className="cp-summary">
          <div className="cp-summary-item">
            <span>Marcos activos</span>
            <strong>{active.length}</strong>
            <small>de {data?.frameworks.length} disponibles</small>
          </div>
          <div className="cp-summary-item">
            <span>Controles que cumplen</span>
            <strong style={{ color: '#1a7f37' }}>
              {s.passing}/{s.controls - s.not_applicable}
            </strong>
            <small>{s.partial} parciales</small>
          </div>
          <div className="cp-summary-item">
            <span>Con brecha</span>
            <strong style={{ color: s.failing ? '#cf222e' : undefined }}>{s.failing}</strong>
            <small>requieren corrección</small>
          </div>
          <div className="cp-summary-item">
            <span>Falta evidencia</span>
            <strong style={{ color: s.pending ? '#8250df' : undefined }}>{s.pending}</strong>
            <small>controles de proceso por verificar</small>
          </div>
        </div>
      )}

      {loading && !data && <PageSkeleton variant="panel" rows={6} />}

      {data && view === 'frameworks' && (
        <>
          {active.length === 0 ? (
            <div className="card cp-empty">
              <ClipboardCheck size={28} color="#0969da" />
              <p>
                Aún no mides ningún marco. Elige los que aplican a tu organización (por ejemplo ISO 27001 o SOC 2) y
                verás qué cumples y qué te falta.
              </p>
              <button type="button" className="btn btn-primary" onClick={() => setCatalogOpen(true)}>
                Gestionar marcos
              </button>
            </div>
          ) : (
            <div className="cp-fw-grid">
              {active.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`cp-fw-card ${framework?.id === f.id ? 'is-active' : ''}`}
                  onClick={() => selectFramework(f.id)}
                >
                  <div className="cp-fw-top">
                    <div>
                      <strong>{f.short}</strong>
                      <small>{f.category}</small>
                    </div>
                    <span className="cp-fw-score" style={{ color: scoreTone(f.score) }}>
                      {f.score}%
                    </span>
                  </div>
                  <div className="cp-fw-bar" aria-hidden>
                    {STATUS_ORDER.slice(0, 4)
                      .slice()
                      .reverse()
                      .map((st) => (
                        <i key={st} style={{ flex: f.counts[st], background: STATUS_META[st].color }} />
                      ))}
                  </div>
                  <div className="cp-fw-foot">
                    <span>
                      {f.counts.COMPLIANT} de {f.total - f.counts.NOT_APPLICABLE} requisitos cumplen
                    </span>
                    {f.trend.length > 1 && (
                      <div className="cp-spark" aria-hidden>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={f.trend}>
                            <YAxis hide domain={[0, 100]} />
                            <Line type="monotone" dataKey="score" stroke={scoreTone(f.score)} strokeWidth={2} dot={false} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {framework && (
            <div className="card cp-detail">
              <div className="cp-detail-head">
                <div>
                  <h2>{framework.name}</h2>
                  <p>{framework.description}</p>
                </div>
                <div className="cp-detail-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => exportCsv(framework)}>
                    <FileSpreadsheet size={15} /> CSV
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => exportJson(framework)}>
                    <Download size={15} /> Paquete de evidencia
                  </button>
                </div>
              </div>

              <div className="cp-chips" role="group" aria-label="Filtrar por estado">
                <button type="button" className={`cp-chip ${statusFilter === 'ALL' ? 'is-active' : ''}`} onClick={() => setStatusFilter('ALL')}>
                  Todos <b>{framework.total}</b>
                </button>
                {STATUS_ORDER.filter((st) => framework.counts[st]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`cp-chip ${statusFilter === st ? 'is-active' : ''}`}
                    onClick={() => setStatusFilter(statusFilter === st ? 'ALL' : st)}
                  >
                    <i style={{ background: STATUS_META[st].color }} /> {STATUS_META[st].label} <b>{framework.counts[st]}</b>
                  </button>
                ))}
              </div>

              {groupedRequirements.map(([group, reqs]) => (
                <section key={group} className="cp-group">
                  <h3>{group}</h3>
                  <ul className="cp-reqs">
                    {reqs.map((r) => (
                      <li key={r.id} className="cp-req">
                        <code>{r.id}</code>
                        <div className="cp-req-body">
                          <strong>{r.title}</strong>
                          {r.status !== 'COMPLIANT' && <small>{r.reason}</small>}
                          <div className="cp-req-controls">
                            {r.controls.map((cid) => {
                              const c = controlsById.get(cid);
                              if (!c) return null;
                              return (
                                <button
                                  key={cid}
                                  type="button"
                                  className="cp-control-chip"
                                  onClick={() => setOpenControl(cid)}
                                  title={`${c.name} · ${STATUS_META[c.status].label}`}
                                >
                                  <i style={{ background: STATUS_META[c.status].color }} />
                                  {c.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <StatusBadge status={r.status} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {groupedRequirements.length === 0 && <p className="cp-muted">No hay requisitos con este estado.</p>}
            </div>
          )}
        </>
      )}

      {data && view === 'controls' && (
        <div className="card">
          <div className="cp-controls-filters">
            <label className="cp-search">
              <Search size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar control…" />
            </label>
            <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} aria-label="Dominio">
              <option value="ALL">Todos los dominios</option>
              {data.domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ComplianceStatus | 'ALL')} aria-label="Estado">
              <option value="ALL">Todos los estados</option>
              {STATUS_ORDER.map((st) => (
                <option key={st} value={st}>
                  {STATUS_META[st].label}
                </option>
              ))}
            </select>
          </div>
          <div className="table-container">
            <table className="custom-table cp-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Marcos</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {filteredControls.map((c) => (
                  <tr key={c.id} onClick={() => setOpenControl(c.id)} className="cp-row">
                    <td>
                      <div className="cp-ctl-name">
                        <code>{c.id}</code> <strong>{c.name}</strong>
                      </div>
                      <small>{c.reason}</small>
                    </td>
                    <td>
                      <span className={`cp-type ${c.type}`}>{c.type === 'auto' ? 'Automático' : 'Manual'}</span>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      <div className="cp-fw-tags">
                        {c.mappings
                          .filter((m) => m.enabled)
                          .map((m) => (
                            <span key={m.framework_id}>{m.short}</span>
                          ))}
                      </div>
                    </td>
                    <td className="cp-muted">{c.owner_email ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredControls.length === 0 && <p className="cp-muted" style={{ padding: '1rem' }}>Ningún control coincide con los filtros.</p>}
          </div>
        </div>
      )}

      {data && (
        <p className="cp-disclaimer">
          La evaluación es orientativa y sirve para preparar auditorías: muestra qué tan cerca estás de cada marco con la evidencia que
          la plataforma puede comprobar. No reemplaza la opinión de un auditor certificado.
        </p>
      )}

      {drawerControl && (
        <ControlDrawer
          key={drawerControl.id}
          control={drawerControl}
          domain={domainName.get(drawerControl.domain) ?? ''}
          busy={busy}
          onClose={() => setOpenControl(null)}
          onSave={saveControl}
        />
      )}

      {catalogOpen && data && (
        <div className="cp-modal-backdrop" onClick={() => setCatalogOpen(false)}>
          <div className="cp-modal" role="dialog" aria-label="Gestionar marcos" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-head">
              <div>
                <h2>Marcos normativos</h2>
                <p>Activa los que aplican a tu organización. Los controles se comparten, así que activar uno nuevo no exige repetir trabajo.</p>
              </div>
              <button type="button" className="cp-icon-btn" onClick={() => setCatalogOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <ul className="cp-catalog">
              {data.frameworks.map((f) => (
                <li key={f.id}>
                  <div>
                    <strong>{f.name}</strong>
                    <span className="cp-cat">{f.category}</span>
                    <p>{f.description}</p>
                    <small>
                      {f.total} requisitos · preparación actual {f.score}%
                    </small>
                  </div>
                  <label className="cp-switch">
                    <input type="checkbox" checked={f.enabled} disabled={busy} onChange={(e) => toggleFramework(f.id, e.target.checked)} />
                    <span />
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

interface DrawerProps {
  control: ComplianceControl;
  domain: string;
  busy: boolean;
  onClose: () => void;
  onSave: (id: string, patch: ComplianceControlPatch, success: string) => Promise<boolean>;
}

const ControlDrawer: React.FC<DrawerProps> = ({ control: c, domain, busy, onClose, onSave }) => {
  const [owner, setOwner] = useState(c.owner_email ?? '');
  const [evidenceUrl, setEvidenceUrl] = useState(c.evidence_url ?? '');
  const [note, setNote] = useState(c.note ?? '');
  const [naOpen, setNaOpen] = useState(false);
  const [naReason, setNaReason] = useState(c.na_reason ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dirty = owner !== (c.owner_email ?? '') || evidenceUrl !== (c.evidence_url ?? '') || note !== (c.note ?? '');
  const hasEvidence = Boolean((c.evidence_url || c.note) && !dirty);

  return (
    <div className="cp-drawer-backdrop" onClick={onClose}>
      <aside className="cp-drawer" role="dialog" aria-label={c.name} onClick={(e) => e.stopPropagation()}>
        <div className="cp-drawer-head">
          <div>
            <div className="cp-drawer-tags">
              <code>{c.id}</code>
              <span className={`cp-type ${c.type}`}>{c.type === 'auto' ? 'Automático' : 'Manual'}</span>
              <span className="cp-muted">{domain}</span>
            </div>
            <h2>{c.name}</h2>
            <p>{c.description}</p>
          </div>
          <button type="button" className="cp-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <section className="cp-result" style={{ borderColor: STATUS_META[c.status].color }}>
          <StatusBadge status={c.status} />
          <p>{c.reason}</p>
          {c.type === 'auto' && c.evidence.length > 0 && (
            <dl>
              {c.evidence.map((e) => (
                <div key={e.label}>
                  <dt>{e.label}</dt>
                  <dd>{e.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {c.type === 'auto' && <small className="cp-muted">Se vuelve a comprobar solo con cada análisis.</small>}
        </section>

        {c.type === 'manual' && c.guidance && (
          <section className="cp-guidance">
            <h3>Qué evidencia aportar</h3>
            <p>{c.guidance}</p>
          </section>
        )}

        <section className="cp-form">
          <h3>Responsable y evidencia</h3>
          <label>
            Responsable
            <input type="email" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="nombre@empresa.cl" />
          </label>
          <label>
            Enlace a la evidencia
            <input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://… (documento, carpeta o ticket)" />
          </label>
          <label>
            Nota
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contexto para el auditor" />
          </label>
          {c.evidence_url && !dirty && (
            <a className="cp-link" href={c.evidence_url} target="_blank" rel="noreferrer noopener">
              Abrir evidencia <ExternalLink size={12} />
            </a>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || !dirty}
            onClick={() => onSave(c.id, { owner_email: owner, evidence_url: evidenceUrl, note }, 'Control actualizado')}
          >
            Guardar
          </button>
        </section>

        {c.type === 'manual' && !c.not_applicable && (
          <section className="cp-attest">
            <h3>Verificación</h3>
            {c.attested_at ? (
              <p>
                Verificado por <b>{c.attested_by}</b> el {formatDate(c.attested_at)}. Vigente hasta el {formatDate(c.expires_at)}.
              </p>
            ) : (
              <p className="cp-muted">Guarda un enlace o una nota de evidencia y luego márcalo como verificado. La verificación dura 12 meses.</p>
            )}
            <div className="cp-attest-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !hasEvidence}
                onClick={() => onSave(c.id, { attest: true }, 'Control verificado')}
              >
                <CheckCircle2 size={15} /> {c.attested_at ? 'Volver a verificar' : 'Marcar como verificado'}
              </button>
              {c.attested_at && (
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onSave(c.id, { attest: false }, 'Verificación retirada')}>
                  Quitar verificación
                </button>
              )}
            </div>
          </section>
        )}

        <section className="cp-na">
          <h3>¿No aplica a tu organización?</h3>
          {c.not_applicable ? (
            <>
              <p>
                Marcado como no aplicable: <i>{c.na_reason}</i>
              </p>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onSave(c.id, { not_applicable: false }, 'El control vuelve a aplicar')}>
                Volver a aplicar
              </button>
            </>
          ) : naOpen ? (
            <>
              <textarea rows={2} value={naReason} onChange={(e) => setNaReason(e.target.value)} placeholder="Explica por qué no aplica (queda en la bitácora)" />
              <div className="cp-attest-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || naReason.trim().length < 5}
                  onClick={async () => {
                    if (await onSave(c.id, { not_applicable: true, na_reason: naReason }, 'Control marcado como «No aplica»')) setNaOpen(false);
                  }}
                >
                  Confirmar
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setNaOpen(false)}>
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="cp-link" onClick={() => setNaOpen(true)}>
              Marcar como «No aplica»
            </button>
          )}
        </section>

        <section>
          <h3>Cuenta para</h3>
          <ul className="cp-mappings">
            {c.mappings.map((m) => (
              <li key={m.framework_id} className={m.enabled ? '' : 'is-off'}>
                <strong>{m.short}</strong>
                <span>{m.requirements.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>

        {c.updated_by && c.updated_at && (
          <small className="cp-muted">
            Último cambio de {c.updated_by} el {formatDateTime(c.updated_at)}
          </small>
        )}
      </aside>
    </div>
  );
};
