-- ============================================================
-- Migration 018: Crawl Module Schema Fixes
-- ============================================================
-- 1. Fix TIMSTAMPTZ typo in source_accounts (was TIMSTAMPTZ → should be TIMESTAMPTZ)
-- 2. Add missing indexes on raw_job_records, job_canonical_mappings, crawl_runs
-- 3. Add missing FK on job_entrypoints.owner_user_id → users.id
-- 4. Add unique constraints for data deduplication
-- 5. Add NOT NULL constraint on raw_job_records.source_job_id
-- ============================================================

-- Step 1: Fix TIMSTAMPTZ typo (TIMESTAMPTZ is invalid, should be TIMESTAMPTZ)
-- Only alter if the column exists and isn't already TIMESTAMPTZ
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'source_accounts' AND column_name = 'last_valid_at'
    AND udt_name != 'timestamptz'
  ) THEN
    ALTER TABLE source_accounts
    ALTER COLUMN last_valid_at TYPE TIMESTAMPTZ USING last_valid_at::TIMESTAMPTZ;
  END IF;
END $$;

-- Step 2: Add NOT NULL + unique constraint on raw_job_records for deduplication
-- First, ensure source_job_id has a value (use source_name||'_'||id as fallback)
UPDATE raw_job_records
SET source_job_id = COALESCE(source_job_id, source_name || '_' || id::TEXT)
WHERE source_job_id IS NULL;

-- Only set NOT NULL if not already set (idempotent for re-runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_job_records'
      AND column_name = 'source_job_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE raw_job_records
    ALTER COLUMN source_job_id SET NOT NULL;
  END IF;
END $$;

-- Step 3: Add unique constraint on raw_job_records (source_name, source_job_id)
-- This is the primary deduplication constraint at the raw records level.
-- Handle existing duplicates inside a transaction block first.
DO $$
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT source_name, source_job_id
    FROM raw_job_records
    GROUP BY source_name, source_job_id
    HAVING COUNT(*) > 1
  ) sub;

  IF dup_count > 0 THEN
    RAISE NOTICE 'Found % duplicate groups in raw_job_records. Keeping newest record per group.', dup_count;
    DELETE FROM raw_job_records a
    USING raw_job_records b
    WHERE a.id < b.id
      AND a.source_name = b.source_name
      AND a.source_job_id = b.source_job_id;
  END IF;
END $$;

-- Create the unique index. IF NOT EXISTS is valid for non-CONCURRENTLY unique indexes
-- on all supported PG versions. CONCURRENTLY is omitted to avoid transaction-block issues.
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_job_records_source_key
  ON raw_job_records (source_name, source_job_id);

-- Step 4: Add index on raw_job_records.crawl_run_id (for batch lookups)
CREATE INDEX IF NOT EXISTS idx_raw_job_records_crawl_run
  ON raw_job_records (crawl_run_id);

-- Step 5: Add index on raw_job_records.parse_status (for filtering by status)
CREATE INDEX IF NOT EXISTS idx_raw_job_records_parse_status
  ON raw_job_records (parse_status);

-- Step 6: Add index on raw_job_records.source_name (for source-level queries)
CREATE INDEX IF NOT EXISTS idx_raw_job_records_source_name
  ON raw_job_records (source_name);

-- Step 7: Add indexes on job_canonical_mappings
CREATE INDEX IF NOT EXISTS idx_canonical_mappings_raw_record
  ON job_canonical_mappings (raw_job_record_id);

CREATE INDEX IF NOT EXISTS idx_canonical_mappings_job
  ON job_canonical_mappings (job_id);

-- Step 8: Add composite index on crawl_runs for pending/running queries
CREATE INDEX IF NOT EXISTS idx_crawl_runs_status_created
  ON crawl_runs (status, created_at DESC);

-- Step 9: Add index on job_entrypoints.source_job_id (for dedup lookups)
CREATE INDEX IF NOT EXISTS idx_job_entrypoints_source_key
  ON job_entrypoints (source_name, source_job_id)
  WHERE source_name IS NOT NULL AND source_job_id IS NOT NULL;

-- Step 10: Add unique constraint on job_entrypoints (job_id, entry_type, entry_url)
-- This prevents duplicate entrypoints from being inserted
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_entrypoints_unique
  ON job_entrypoints (job_id, entry_type, entry_url);

-- Step 11: Add FK on job_entrypoints.owner_user_id → users.id (if users table exists)
-- Guard against duplicate constraint name from a previous run
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_job_entrypoints_owner_user'
    ) THEN
      ALTER TABLE job_entrypoints
      ADD CONSTRAINT fk_job_entrypoints_owner_user
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'users table not found, skipping owner_user_id FK';
END $$;

-- Step 12: Add index on job_sources for enabled + priority queries
CREATE INDEX IF NOT EXISTS idx_job_sources_enabled_priority
  ON job_sources (is_enabled DESC, priority DESC)
  WHERE is_enabled = TRUE;
