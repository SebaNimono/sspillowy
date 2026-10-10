export interface Repository {
  id: string;
  name: string;
  url: string;
  branch: string;
  dast_url?: string | null;
  is_active: boolean;
  health_score: number;
  open_criticals: number;
  open_highs: number;
  total_findings: number;
  last_scan_at?: string;
  created_at: string;
}

export interface Finding {
  id: string;
  repository_id: string;
  scan_id: string;
  title: string;
  description: string;
  engine: 'semgrep' | 'trivy' | 'gitleaks' | 'owasp_zap';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  file_path?: string;
  line_number?: number;
  cwe?: string;
  owasp_category?: string;
  iso_control?: string;
  status: 'OPEN' | 'IN_REVIEW' | 'ACCEPTED_RISK' | 'FIXED' | 'FALSE_POSITIVE' | 'SUPERSEDED';
  ai_triaged: boolean;
  ai_confidence?: number;
  ai_summary?: string;
  ai_remediation?: string;
  created_at: string;
  first_seen_at?: string | null;
  repository_name?: string | null;
  triggered_by?: string | null;
}

export interface DashboardStats {
  overall_health_score: number;
  monitored_repos: number;
  total_scans_run: number;
  total_open_findings: number;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  low_findings: number;
  secrets_leaked_prevented: number;
  findings_by_engine: Record<string, number>;
  trend_7d?: number[];
}

export interface SecurityGatePolicy {
  id: string;
  name: string;
  max_critical_allowed: number;
  max_high_allowed: number;
  block_on_secrets: boolean;
  require_ciso_approval_for_bypass: boolean;
  enabled: boolean;
}

export interface GateCheckResult {
  allowed: boolean;
  decision: 'PASSED' | 'BLOCKED' | 'DISABLED' | string;
  reasons: string[];
  summary: string;
  open_critical: number;
  open_high: number;
  open_secrets: number;
  max_critical_allowed: number;
  max_high_allowed: number;
  block_on_secrets: boolean;
  require_ciso_approval_for_bypass: boolean;
  policy_name: string;
  policy_id: string;
  repository_id?: string | null;
  repository_name?: string | null;
}

export interface GateBypassRequest {
  id: string;
  repository_id?: string | null;
  repository_name?: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | string;
  requested_by: string;
  decided_by?: string | null;
  decision_note?: string | null;
  expires_at?: string | null;
  created_at: string;
  decided_at?: string | null;
}

