import { Finding } from '../api/client';

export type Severity = Finding['severity'];

export const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: 'Crítico',
  HIGH: 'Alto',
  MEDIUM: 'Medio',
  LOW: 'Bajo',
  INFO: 'Info',
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: '#cf222e',
  HIGH: '#bc4c00',
  MEDIUM: '#9a6700',
  LOW: '#0969da',
  INFO: '#6e7781',
};

/** Días para corregir según severidad (política tipo DefectDojo). */
export const SLA_DAYS: Record<Severity, number> = { CRITICAL: 7, HIGH: 30, MEDIUM: 90, LOW: 180, INFO: 365 };

export const ACTIVE_STATUSES: Finding['status'][] = ['OPEN', 'IN_REVIEW'];

export const isActive = (f: Finding) => ACTIVE_STATUSES.includes(f.status);

export type SlaState = 'ok' | 'due' | 'breached' | 'closed';

const DAY_MS = 86_400_000;

export function ageDays(f: Finding, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(f.created_at).getTime()) / DAY_MS));
}

export function slaState(f: Finding, now = Date.now()): SlaState {
  if (!isActive(f)) return 'closed';
  const limit = SLA_DAYS[f.severity] ?? 90;
  const age = ageDays(f, now);
  if (age > limit) return 'breached';
  if (age >= limit * 0.75) return 'due';
  return 'ok';
}

export function slaRemaining(f: Finding, now = Date.now()): number {
  return (SLA_DAYS[f.severity] ?? 90) - ageDays(f, now);
}

export interface PackageInfo {
  name: string;
  version: string;
  fix: string | null;
}

/** Trivy guarda "Paquete: pkg@version → fix X" en la descripción. */
export function packageOf(f: Finding): PackageInfo | null {
  if (f.engine !== 'trivy') return null;
  const m = /Paquete:\s*(\S+)@([^\s@]*)(?:\s*→\s*fix\s*(.+))?/.exec(f.description || '');
  if (!m) return null;
  return { name: m[1], version: m[2], fix: m[3]?.trim() || null };
}

export function ruleOf(f: Finding): string {
  const idx = f.title.indexOf(':');
  return (idx > 0 ? f.title.slice(0, idx) : f.title).trim();
}

/** Nombre corto de una regla Semgrep: "python.flask.security.x.y" → "y". */
export function shortRule(rule: string): string {
  const parts = rule.split('.');
  return parts[parts.length - 1] || rule;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Versión mínima que corrige todos los CVE del grupo (la mayor de los "fix"). */
function highestFix(fixes: string[]): string | null {
  const all = fixes.flatMap((f) => f.split(',').map((x) => x.trim())).filter(Boolean);
  if (!all.length) return null;
  return all.reduce((best, v) => (compareVersions(v, best) > 0 ? v : best));
}

export interface FindingGroup {
  key: string;
  engine: Finding['engine'];
  kind: 'package' | 'rule';
  label: string;
  sublabel: string;
  repositoryName: string;
  files: string[];
  findings: Finding[];
  maxSeverity: Severity;
  counts: Record<Severity, number>;
  activeCount: number;
  fixVersion: string | null;
  worstSla: SlaState;
}

const SLA_RANK: Record<SlaState, number> = { breached: 0, due: 1, ok: 2, closed: 3 };

export function groupFindings(list: Finding[], now = Date.now()): FindingGroup[] {
  const map = new Map<string, FindingGroup & { _fixes: string[] }>();

  for (const f of list) {
    const repo = f.repository_name || f.repository_id;
    const pkg = packageOf(f);
    const rule = ruleOf(f);
    const key = pkg ? `trivy:${repo}:${pkg.name}@${pkg.version}` : `${f.engine}:${repo}:${rule}`;

    let g = map.get(key);
    if (!g) {
      const message = f.title.slice(rule.length + 1).trim();
      g = {
        key,
        engine: f.engine,
        kind: pkg ? 'package' : 'rule',
        label: pkg ? `${pkg.name} ${pkg.version}` : f.engine === 'semgrep' ? shortRule(rule) : rule,
        sublabel: pkg ? 'Dependencia vulnerable' : message || rule,
        repositoryName: repo,
        files: [],
        findings: [],
        maxSeverity: f.severity,
        counts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
        activeCount: 0,
        fixVersion: null,
        worstSla: 'closed',
        _fixes: [],
      };
      map.set(key, g);
    }

    g.findings.push(f);
    g.counts[f.severity] = (g.counts[f.severity] ?? 0) + 1;
    if (SEVERITY_RANK[f.severity] < SEVERITY_RANK[g.maxSeverity]) g.maxSeverity = f.severity;
    if (isActive(f)) g.activeCount += 1;
    const location = f.file_path ? `${f.file_path}${f.line_number ? `:${f.line_number}` : ''}` : '';
    if (location && !g.files.includes(location)) g.files.push(location);
    if (pkg?.fix) g._fixes.push(pkg.fix);
    const sla = slaState(f, now);
    if (SLA_RANK[sla] < SLA_RANK[g.worstSla]) g.worstSla = sla;
  }

  return [...map.values()]
    .map(({ _fixes, ...g }) => ({ ...g, fixVersion: highestFix(_fixes) }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.maxSeverity] - SEVERITY_RANK[b.maxSeverity] ||
        b.findings.length - a.findings.length ||
        a.label.localeCompare(b.label),
    );
}

/** Puntaje de riesgo ponderado (crítico pesa más), usado en rankings. */
export function riskScore(counts: Partial<Record<Severity, number>>): number {
  return (counts.CRITICAL ?? 0) * 10 + (counts.HIGH ?? 0) * 5 + (counts.MEDIUM ?? 0) * 2 + (counts.LOW ?? 0);
}
