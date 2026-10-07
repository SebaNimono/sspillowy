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

export async function fetchStats(): Promise<DashboardStats> {
  return request('/stats');
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

export async function fetchHeatmap(): Promise<HeatmapData> {
  return request('/heatmap');
}

export async function fetchAuditLog(): Promise<AuditEvent[]> {
  return request('/audit-log');
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
