export interface Repository {
  id: string;
  name: string;
  url: string;
  branch: string;
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
  status: 'OPEN' | 'IN_REVIEW' | 'ACCEPTED_RISK' | 'FIXED' | 'FALSE_POSITIVE';
  ai_triaged: boolean;
  ai_confidence?: number;
  ai_summary?: string;
  ai_remediation?: string;
  created_at: string;
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

export async function createRepository(name: string, url: string, branch: string): Promise<Repository> {
  return request('/repositories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url, branch }),
  });
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

export async function triggerScan(repositoryId: string): Promise<Scan> {
  return request('/scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repository_id: repositoryId, triggered_by: 'web_hub' }),
  });
}

export async function fetchScans(): Promise<Scan[]> {
  return request('/scans');
}

export async function fetchSecurityGate(): Promise<SecurityGatePolicy> {
  return request('/security-gates');
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
