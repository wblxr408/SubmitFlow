-- ============================================================
-- 简历管理功能迁移
-- v1.6: 新增 resumes 表
-- ============================================================

CREATE TABLE IF NOT EXISTS resumes (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumes_profile ON resumes(profile_id);
CREATE INDEX IF NOT EXISTS idx_resumes_default ON resumes(profile_id, is_default);

-- 只能有一个默认简历
CREATE OR REPLACE FUNCTION ensure_single_default_resume()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE resumes SET is_default = FALSE WHERE profile_id = NEW.profile_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_single_default_resume ON resumes;
CREATE TRIGGER trg_ensure_single_default_resume
  BEFORE INSERT OR UPDATE ON resumes
  FOR EACH ROW EXECUTE FUNCTION ensure_single_default_resume();

COMMENT ON TABLE resumes IS '用户简历管理';
