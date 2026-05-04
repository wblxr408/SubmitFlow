-- ============================================================
-- 投递提醒功能迁移
-- v1.5: 新增 reminders 表
-- ============================================================

-- ============================================================
-- reminders - 投递提醒配置
-- ============================================================
CREATE TABLE IF NOT EXISTS reminders (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_type VARCHAR(20) NOT NULL DEFAULT 'deadline',
  -- deadline: 截止日期提醒
  -- deadline_3d: 截止前3天
  -- deadline_7d: 截止前7天
  days_before INTEGER DEFAULT 3,
  job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
  -- NULL means all jobs, specific job_id means that job only
  channel VARCHAR(10) NOT NULL DEFAULT 'email',
  -- email, feishu, both
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_profile ON reminders(profile_id);
CREATE INDEX IF NOT EXISTS idx_reminders_job ON reminders(job_id);
CREATE INDEX IF NOT EXISTS idx_reminders_enabled ON reminders(profile_id, is_enabled);

-- ============================================================
-- reminder_logs - 提醒发送记录
-- ============================================================
CREATE TABLE IF NOT EXISTS reminder_logs (
  id BIGSERIAL PRIMARY KEY,
  reminder_id BIGINT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  channel VARCHAR(10) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'sent',
  -- sent, failed
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_reminder ON reminder_logs(reminder_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_sent ON reminder_logs(sent_at DESC);

-- ============================================================
-- 注释
-- ============================================================
COMMENT ON TABLE reminders IS '投递提醒配置';
COMMENT ON COLUMN reminders.reminder_type IS '提醒类型: deadline=截止日期提醒';
COMMENT ON COLUMN reminders.days_before IS '提前多少天提醒';
COMMENT ON COLUMN reminders.channel IS '通知渠道: email, feishu, both';
