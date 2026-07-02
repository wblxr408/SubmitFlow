-- ============================================================
-- Migration 022: AI Agent Session Tables
--
-- Required by: src/app/api/match/session/route.ts
-- Stores conversational AI agent sessions and messages for
-- user profiling via natural language dialogue.
-- ============================================================

-- 先删除旧表（确保干净重建）
DROP TABLE IF EXISTS agent_messages CASCADE;
DROP TABLE IF EXISTS agent_sessions CASCADE;

CREATE TABLE IF NOT EXISTS agent_sessions (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id VARCHAR(50),
  model_name VARCHAR(100),
  summary TEXT,
  result_json JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_profile ON agent_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_created ON agent_sessions(created_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model_name VARCHAR(100),
  tokens_used INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages(created_at);

COMMENT ON TABLE agent_sessions IS 'AI agent conversational sessions for user profiling';
COMMENT ON TABLE agent_messages IS 'Individual messages within an AI agent session';
