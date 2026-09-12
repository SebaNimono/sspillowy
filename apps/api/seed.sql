-- SSPILLOWY · seed de datos reales (Supabase SQL Editor)
-- Alternativa: en Railway/local → cd apps/api && python seed_data.py
-- O POST https://api.sspillowy.com/api/v1/admin/seed
--
-- Idempotente (ON CONFLICT DO UPDATE). Ejecutar después de schema.sql.

INSERT INTO security_gates (id, name, max_critical_allowed, max_high_allowed, block_on_secrets, require_ciso_approval_for_bypass, enabled)
VALUES ('default-policy', 'Default Organization Security Gate', 0, 2, TRUE, TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  max_critical_allowed = EXCLUDED.max_critical_allowed,
  max_high_allowed = EXCLUDED.max_high_allowed,
  block_on_secrets = EXCLUDED.block_on_secrets,
  require_ciso_approval_for_bypass = EXCLUDED.require_ciso_approval_for_bypass,
  enabled = EXCLUDED.enabled;

INSERT INTO repositories (id, name, url, branch, is_active, health_score, open_criticals, open_highs, total_findings, last_scan_at, created_at)
VALUES
  ('repo-sspillowy-api', 'sspillowy-backend-api', 'https://github.com/sspillowy/sspillowy-backend', 'main', TRUE, 78, 1, 1, 4, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '14 days'),
  ('repo-payment-gateway', 'payment-gateway-service', 'https://github.com/sspillowy/payment-gateway', 'develop', TRUE, 55, 2, 2, 5, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '21 days'),
  ('repo-auth-identity', 'auth-identity-provider', 'https://github.com/sspillowy/auth-service', 'main', TRUE, 92, 0, 1, 2, NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  health_score = EXCLUDED.health_score,
  open_criticals = EXCLUDED.open_criticals,
  open_highs = EXCLUDED.open_highs,
  total_findings = EXCLUDED.total_findings,
  last_scan_at = EXCLUDED.last_scan_at;

INSERT INTO scans (id, repository_id, status, triggered_by, branch, total_findings, critical_count, high_count, medium_count, low_count, created_at, completed_at)
VALUES
  ('scan-api-001', 'repo-sspillowy-api', 'COMPLETED', 'webhook', 'main', 4, 1, 1, 1, 1, NOW() - INTERVAL '7 hours', NOW() - INTERVAL '6 hours'),
  ('scan-pay-001', 'repo-payment-gateway', 'COMPLETED', 'web_hub', 'develop', 5, 2, 2, 1, 0, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours'),
  ('scan-auth-001', 'repo-auth-identity', 'COMPLETED', 'ci', 'main', 2, 0, 1, 1, 0, NOW() - INTERVAL '26 hours', NOW() - INTERVAL '1 day'),
  ('scan-pay-002', 'repo-payment-gateway', 'COMPLETED', 'web_hub', 'develop', 0, 0, 0, 0, 0, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  total_findings = EXCLUDED.total_findings,
  critical_count = EXCLUDED.critical_count,
  high_count = EXCLUDED.high_count;

-- Hallazgos (subset representativo; el script Python seed_data.py carga el set completo)
INSERT INTO findings (
  id, repository_id, scan_id, title, description, engine, severity, file_path, line_number,
  cwe, owasp_category, iso_control, status, ai_triaged, ai_confidence, ai_summary, ai_remediation, created_at
) VALUES
(
  'find-gitleaks-aws', 'repo-sspillowy-api', 'scan-api-001',
  'Hardcoded AWS Secret Key detected',
  'GitLeaks identificó un token de AWS expuesto en el historial.',
  'gitleaks', 'CRITICAL', 'apps/api/config/aws_client.py', 42,
  'CWE-798', 'A07:2021', 'A.8.5 — Autenticación segura', 'OPEN', TRUE, 0.98,
  'Credencial AWS activa con permisos de lectura en S3.',
  'Revocar la clave en IAM y mover a Secrets Manager.',
  NOW() - INTERVAL '6 hours'
),
(
  'find-semgrep-sqli', 'repo-payment-gateway', 'scan-pay-001',
  'Potential SQL Injection in dynamic query',
  'Semgrep detectó concatenación de parámetros no saneados.',
  'semgrep', 'CRITICAL', 'src/services/user_search.py', 115,
  'CWE-89', 'A03:2021', 'A.8.28 — Codificación segura', 'OPEN', TRUE, 0.94,
  'Parámetro search_query interpolado en SQL.',
  'Usar consultas parametrizadas.',
  NOW() - INTERVAL '3 hours'
),
(
  'find-trivy-runc', 'repo-payment-gateway', 'scan-pay-001',
  'CVE-2024-21626: runc container breakout',
  'Trivy detectó dependencia vulnerable en imagen Docker.',
  'trivy', 'HIGH', 'Dockerfile', 1,
  'CWE-1395', 'A06:2021', 'A.8.8 — Vulnerabilidades técnicas', 'OPEN', TRUE, 0.89,
  'Imagen base con runc vulnerable.',
  'Actualizar a python:3.12-slim.',
  NOW() - INTERVAL '3 hours'
),
(
  'find-semgrep-xss', 'repo-auth-identity', 'scan-auth-001',
  'CWE-79: Reflected XSS in search parameter',
  'Parámetro de búsqueda reflejado sin encode.',
  'semgrep', 'HIGH', 'src/web/admin_search.py', 58,
  'CWE-79', 'A03:2021', 'A.8.28 — Codificación segura', 'OPEN', TRUE, 0.87,
  'Impacto en sesión admin.',
  'Escapar salida HTML.',
  NOW() - INTERVAL '1 day'
),
(
  'find-gitleaks-fixed', 'repo-sspillowy-api', 'scan-api-001',
  'API token in .env.example (historical)',
  'Token de ejemplo ya rotado.',
  'gitleaks', 'HIGH', '.env.example', 12,
  'CWE-798', 'A07:2021', 'A.8.3 — Protección de la información', 'FIXED', TRUE, 0.9,
  'Secreto rotado.',
  'Solo placeholders en git.',
  NOW() - INTERVAL '2 days'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  ai_summary = EXCLUDED.ai_summary,
  severity = EXCLUDED.severity;

INSERT INTO audit_events (id, action, target, detail, actor_email, created_at) VALUES
  ('evt-seed-repo', 'REPO_REGISTERED', 'sspillowy-backend-api', 'Repositorio seed registrado.', 'system@sspillowy.com', NOW() - INTERVAL '14 days'),
  ('evt-seed-scan', 'SCAN_COMPLETED', 'payment-gateway-service', 'Escaneo multi-motor completado.', 'system@sspillowy.com', NOW() - INTERVAL '3 hours'),
  ('evt-seed-gate', 'GATE_EVALUATED', 'Default Organization Security Gate', 'Pipeline bloqueado: critical>0.', 'ci@sspillowy.com', NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;
