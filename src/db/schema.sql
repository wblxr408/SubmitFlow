-- ============================================================
-- SubmitFlow PostgreSQL 数据库 schema
-- 所有表 + 索引
-- 规范：profile_id = 1 为默认单实例用户
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 枚举类型
DO $$ BEGIN
  CREATE TYPE application_status AS ENUM (
    'screening', 'written_test', 'interview', 'offer', 'rejected', 'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE entry_type AS ENUM (
    'official', 'public_referral', 'private_referral', 'internal'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE source_type AS ENUM (
    'public', 'public_referral', 'private_import', 'auth_required'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE crawl_status AS ENUM (
    'pending', 'running', 'completed', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE parse_status AS ENUM (
    'pending', 'processed', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE parse_resolution AS ENUM (
    'auto_updated', 'pending', 'ignored'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM (
    'active', 'reauth_required', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM (
    'feishu', 'email'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM (
    'active', 'inactive'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id BIGSERIAL PRIMARY KEY,
  school VARCHAR(255),
  major VARCHAR(255),
  graduation_year INT,
  target_cities TEXT[] DEFAULT '{}',
  internship_types TEXT[] DEFAULT '{}',
  mode VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- tags (must be before user_tag_prefs)
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  group_name VARCHAR(100),
  color_hex VARCHAR(7) DEFAULT '#6b7280',
  is_preset BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- user_tag_prefs
-- ============================================================
CREATE TABLE IF NOT EXISTS user_tag_prefs (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  weight NUMERIC(5, 3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, tag_id)
);

-- ============================================================
-- user_ranking_prefs
-- ============================================================
CREATE TABLE IF NOT EXISTS user_ranking_prefs (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  fame_weight NUMERIC(4, 3) NOT NULL DEFAULT 0.2,
  match_weight NUMERIC(4, 3) NOT NULL DEFAULT 0.2,
  city_weight NUMERIC(4, 3) NOT NULL DEFAULT 0.2,
  deadline_weight NUMERIC(4, 3) NOT NULL DEFAULT 0.2,
  conversion_weight NUMERIC(4, 3) NOT NULL DEFAULT 0.2,
  preset_name VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- graph_nodes
-- ============================================================
CREATE TABLE IF NOT EXISTS graph_nodes (
  id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT REFERENCES graph_nodes(id) ON DELETE SET NULL,
  level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 3),
  label VARCHAR(200) NOT NULL,
  tag_id BIGINT REFERENCES tags(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- companies
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  alias_names TEXT[] DEFAULT '{}',
  brand_names TEXT[] DEFAULT '{}',
  parent_company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  fame_score NUMERIC(5, 2) NOT NULL DEFAULT 50,
  size VARCHAR(50),
  industry VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  direction VARCHAR(100),
  jd_text TEXT,
  city VARCHAR(100),
  is_remote BOOLEAN NOT NULL DEFAULT FALSE,
  internship_type VARCHAR(50),
  deadline DATE,
  conversion_rate NUMERIC(5, 2),
  status VARCHAR(20) NOT NULL DEFAULT 'valid',
  canonical_source VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- job_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS job_tags (
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  source VARCHAR(20) NOT NULL DEFAULT 'ai',
  PRIMARY KEY (job_id, tag_id)
);

-- ============================================================
-- job_entrypoints
-- ============================================================
CREATE TABLE IF NOT EXISTS job_entrypoints (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  entry_type VARCHAR(30) NOT NULL,
  entry_url TEXT NOT NULL,
  visibility VARCHAR(10) NOT NULL DEFAULT 'public',
  requires_auth BOOLEAN NOT NULL DEFAULT FALSE,
  referrer_name VARCHAR(255),
  owner_user_id BIGINT,
  source_name VARCHAR(100),
  source_job_id VARCHAR(100),
  valid_until TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- job_sources
-- ============================================================
CREATE TABLE IF NOT EXISTS job_sources (
  id BIGSERIAL PRIMARY KEY,
  source_name VARCHAR(100) NOT NULL UNIQUE,
  source_type VARCHAR(30) NOT NULL,
  industry_scope TEXT[] DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 5,
  last_crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- source_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS source_accounts (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_id BIGINT NOT NULL REFERENCES job_sources(id) ON DELETE CASCADE,
  account_label VARCHAR(255),
  auth_payload_encrypted TEXT,
  session_status VARCHAR(30) NOT NULL DEFAULT 'active',
  last_auth_at TIMESTAMPTZ,
  last_valid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, source_id)
);

-- ============================================================
-- crawl_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS crawl_runs (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES job_sources(id) ON DELETE CASCADE,
  run_type VARCHAR(20) NOT NULL DEFAULT 'full',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  stats_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- raw_job_records
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_job_records (
  id BIGSERIAL PRIMARY KEY,
  crawl_run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  source_name VARCHAR(100) NOT NULL,
  source_job_id VARCHAR(100),
  raw_payload JSONB NOT NULL,
  normalized_payload JSONB,
  parse_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- job_canonical_mappings
-- ============================================================
CREATE TABLE IF NOT EXISTS job_canonical_mappings (
  id BIGSERIAL PRIMARY KEY,
  raw_job_record_id BIGINT NOT NULL REFERENCES raw_job_records(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  match_score NUMERIC(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- applications
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  job_entrypoint_id BIGINT REFERENCES job_entrypoints(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'screening',
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, job_id)
);

-- ============================================================
-- application_private_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS application_private_tags (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- application_events
-- ============================================================
CREATE TABLE IF NOT EXISTS application_events (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  source_ref VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- user_email_connections
-- ============================================================
CREATE TABLE IF NOT EXISTS user_email_connections (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL DEFAULT 'gmail',
  auth_payload_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- email_parse_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS email_parse_logs (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id VARCHAR(500) NOT NULL,
  parsed_company VARCHAR(255),
  parsed_role VARCHAR(255),
  parsed_status VARCHAR(30),
  confidence NUMERIC(3, 2),
  matched_application_id BIGINT REFERENCES applications(id) ON DELETE SET NULL,
  resolution VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, message_id)
);

-- ============================================================
-- user_notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS user_notifications (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel VARCHAR(10) NOT NULL,
  config_encrypted TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'inactive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, channel)
);

-- ============================================================
-- ai_providers
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_providers (
  id BIGSERIAL PRIMARY KEY,
  provider_key VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  adapter_type VARCHAR(50) NOT NULL,
  is_system_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ai_model_catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_model_catalog (
  id BIGSERIAL PRIMARY KEY,
  provider_id BIGINT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  model_name VARCHAR(100) NOT NULL,
  supports_chat BOOLEAN NOT NULL DEFAULT TRUE,
  supports_structured_output BOOLEAN NOT NULL DEFAULT FALSE,
  supports_streaming BOOLEAN NOT NULL DEFAULT FALSE,
  supports_vision BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, model_name)
);

-- ============================================================
-- user_ai_provider_configs
-- ============================================================
CREATE TABLE IF NOT EXISTS user_ai_provider_configs (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id BIGINT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  base_url VARCHAR(500),
  api_key_encrypted TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  display_alias VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, provider_id)
);

-- ============================================================
-- user_ai_task_routes
-- ============================================================
CREATE TABLE IF NOT EXISTS user_ai_task_routes (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_type VARCHAR(30) NOT NULL,
  primary_provider_id BIGINT REFERENCES ai_providers(id) ON DELETE SET NULL,
  primary_model_name VARCHAR(100),
  fallback_chain_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, task_type)
);

-- ============================================================
-- ai_request_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_request_logs (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  task_type VARCHAR(30),
  provider_id BIGINT REFERENCES ai_providers(id) ON DELETE SET NULL,
  model_name VARCHAR(100),
  status VARCHAR(10) NOT NULL DEFAULT 'success',
  latency_ms INT,
  token_usage_json JSONB,
  estimated_cost NUMERIC(10, 6),
  error_code VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- agent_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_sessions (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id BIGINT REFERENCES ai_providers(id) ON DELETE SET NULL,
  model_name VARCHAR(100),
  summary TEXT,
  result_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- agent_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_jobs_status_deadline_type ON jobs(status, deadline, internship_type);
CREATE INDEX IF NOT EXISTS idx_jobs_city ON jobs(city);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_last_seen ON jobs(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_tags_job ON job_tags(job_id);
CREATE INDEX IF NOT EXISTS idx_job_tags_tag ON job_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_job_entrypoints_job_visibility ON job_entrypoints(job_id, visibility);
CREATE INDEX IF NOT EXISTS idx_applications_profile_status ON applications(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_profile_job ON applications(profile_id, job_id);
CREATE INDEX IF NOT EXISTS idx_applications_applied ON applications(applied_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_email_parse_profile_message ON email_parse_logs(profile_id, message_id);
CREATE INDEX IF NOT EXISTS idx_email_parse_created ON email_parse_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_accounts_profile ON source_accounts(profile_id, source_id);
CREATE INDEX IF NOT EXISTS idx_source_accounts_session ON source_accounts(session_status);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_profile_created ON ai_request_logs(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_runs_source_created ON crawl_runs(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_companies_alias_names ON companies USING GIN(alias_names);
CREATE INDEX IF NOT EXISTS idx_companies_brand_names ON companies USING GIN(brand_names);