export interface Scan {
  id: string;
  repository_id: string;
  status: string;
  triggered_by: string;
  branch: string;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  gate_status?: string | null;
  gate_detail?: string | null;
  progress_stage?: string | null;
  progress_detail?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface HeatmapCell {
  date: string;
  count: number;
  level: number;
}

export interface HeatmapData {
  cells: HeatmapCell[];
  max_count: number;
  total_findings_period: number;
  weeks: number;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  type: 'SECRET_LEAK' | 'CRITICAL_FINDING' | 'GATE_BLOCK' | 'SCAN_COMPLETED' | 'PULSE_BYPASS' | 'AI_TRIAGE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  message: string;
  repository_id?: string;
  finding_id?: string;
  read: boolean;
  created_at: string;
}

export interface IsoControl {
  code: string;
  title: string;
  status: string;
  related_engine?: string | null;
  open_findings: number;
  reason?: string | null;
}

export interface ComplianceReport {
  standard: string;
  period: string;
  health_score: number;
  controls: IsoControl[];
  generated_at: string;
  evidence_pack_ready: boolean;
}

/** Vacío en local (Vite proxy). En Vercel: VITE_API_URL = URL pública de Railway. */
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = `${API_ORIGIN}/api/v1`;

const SESSION_STORAGE_KEY = 'sspillowy_session';
const USER_STORAGE_KEY = 'sspillowy_user';
const REMEMBER_KEY = 'sspillowy_remember';
const LAST_EMAIL_KEY = 'sspillowy_last_email';

/** Evento global cuando la API rechaza la sesión (expirada o cerrada en otro lado). */
export const SESSION_EXPIRED_EVENT = 'sspillowy:session-expired';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export interface StoredUser {
  email: string;
  name: string;
}

/** "Mantener sesión iniciada": localStorage sobrevive al cierre del navegador; sessionStorage no. */
function readBoth(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function clearBoth(key: string): void {
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getStoredSessionId(): string | null {
  return readBoth(SESSION_STORAGE_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = readBoth(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function storeSession(sessionId: string, user: StoredUser, remember: boolean): void {
  clearStoredSession();
  try {
    const store = remember ? localStorage : sessionStorage;
    store.setItem(SESSION_STORAGE_KEY, sessionId);
    store.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(LAST_EMAIL_KEY, user.email);
  } catch {
    // ignore
  }
}

export function clearStoredSession(): void {
  const previous = getStoredUser();
  if (previous?.email) {
    try {
      localStorage.setItem(LAST_EMAIL_KEY, previous.email);
    } catch {
      // ignore
    }
  }
  clearBoth(SESSION_STORAGE_KEY);
  clearBoth(USER_STORAGE_KEY);
}

export function getRememberPreference(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === '1';
  } catch {
    return false;
  }
}

export function setRememberPreference(remember: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
  } catch {
    // ignore
  }
}

export function getLastEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

export function forgetLastEmail(): void {
  try {
    localStorage.removeItem(LAST_EMAIL_KEY);
  } catch {
    // ignore
  }
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra || {});
  const sid = getStoredSessionId();
  if (sid) headers.set('X-Session-Id', sid);
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = authHeaders(init?.headers);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
  if (!res.ok) {
    let detail = `Error de API (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string') detail = data.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function fetchStats(repositoryIds?: string[]): Promise<DashboardStats> {
  return request(`/stats${repositoryIds?.length ? `?repository_ids=${encodeURIComponent(repositoryIds.join(','))}` : ''}`);
}

export async function fetchRepositories(): Promise<Repository[]> {
  return request('/repositories');
}

export async function createRepository(
  name: string,
  url: string,
  branch: string,
  dastUrl?: string,
): Promise<Repository> {
  return request('/repositories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      url,
      branch,
      dast_url: dastUrl?.trim() || null,
    }),
  });
}

export async function deleteRepository(repositoryId: string): Promise<{ deleted: boolean; id: string; name: string }> {
  return request(`/repositories/${repositoryId}`, { method: 'DELETE' });
}

export async function clearFindings(repositoryId?: string): Promise<{ deleted: number }> {
  const qs = repositoryId ? `?repository_id=${encodeURIComponent(repositoryId)}` : '';
  return request(`/findings${qs}`, { method: 'DELETE' });
}

export async function fetchFindings(engine?: string, severity?: string, statusFilter?: string): Promise<Finding[]> {
  const params = new URLSearchParams();
  if (engine) params.append('engine', engine);
  if (severity) params.append('severity', severity);
  if (statusFilter) params.append('status', statusFilter);
  const qs = params.toString();
  return request(`/findings${qs ? `?${qs}` : ''}`);
}

export async function updateFindingStatus(findingId: string, status: Finding['status'], note?: string): Promise<Finding> {
  return request(`/findings/${findingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note }),
  });
}

export type ScanEngine = 'semgrep' | 'gitleaks' | 'trivy' | 'owasp_zap';

export async function triggerScan(
  repositoryId: string,
  engines: ScanEngine[] = ['semgrep', 'gitleaks', 'trivy'],
  triggeredBy = 'web_hub',
  targetUrl?: string,
): Promise<Scan> {
  return request('/scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repository_id: repositoryId,
      triggered_by: triggeredBy,
      engines,
      ...(targetUrl?.trim() ? { target_url: targetUrl.trim() } : {}),
    }),
  });
}

export async function fetchScans(): Promise<Scan[]> {
  return request('/scans');
}

export async function fetchGithubWebhookInfo(): Promise<{
  endpoint: string;
  events: string[];
  secret_configured: boolean;
  engines: string[];
  instructions: string;
}> {
  return request('/webhooks/github/info');
}

export async function fetchSecurityGate(): Promise<SecurityGatePolicy> {
  return request('/security-gates');
}

export async function checkSecurityGate(repositoryId?: string): Promise<GateCheckResult> {
  const qs = repositoryId ? `?repository_id=${encodeURIComponent(repositoryId)}` : '';
  return request(`/security-gates/check${qs}`);
}

export async function evaluateSecurityGate(repositoryId?: string): Promise<GateCheckResult> {
  const qs = repositoryId ? `?repository_id=${encodeURIComponent(repositoryId)}` : '';
  return request(`/security-gates/evaluate${qs}`, { method: 'POST' });
}

