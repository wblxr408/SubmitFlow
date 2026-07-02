-- ============================================================
-- v1.7 Profiling Compatibility Layer
--
-- Maps the profiling/index.ts service layer to actual v1.6 schema.
--
-- profiling/index.ts references:
--   user_behavior_events       → profile_behavior_events (v1.6)
--   user_sessions             → profile_sessions (v1.6)
--   user_persona_summary      → NEW STUB TABLE
--   career_intent_classification → profile_intents (v1.6)
--   user_lifecycle_stage      → NEW STUB TABLE
--   job_urgency_score        → NEW STUB TABLE
--   digital_body_language_signals → profile_behavior_events (v1.6, category = 'digital_body_language')
--   behavior_sequence_features → profile_stats_snapshot (v1.6)
--   preference_stability      → DERIVED from profile_preferences
--   user_interest_scores     → EXISTS (v1.4) — keep using it
-- ============================================================

-- 1. user_persona_summary stub (populated by refreshUserPersonaSnapshot)
CREATE TABLE IF NOT EXISTS user_persona_summary (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  persona_version VARCHAR(20) NOT NULL DEFAULT 'v1.6',
  model_version VARCHAR(20),
  primary_intent VARCHAR(50),
  intent_strength NUMERIC(3,2) DEFAULT 0,
  intent_confidence NUMERIC(3,2) DEFAULT 0,
  lifecycle_stage VARCHAR(30),
  lifecycle_days INT DEFAULT 0,
  urgency_level VARCHAR(20),
  urgency_score NUMERIC(3,2) DEFAULT 0,
  engagement_level VARCHAR(20) DEFAULT 'low',
  activity_level VARCHAR(20) DEFAULT 'low',
  job_seeking_maturity VARCHAR(20) DEFAULT 'beginner',
  top_companies JSONB DEFAULT '[]',
  top_positions JSONB DEFAULT '[]',
  top_cities JSONB DEFAULT '[]',
  top_industries JSONB DEFAULT '[]',
  top_skills JSONB DEFAULT '[]',
  top_directions JSONB DEFAULT '[]',
  behavior_stats JSONB DEFAULT '{}',
  sequence_features JSONB DEFAULT '{}',
  dbl_signals_summary JSONB DEFAULT '{}',
  stability_summary JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  features_ttl_hours INT DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_persona_summary_profile ON user_persona_summary(profile_id);

-- 2. career_intent_classification → profile_intents compatibility view
-- Only supports 'timing' and 'application_style' dimensions (matches profiling code usage)
CREATE OR REPLACE VIEW career_intent_classification AS
SELECT
  profile_id,
  (CASE
    WHEN intent_key IN ('immediately', 'within_1month', 'within_3months') THEN 'active_job_seeker'
    WHEN intent_key IN ('exploring', 'passive') THEN 'passive_talent'
    ELSE 'exploratory'
  END)::VARCHAR(50) AS intent_primary,
  intent_key AS intent_secondary,
  intent_score AS intent_strength,
  confidence,
  evidence AS signals,
  evidence_count,
  intent_started_at AS intent_since,
  intent_updated_at AS intent_last_update,
  valid_from,
  valid_until
FROM profile_intents
WHERE intent_dimension IN ('timing', 'application_style');

-- 3. user_lifecycle_stage stub table
CREATE TABLE IF NOT EXISTS user_lifecycle_stage (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stage VARCHAR(30) NOT NULL,  -- 'cold_start','early_exploration','active_browsing','intent_formation','active_application','application_tracking','dormant','churned'
  stage_order INT DEFAULT 0,
  stage_features JSONB DEFAULT '{}',
  stage_metrics JSONB DEFAULT '{}',
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  duration_days NUMERIC(10,2),
  entry_trigger VARCHAR(100),
  exit_trigger VARCHAR(100),
  predicted_next_stage VARCHAR(30),
  predicted_transition_days INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_profile ON user_lifecycle_stage(profile_id, entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_active ON user_lifecycle_stage(profile_id)
  WHERE exited_at IS NULL;

-- 4. job_urgency_score stub table (single row per user)
CREATE TABLE IF NOT EXISTS job_urgency_score (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  urgency_score NUMERIC(3,2) NOT NULL DEFAULT 0,
  urgency_level VARCHAR(20) NOT NULL DEFAULT 'none',
  financial_urgency NUMERIC(3,2) NOT NULL DEFAULT 0,
  career_timing_urgency NUMERIC(3,2) NOT NULL DEFAULT 0,
  notice_period_urgency NUMERIC(3,2) NOT NULL DEFAULT 0,
  market_timing_urgency NUMERIC(3,2) NOT NULL DEFAULT 0,
  urgency_signals JSONB DEFAULT '[]',
  signal_weights JSONB DEFAULT '{}',
  target_start_date TIMESTAMPTZ,
  urgency_since TIMESTAMPTZ,
  expected_action_date TIMESTAMPTZ,
  predicted_transition_date TIMESTAMPTZ,
  prediction_confidence NUMERIC(3,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_urgency_profile ON job_urgency_score(profile_id);

-- 5. behavior_sequence_features compatibility view → profile_stats_snapshot
-- Maps the flat column names used in profiling code to the snapshot table
CREATE OR REPLACE VIEW behavior_sequence_features AS
SELECT
  profile_id,
  'daily'::VARCHAR(20) AS window_type,
  snapshot_date AS window_start,
  snapshot_date AS window_end,
  COALESCE(job_view_count, 0) AS view_count,
  COALESCE(job_detail_view_count, 0) AS detail_view_count,
  COALESCE(search_query_count, 0) AS search_count,
  COALESCE(filter_change_count, 0) AS filter_change_count,
  COALESCE(job_apply_count, 0) AS apply_count,
  COALESCE(job_apply_start_count, 0) AS apply_start_count,
  COALESCE(job_favorite_count, 0) AS favorite_count,
  COALESCE(job_unfavorite_count, 0) AS unfavorite_count,
  COALESCE(job_dismiss_count, 0) AS dismiss_count,
  COALESCE(ai_chat_count, 0) AS ai_chat_count,
  COALESCE(profile_edit_count, 0) AS profile_view_count,
  COALESCE(profile_edit_count, 0) AS profile_edit_count,
  CASE WHEN COALESCE(job_view_count, 0) > 0
    THEN ROUND(COALESCE(job_apply_count, 0)::NUMERIC / job_view_count, 4)
    ELSE 0
  END AS browse_to_apply_ratio,
  CASE WHEN COALESCE(job_view_count, 0) > 0
    THEN ROUND(COALESCE(job_favorite_count, 0)::NUMERIC / job_view_count, 4)
    ELSE 0
  END AS browse_to_favorite_ratio,
  CASE WHEN COALESCE(search_query_count, 0) > 0
    THEN ROUND(COALESCE(job_click_count, 0)::NUMERIC / search_query_count, 4)
    ELSE 0
  END AS search_to_click_ratio,
  CASE WHEN COALESCE(job_view_count, 0) > 0
    THEN ROUND(COALESCE(job_detail_view_count, 0)::NUMERIC / job_view_count, 4)
    ELSE 0
  END AS detail_view_rate,
  CASE WHEN (morning_count + afternoon_count + evening_count + latenight_count) > 0
    THEN ROUND(morning_count::NUMERIC / (morning_count + afternoon_count + evening_count + latenight_count), 4)
    ELSE 0
  END AS morning_activity_ratio,
  CASE WHEN (morning_count + afternoon_count + evening_count + latenight_count) > 0
    THEN ROUND(afternoon_count::NUMERIC / (morning_count + afternoon_count + evening_count + latenight_count), 4)
    ELSE 0
  END AS afternoon_activity_ratio,
  CASE WHEN (morning_count + afternoon_count + evening_count + latenight_count) > 0
    THEN ROUND(evening_count::NUMERIC / (morning_count + afternoon_count + evening_count + latenight_count), 4)
    ELSE 0
  END AS evening_activity_ratio,
  CASE WHEN (morning_count + afternoon_count + evening_count + latenight_count) > 0
    THEN ROUND(latenight_count::NUMERIC / (morning_count + afternoon_count + evening_count + latenight_count), 4)
    ELSE 0
  END AS late_night_activity_ratio,
  CASE WHEN (weekday_count + weekend_count) > 0
    THEN ROUND(weekday_count::NUMERIC / (weekday_count + weekend_count), 4)
    ELSE 0
  END AS weekday_activity_ratio,
  CASE WHEN (weekday_count + weekend_count) > 0
    THEN ROUND(weekend_count::NUMERIC / (weekday_count + weekend_count), 4)
    ELSE 0
  END AS weekend_activity_ratio,
  COALESCE(avg_dwell_ms, 0) AS avg_dwell_time_ms,
  COALESCE(max_dwell_ms, 0) AS max_dwell_time_ms,
  COALESCE(median_dwell_ms, 0) AS median_dwell_time_ms,
  COALESCE(avg_scroll_depth, 0) AS avg_scroll_depth,
  0 AS avg_interaction_intensity,
  COALESCE(unique_companies_viewed, 0) AS unique_companies_viewed,
  COALESCE(unique_positions_viewed, 0) AS unique_positions_viewed,
  COALESCE(unique_cities_viewed, 0) AS unique_cities_explored,
  COALESCE(unique_industries_viewed, 0) AS unique_industries_explored,
  COALESCE(companies_concentration, 0) AS companies_concentration,
  COALESCE(positions_concentration, 0) AS positions_concentration,
  COALESCE(session_count, 0) AS session_count,
  COALESCE(avg_session_duration_sec, 0) AS avg_session_length_seconds,
  0 AS avg_events_per_session,
  0 AS session_start_rate,
  0 AS view_to_detail_prob,
  0 AS detail_to_apply_prob,
  0 AS browse_to_search_prob,
  0 AS search_to_apply_prob,
  0 AS favorite_to_apply_prob,
  0 AS view_trend,
  0 AS apply_trend,
  0 AS favorite_trend,
  0 AS engagement_trend,
  COALESCE(rec_ctr, 0) AS recommendation_ctr,
  0 AS recommendation_convert_rate,
  COALESCE(search_ctr, 0) AS search_result_ctr,
  0 AS total_behavior_score,
  'medium'::VARCHAR(20) AS engagement_level,
  'medium'::VARCHAR(20) AS activity_level,
  '{}'::JSONB AS ml_features,
  computed_at
FROM profile_stats_snapshot
WHERE snapshot_type = 'daily';
