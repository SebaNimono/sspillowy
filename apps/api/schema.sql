-- SSPILLOWY · esquema inicial (Supabase SQL Editor)
-- Ejecutar una vez en: SQL → New query → Run
-- Las tablas también se crean solas con Base.metadata.create_all al arrancar la API.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  provider TEXT NOT NULL,
  provider_subject TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users (provider);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  branch TEXT DEFAULT 'main',
  is_active BOOLEAN DEFAULT TRUE,
  health_score INTEGER DEFAULT 100,
  open_criticals INTEGER DEFAULT 0,
  open_highs INTEGER DEFAULT 0,
  total_findings INTEGER DEFAULT 0,
  last_scan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  owner_user_id TEXT REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
  status TEXT DEFAULT 'RUNNING',
  triggered_by TEXT DEFAULT 'web_hub',
  branch TEXT DEFAULT 'main',
  total_findings INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  low_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
  scan_id TEXT NOT NULL REFERENCES scans (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  engine TEXT NOT NULL,
  severity TEXT NOT NULL,
  file_path TEXT,
  line_number INTEGER,
  cwe TEXT,
  owasp_category TEXT,
  iso_control TEXT,
  status TEXT DEFAULT 'OPEN',
  ai_triaged BOOLEAN DEFAULT FALSE,
  ai_confidence DOUBLE PRECISION,
  ai_summary TEXT,
  ai_remediation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_gates (
  id TEXT PRIMARY KEY DEFAULT 'default-policy',
  name TEXT DEFAULT 'Default Organization Security Gate',
  max_critical_allowed INTEGER DEFAULT 0,
  max_high_allowed INTEGER DEFAULT 0,
  block_on_secrets BOOLEAN DEFAULT TRUE,
  require_ciso_approval_for_bypass BOOLEAN DEFAULT TRUE,
  enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  actor_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO security_gates (id)
VALUES ('default-policy')
ON CONFLICT (id) DO NOTHING;
