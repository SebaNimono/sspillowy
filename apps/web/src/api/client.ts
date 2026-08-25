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

const API_BASE = '/api/v1';

export async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Error al cargar estadísticas');
  return res.json();
}

export async function fetchRepositories(): Promise<Repository[]> {
  const res = await fetch(`${API_BASE}/repositories`);
  if (!res.ok) throw new Error('Error al cargar repositorios');
  return res.json();
}

export async function createRepository(name: string, url: string, branch: string): Promise<Repository> {
  const res = await fetch(`${API_BASE}/repositories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url, branch }),
  });
  if (!res.ok) throw new Error('Error al agregar repositorio');
  return res.json();
}

export async function fetchFindings(engine?: string, severity?: string): Promise<Finding[]> {
  const params = new URLSearchParams();
  if (engine) params.append('engine', engine);
  if (severity) params.append('severity', severity);
  
  const res = await fetch(`${API_BASE}/findings?${params.toString()}`);
  if (!res.ok) throw new Error('Error al cargar hallazgos');
  return res.json();
}

export async function triggerScan(repositoryId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repository_id: repositoryId, triggered_by: 'web_hub' }),
  });
  if (!res.ok) throw new Error('Error al iniciar escaneo');
  return res.json();
}

export async function fetchSecurityGate(): Promise<SecurityGatePolicy> {
  const res = await fetch(`${API_BASE}/security-gates`);
  if (!res.ok) throw new Error('Error al cargar políticas');
  return res.json();
}

export async function updateSecurityGate(policy: SecurityGatePolicy): Promise<SecurityGatePolicy> {
  const res = await fetch(`${API_BASE}/security-gates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(policy),
  });
  if (!res.ok) throw new Error('Error al actualizar política');
  return res.json();
}