export async function updateSecurityGate(policy: SecurityGatePolicy): Promise<SecurityGatePolicy> {
  return request('/security-gates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(policy),
  });
}

export async function fetchGateBypasses(status?: string): Promise<GateBypassRequest[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/security-gates/bypasses${qs}`);
}

export async function createGateBypass(body: {
  reason: string;
  repository_id?: string | null;
  expires_hours?: number;
}): Promise<GateBypassRequest> {
  return request('/security-gates/bypasses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function approveGateBypass(id: string, note?: string): Promise<GateBypassRequest> {
  return request(`/security-gates/bypasses/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: note || null }),
  });
}

export async function rejectGateBypass(id: string, note?: string): Promise<GateBypassRequest> {
  return request(`/security-gates/bypasses/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: note || null }),
  });
}

export type SecretStep = 'rotated' | 'revoked' | 'history_cleaned' | 'verified';
export type SecretStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'FALSE_POSITIVE';

export interface SecretIncident {
  id: string;
  repository_id: string;
  repository_name: string | null;
  rule_id: string;
  provider: string;
  severity: Finding['severity'];
  file_path: string | null;
  line_number: number | null;
  preview: string | null;
  status: SecretStatus;
  owner_email: string | null;
  notes: string | null;
  steps: Record<SecretStep, { done: boolean; at: string | null; by: string | null }>;
  detected_now: boolean;
  active_findings: number;
  finding_ids: string[];
  first_seen_at: string | null;
  last_seen_at: string | null;
  resolved_at: string | null;
  reopened_count: number;
  updated_at: string | null;
}

export async function fetchSecrets(repositoryId?: string): Promise<SecretIncident[]> {
  const qs = repositoryId ? `?repository_id=${encodeURIComponent(repositoryId)}` : '';
  return request(`/secrets${qs}`);
}

export async function updateSecret(
  id: string,
  body: {
    steps?: Partial<Record<SecretStep, boolean>>;
    owner_email?: string;
    notes?: string;
    status?: 'FALSE_POSITIVE' | 'OPEN';
  },
): Promise<SecretIncident> {
  return request(`/secrets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface SbomComponent {
  id: string;
  repository_id: string;
  repository_name: string | null;
  name: string;
  version: string | null;
  ecosystem: string | null;
  purl: string | null;
  licenses: string | null;
  manifest: string | null;
  direct: boolean | null;
  vulnerabilities: {
    count: number;
    max_severity: Finding['severity'];
    cves: string[];
    fix_version: string | null;
  } | null;
}

export interface SbomChange {
  ecosystem: string;
  name: string;
  version?: string;
  from?: string;
  to?: string;
}

export interface SbomRepository {
  id: string;
  name: string;
  component_count: number;
  vulnerable_count: number;
  ecosystems: Record<string, number>;
  generated_at: string | null;
  changes: { added: SbomChange[]; removed: SbomChange[]; updated: SbomChange[] };
}

export async function fetchSbom(repositoryId?: string): Promise<{ repositories: SbomRepository[]; components: SbomComponent[] }> {
  const qs = repositoryId ? `?repository_id=${encodeURIComponent(repositoryId)}` : '';
  return request(`/sbom${qs}`);
}

export type AiVerdict = 'LIKELY_REAL' | 'NEEDS_REVIEW' | 'LIKELY_FALSE_POSITIVE';

export interface FixIntelReason {
  label: string;
  tone: 'up' | 'down' | 'neutral';
  delta: number;
}

export interface FixIntelItem {
  id: string;
  repository_id: string;
  repository_name: string;
  engine: string;
  severity: string;
  title: string;
  description: string;
  file_path: string | null;
  line_number: number | null;
  cwe: string | null;
  owasp_category: string | null;
  status: string;
  score: number;
  reasons: FixIntelReason[];
  package: string | null;
  version: string | null;
  fix_version: string | null;
  fix_hint: string;
  effort: 'Bajo' | 'Medio' | 'Alto';
  ai_verdict: AiVerdict | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_remediation: string | null;
  ai_triaged_at: string | null;
  ai_feedback: 'ACCEPTED' | 'DISMISSED' | null;
  created_at: string | null;
}

export interface FixIntelKpis {
  active: number;
  triaged: number;
  likely_real: number;
  needs_review: number;
  likely_false_positive: number;
  quick_wins: number;
  urgent: number;
  ai_accepted: number;
  ai_dismissed: number;
  ai_acceptance_rate: number | null;
}

export interface FixIntelQueue {
  kpis: FixIntelKpis;
  items: FixIntelItem[];
  repositories: { id: string; name: string }[];
  max_batch: number;
}

export interface VelocityFlow {
  introduced: number;
  fixed: number;
  regressions: number;
  mttr_days: number | null;
  median_days: number | null;
  sla_met_pct: number | null;
}

export interface VelocityData {
  range_days: number;
  generated_at: string;
  has_history: boolean;
  kpis: VelocityFlow & {
    open: number;
    overdue: number;
    median_open_age_days: number | null;
    decided: number;
    scans: number;
    scans_per_week: number;
    scan_minutes: number | null;
    gate: { passed: number; blocked: number; bypassed: number; skipped: number; pass_rate: number | null };
    bypass_requests: number;
    bypass_approved: number;
  };
  previous: VelocityFlow & { scans: number; gate_pass_rate: number | null };
  series: { week_start: string; label: string; introduced: number; fixed: number; backlog: number; mttr_days: number | null }[];
  by_severity: {
    severity: Finding['severity'];
    sla_days: number;
    mttr_days: number | null;
    fixed: number;
    sla_met_pct: number | null;
    open: number;
    overdue: number;
  }[];
  by_engine: { engine: string; introduced: number; fixed: number; mttr_days: number | null; open: number }[];
  repositories: {
    id: string;
    name: string;
    open: number;
    overdue: number;
    introduced: number;
    fixed: number;
    net: number;
    mttr_days: number | null;
    sla_met_pct: number | null;
    scans: number;
    gate_pass_rate: number | null;
    last_scan_at: string | null;
  }[];
  oldest_open: { title: string; severity: Finding['severity']; engine: string; repository: string; age_days: number; sla_days: number }[];
}

export type RunbookTrigger = 'SECRET_DETECTED' | 'NEW_FINDING' | 'GATE_BLOCKED' | 'SLA_BREACHED' | 'SCAN_FAILED';

export type RunbookAction =
  | { type: 'email'; to: string[]; security_team: boolean }
  | { type: 'webhook'; url: string; kind: 'slack' | 'teams' | 'generic' }
  | { type: 'assign_owner'; email: string }
  | { type: 'set_in_review' }
  | { type: 'rescan' };

export interface RunbookInput {
  name: string;
  description?: string;
  enabled: boolean;
  trigger: RunbookTrigger;
  conditions: { repository_ids: string[]; min_severity: Finding['severity'] };
  actions: RunbookAction[];
  template?: string | null;
}

export interface Runbook extends RunbookInput {
  id: string;
  description: string;
  repository_names: string[];
  owner_email: string | null;
  run_count: number;
  last_run_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RunbookList {
  runbooks: Runbook[];
  email_ready: boolean;
  security_team: string[];
}

export interface RunbookExecution {
  id: string;
  runbook_id: string;
  runbook_name: string;
  trigger: RunbookTrigger;
  repository_id: string | null;
  repository_name: string | null;
  scan_id: string | null;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SIMULATED';
  summary: string;
  results: { type: RunbookAction['type']; label: string; ok: boolean; message: string }[];
  actor: string | null;
  created_at: string | null;
}

export async function fetchRunbooks(): Promise<RunbookList> {
  return request('/runbooks');
}

export async function createRunbook(body: RunbookInput): Promise<Runbook> {
  return request('/runbooks', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateRunbook(id: string, body: RunbookInput): Promise<Runbook> {
  return request(`/runbooks/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function setRunbookEnabled(id: string, enabled: boolean): Promise<Runbook> {
  return request(`/runbooks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
}

export async function deleteRunbook(id: string): Promise<void> {
  await request(`/runbooks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function testRunbook(
  id: string,
  repositoryId?: string,
): Promise<{ matched: boolean; reason: string; execution: RunbookExecution | null }> {
  return request(`/runbooks/${encodeURIComponent(id)}/test`, {
    method: 'POST',
    body: JSON.stringify({ repository_id: repositoryId || null }),
  });
}

export async function fetchRunbookExecutions(runbookId?: string): Promise<RunbookExecution[]> {
  const qs = runbookId ? `?runbook_id=${encodeURIComponent(runbookId)}` : '';
  return request(`/runbooks/executions${qs}`);
}

export async function fetchVelocity(rangeDays: number, repositoryIds?: string[]): Promise<VelocityData> {
  const params = new URLSearchParams({ range_days: String(rangeDays) });
  if (repositoryIds?.length) params.set('repository_ids', repositoryIds.join(','));
  return request(`/velocity?${params.toString()}`);
}

export type ExecTone = 'good' | 'warn' | 'bad' | 'neutral' | 'info';

export interface ExecGrade {
  letter: string;
  label: string;
  tone: ExecTone;
}

export interface ExecCompare {
  now: number | null;
  before: number | null;
}

export interface ExecutiveData {
  range_days: number;
  generated_at: string;
  period_start: string;
  period_end: string;
  scope: { repositories: number; filtered: boolean };
  status: ExecTone;
  posture: { score: number | null; score_start: number | null; grade: ExecGrade };
  highlights: { tone: ExecTone; text: string }[];
  kpis: {
    exposure: ExecCompare & { critical: number; high: number };
    overdue: ExecCompare;
    mttr_days: ExecCompare;
    sla_met_pct: ExecCompare;
    gate_pass_rate: ExecCompare;
  };
  series: { date: string; label: string; score: number | null }[];
  top_risks: {
    category: string;
    title: string;
    repository: string;
    severity: Finding['severity'];
    count: number;
    critical: number;
    high: number;
    overdue: number;
    oldest_days: number;
    impact: string;
    action: string;
    tab: string;
  }[];
  decisions: { kind: string; tone: ExecTone; title: string; detail: string; tab: string }[];
  wins: { value: number; label: string; detail: string | null }[];
  repositories: {
    id: string;
    name: string;
    score: number;
    score_start: number | null;
    grade: ExecGrade;
    critical: number;
    high: number;
    overdue: number;
    last_scan_at: string | null;
  }[];
  compliance: {
    period: string;
    frameworks: { id: string; short: string; name: string; score: number; compliant: number; total: number }[];
    gaps: { id: string; name: string; status: 'GAP' | 'PENDING'; reason: string; frameworks: string[] }[];
  };
}

export async function fetchExecutive(rangeDays: number, repositoryIds?: string[]): Promise<ExecutiveData> {
  const params = new URLSearchParams({ range_days: String(rangeDays) });
  if (repositoryIds?.length) params.set('repository_ids', repositoryIds.join(','));
  return request(`/executive?${params.toString()}`);
}

export async function fetchFixIntel(repositoryId?: string): Promise<FixIntelQueue> {
  const qs = repositoryId ? `?repository_id=${encodeURIComponent(repositoryId)}` : '';
  return request(`/fix-intel${qs}`);
}

export async function triageFindings(
  findingIds: string[],
): Promise<{ items: FixIntelItem[]; credits_remaining: number; daily_limit: number }> {
  return request('/fix-intel/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finding_ids: findingIds }),
  });
}

export async function decideFixIntel(findingId: string, decision: 'accept' | 'dismiss'): Promise<FixIntelItem> {
  return request(`/fix-intel/${findingId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
}

export async function downloadCycloneDx(repositoryId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/sbom/${repositoryId}/cyclonedx`, { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`);
  }
  return res.blob();
}

const scopeQuery = (repositoryIds?: string[]) =>
  repositoryIds?.length ? `?repository_ids=${encodeURIComponent(repositoryIds.join(','))}` : '';

export async function fetchHeatmap(repositoryIds?: string[]): Promise<HeatmapData> {
  return request(`/heatmap${scopeQuery(repositoryIds)}`);
}

export async function fetchAuditLog(repositoryIds?: string[]): Promise<AuditEvent[]> {
  return request(`/audit-log${scopeQuery(repositoryIds)}`);
}

export interface DashboardViewConfig {
  widgets: Record<string, boolean>;
  thresholds: { critical_max: number; high_max: number; open_max: number; health_min: number };
}

export interface DashboardView {
  id: string;
  name: string;
  description: string;
  repository_ids: string[];
  repository_names: string[];
  range_days: 7 | 30 | 90;
  config: DashboardViewConfig | null;
  pillow_widgets: { id: string; type: string; title: string; metric?: string; createdAt: string }[];
  owner_email: string | null;
  shared: boolean;
  starred: boolean;
  star_count: number;
  can_edit: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export type DashboardViewInput = Partial<
  Pick<DashboardView, 'name' | 'description' | 'repository_ids' | 'range_days' | 'config' | 'pillow_widgets' | 'shared'>
>;

export async function fetchDashboardViews(): Promise<DashboardView[]> {
  return request('/dashboards');
}

export async function createDashboardView(body: DashboardViewInput): Promise<DashboardView> {
  return request('/dashboards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateDashboardView(id: string, body: DashboardViewInput): Promise<DashboardView> {
  return request(`/dashboards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function toggleDashboardStar(id: string): Promise<DashboardView> {
  return request(`/dashboards/${id}/star`, { method: 'POST' });
}

export async function duplicateDashboardView(id: string): Promise<DashboardView> {
  return request(`/dashboards/${id}/duplicate`, { method: 'POST' });
}

export async function deleteDashboardView(id: string): Promise<{ ok: boolean }> {
  return request(`/dashboards/${id}`, { method: 'DELETE' });
}

export async function fetchNotifications(unreadOnly = false): Promise<NotificationItem[]> {
  return request(`/notifications${unreadOnly ? '?unread_only=true' : ''}`);
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  return request(`/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  return request('/notifications/read-all', { method: 'POST' });
}

export type ObsRange = '24h' | '7d' | '30d';
export type ObsComponentStatus = 'up' | 'degraded' | 'down' | 'unconfigured';

export interface ObsSlo {
  id: string;
  name: string;
  description: string;
  target: number;
  value: number | null;
  total: number;
  bad: number;
  budget_remaining: number | null;
  status: 'ok' | 'at_risk' | 'breached' | 'no_data';
}

export interface ObservabilityData {
  range: ObsRange;
  generated_at: string;
  status: 'operational' | 'degraded' | 'down';
  uptime_seconds: number;
  components: { id: string; name: string; status: ObsComponentStatus; detail: string; since?: string; last?: string | null }[];
  slos: ObsSlo[];
  kpis: {
    requests: number;
    error_pct: number | null;
    p95_ms: number | null;
    avg_ms: number | null;
    scans: number;
    scan_success_pct: number | null;
    scan_median_minutes: number | null;
    clone_avg_s: number | null;
    running: number;
  };
  series: {
    t: string;
    requests: number;
    errors: number;
    p95_ms: number | null;
    scans_ok: number;
    scans_failed: number;
    scan_minutes: number | null;
  }[];
  engines: {
    id: string;
    name: string;
    available: boolean;
    mode: string;
    runs: number;
    failures: number;
    success_pct: number | null;
    avg_s: number | null;
    p95_s: number | null;
    last_run: string | null;
  }[];
  routes: { method: string; path: string; count: number; error_pct: number; client_error_pct: number; avg_ms: number | null; p95_ms: number | null }[];
  incidents: { at: string; severity: 'error' | 'warning'; title: string; target: string | null; detail: string }[];
  integrations: { prometheus: boolean; metrics_url: string; grafana_url: string | null };
}

export async function fetchObservability(range: ObsRange): Promise<ObservabilityData> {
  return request(`/observability?range=${range}`);
}

/** Hallazgo que otra página pide abrir en Trazabilidad (id de fila o clave de historia). */
export const TRACE_REF_KEY = 'sspillowy_trace_ref';

export type TraceStatus = 'OPEN' | 'IN_REVIEW' | 'FIXED' | 'FALSE_POSITIVE' | 'ACCEPTED_RISK';

export interface TraceCommit {
  sha: string;
  short: string;
  message: string | null;
  author: string | null;
  url: string | null;
}

export interface TraceIssue {
  key: string;
  title: string;
  engine: string;
  engine_label: string;
  severity: string;
  file_path: string | null;
  line: number | null;
  cwe: string | null;
  repository_id: string;
  repository_name: string;
  status: TraceStatus;
  status_label: string;
  first_seen: string | null;
  last_seen: string | null;
  closed_at: string | null;
  last_activity: string | null;
  detections: number;
  regressions: number;
  finding_id: string | null;
  sla: { days: number; due_at: string | null; met: boolean | null; overdue: boolean };
}

export interface TraceIssueList {
  total: number;
  counts: { open: number; fixed: number; decided: number; all: number; overdue: number };
  items: TraceIssue[];
  repositories: { id: string; name: string }[];
}

export type TraceEventType =
  | 'DETECTED'
  | 'REAPPEARED'
  | 'SEEN'
  | 'SEVERITY_CHANGED'
  | 'FIXED'
  | 'STATUS'
  | 'PILLOW'
  | 'PILLOW_DECISION'
  | 'BYPASS_REQUESTED'
  | 'BYPASS_DECIDED'
  | 'SECRET'
  | 'RUNBOOK'
  | 'SLA';

export interface TraceEvent {
  at: string | null;
  type: TraceEventType;
  title: string;
  detail: string | null;
  actor: string | null;
  actor_label: string | null;
  person: boolean;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
  severity?: string;
  scan?: { id: string; branch: string | null; triggered_by: string; gate: string | null; commit: TraceCommit | null } | null;
}

export interface TraceDetail {
  summary: TraceIssue & {
    description: string | null;
    owasp_category?: string | null;
    introduced_in: TraceCommit | null;
    fixed_in: TraceCommit | null;
    file_url: string | null;
    time_to_fix_days: number | null;
    open_days: number | null;
    people: string[];
    repository_url: string | null;
  };
  timeline: TraceEvent[];
}

export interface TraceIssueFilters {
  q?: string;
  repository_id?: string;
  status?: 'all' | 'open' | 'fixed' | 'decided';
  severity?: string;
  engine?: string;
  person?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AuditTrailEvent {
  id: string;
  at: string | null;
  action: string;
  label: string;
  category: string;
  category_label: string;
  actor: string | null;
  actor_label: string;
  person: boolean;
  target: string | null;
  detail: string | null;
  finding_key: string | null;
}

export interface AuditTrail {
  total: number;
  items: AuditTrailEvent[];
  actors: { actor: string; label: string; count: number; person: boolean }[];
  categories: { id: string; label: string; count: number }[];
  repositories: string[];
}

export interface AuditTrailFilters {
  q?: string;
  actor?: string;
  category?: string;
  repository?: string;
  people_only?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === false) return;
    qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function fetchTraceIssues(filters: TraceIssueFilters): Promise<TraceIssueList> {
  return request(`/traceability/findings${toQuery(filters)}`);
}

export async function fetchTraceDetail(ref: string): Promise<TraceDetail> {
  return request(`/traceability/findings/${encodeURIComponent(ref)}`);
}

export async function fetchTraceEvidence(ref: string): Promise<Record<string, unknown>> {
  return request(`/traceability/findings/${encodeURIComponent(ref)}/evidence`);
}

export async function fetchAuditTrail(filters: AuditTrailFilters): Promise<AuditTrail> {
  return request(`/traceability/events${toQuery(filters)}`);
}

export type ComplianceStatus = 'COMPLIANT' | 'PARTIAL' | 'GAP' | 'PENDING' | 'NOT_APPLICABLE';

export interface ComplianceRequirement {
  id: string;
  title: string;
  group: string;
  controls: string[];
  status: ComplianceStatus;
  reason: string;
  findings: number | null;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  short: string;
  category: string;
  description: string;
  enabled: boolean;
  score: number;
  counts: Record<ComplianceStatus, number>;
  total: number;
  requirements: ComplianceRequirement[];
  trend: { day: string; score: number }[];
}

export interface ComplianceControl {
  id: string;
  name: string;
  domain: string;
  type: 'auto' | 'manual';
  description: string;
  guidance: string | null;
  status: ComplianceStatus;
  reason: string;
  evidence: { label: string; value: string }[];
  owner_email: string | null;
  note: string | null;
  evidence_url: string | null;
  attested_by: string | null;
  attested_at: string | null;
  expires_at: string | null;
  not_applicable: boolean;
  na_reason: string | null;
  updated_by: string | null;
  updated_at: string | null;
  mappings: { framework_id: string; short: string; enabled: boolean; requirements: string[] }[];
}

export interface ComplianceOverview {
  generated_at: string;
  period: string;
  domains: { id: string; name: string }[];
  frameworks: ComplianceFramework[];
  controls: ComplianceControl[];
  summary: { controls: number; passing: number; failing: number; partial: number; pending: number; not_applicable: number };
}

export interface ComplianceControlPatch {
  owner_email?: string | null;
  note?: string | null;
  evidence_url?: string | null;
  attest?: boolean;
  not_applicable?: boolean;
  na_reason?: string | null;
}

export async function fetchCompliance(): Promise<ComplianceOverview> {
  return request('/compliance');
}

export async function setComplianceFramework(id: string, enabled: boolean): Promise<ComplianceOverview> {
  return request(`/compliance/frameworks/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
}

export async function updateComplianceControl(id: string, body: ComplianceControlPatch): Promise<ComplianceOverview> {
  return request(`/compliance/controls/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function fetchComplianceEvidence(id: string): Promise<Record<string, unknown>> {
  return request(`/compliance/frameworks/${encodeURIComponent(id)}/evidence`);
}

export async function fetchComplianceReport(): Promise<ComplianceReport> {
  return request('/compliance/iso27001');
}

export interface AuthSession {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  provider: string;
  expires_at?: string;
}

export async function logoutSession(): Promise<void> {
  const sid = getStoredSessionId();
  if (!sid) return;
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { 'X-Session-Id': sid } }).catch(() => undefined);
}

export async function fetchAuthProviders(): Promise<{
  github: boolean;
  gitlab: boolean;
  google: boolean;
  microsoft: boolean;
}> {
  return request('/auth/providers');
}

export async function fetchAuthSession(sessionId: string): Promise<AuthSession> {
  return request(`/auth/session/${sessionId}`);
}

export interface PasswordAuthResult {
  session_id: string;
  email: string;
  name: string;
  provider: string;
  user_id?: string;
}

export interface RegisterResult {
  requires_verification: boolean;
  email: string;
  message: string;
  email_sent?: boolean;
  session_id?: string;
  name?: string;
  provider?: string;
  user_id?: string;
}

async function passwordAuthRequest(path: string, body: object): Promise<RegisterResult> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as RegisterResult;
}

export async function registerWithPassword(
  email: string,
  password: string,
  name?: string,
): Promise<RegisterResult> {
  return passwordAuthRequest('/auth/register', { email, password, name: name || undefined });
}

export async function loginWithPassword(email: string, password: string, remember = false): Promise<PasswordAuthResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, remember }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as PasswordAuthResult;
}

export async function resendVerificationEmail(email: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as { ok: boolean; message: string };
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as { ok: boolean; message: string };
}

export async function validatePasswordResetToken(token: string): Promise<{ ok: boolean; email: string }> {
  const res = await fetch(`${API_BASE}/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as { ok: boolean; email: string };
}

export async function resetPassword(token: string, password: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as { ok: boolean; message: string };
}

export interface PillowQuota {
  configured: boolean;
  daily_limit: number;
  credits_used: number;
  credits_remaining: number;
  resets_at: string;
}

export interface PillowWidgetSuggestion {
  type: string;
  title: string;
  metric?: string | null;
}

export interface PillowChatResult {
  reply: string;
  suggested_widgets: PillowWidgetSuggestion[];
  credits_remaining: number;
  daily_limit: number;
}

export async function fetchPillowQuota(userKey: string): Promise<PillowQuota> {
  const res = await fetch(`${API_BASE}/pillow/quota?user_key=${encodeURIComponent(userKey)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as PillowQuota;
}

export async function sendPillowMessage(body: {
  message: string;
  user_key: string;
  dashboard_context?: Record<string, unknown>;
  page?: string;
  page_context?: Record<string, unknown>;
  history?: { role: 'user' | 'pillow'; text: string }[];
}): Promise<PillowChatResult> {
  const res = await fetch(`${API_BASE}/pillow/chat`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as PillowChatResult;
}

export interface PillowAdminStatus {
  is_admin: boolean;
}

export interface PillowUsageRow {
  user_key: string;
  credits_used: number;
  daily_limit: number;
  usage_date: string;
}

export async function fetchPillowAdminStatus(userKey: string): Promise<PillowAdminStatus> {
  const res = await fetch(`${API_BASE}/pillow/admin/status?user_key=${encodeURIComponent(userKey)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as PillowAdminStatus;
}

export async function fetchPillowAdminUsage(adminKey: string): Promise<{ usage: PillowUsageRow[] }> {
  const res = await fetch(`${API_BASE}/pillow/admin/usage?admin_key=${encodeURIComponent(adminKey)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as { usage: PillowUsageRow[] };
}

export async function resetPillowCredits(
  adminKey: string,
  targetUserKey: string,
): Promise<{ ok: boolean; message: string; credits_remaining: number }> {
  const res = await fetch(`${API_BASE}/pillow/admin/reset-credits`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ admin_key: adminKey, target_user_key: targetUserKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as { ok: boolean; message: string; credits_remaining: number };
}
