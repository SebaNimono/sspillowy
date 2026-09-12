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

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`Error de API (${res.status})`);
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

export async function loginWithPassword(email: string, password: string): Promise<PasswordAuthResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
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
}): Promise<PillowChatResult> {
  const res = await fetch(`${API_BASE}/pillow/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_key: adminKey, target_user_key: targetUserKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Error de API (${res.status})`;
    throw new Error(detail);
  }
  return data as { ok: boolean; message: string; credits_remaining: number };
}
