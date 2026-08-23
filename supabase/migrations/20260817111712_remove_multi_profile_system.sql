-- Remove multi-profile system: convert back to single-tenant.

-- 1. Drop profile_id columns from scans, revenue_records, saved_assets
ALTER TABLE scans DROP COLUMN IF EXISTS profile_id;
ALTER TABLE revenue_records DROP COLUMN IF EXISTS profile_id;
ALTER TABLE saved_assets DROP COLUMN IF EXISTS profile_id;

-- 2. Drop the scans_profile_id index if it exists
DROP INDEX IF EXISTS scans_profile_id_idx;

-- 3. Convert user_settings from uuid (per-profile) back to singleton (integer id=1)
--    Save current data, drop and recreate.
CREATE TABLE IF NOT EXISTS _user_settings_migrate AS
  SELECT coupang_partners_id, naver_shopping_id, toss_share_id, openai_api_key
  FROM user_settings
  LIMIT 1;

DROP TABLE IF EXISTS user_settings;

CREATE TABLE user_settings (
  id integer PRIMARY KEY DEFAULT 1,
  coupang_partners_id text,
  naver_shopping_id text,
  toss_share_id text,
  openai_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_settings_singleton CHECK (id = 1)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_user_settings" ON user_settings;
CREATE POLICY "anon_select_user_settings" ON user_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_user_settings" ON user_settings;
CREATE POLICY "anon_insert_user_settings" ON user_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_user_settings" ON user_settings;
CREATE POLICY "anon_update_user_settings" ON user_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_user_settings" ON user_settings;
CREATE POLICY "anon_delete_user_settings" ON user_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Migrate existing settings into singleton row
INSERT INTO user_settings (id, coupang_partners_id, naver_shopping_id, toss_share_id, openai_api_key)
SELECT 1, coupang_partners_id, naver_shopping_id, toss_share_id, openai_api_key
FROM _user_settings_migrate
WHERE EXISTS (SELECT 1 FROM _user_settings_migrate)
ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS _user_settings_migrate;

-- 4. Drop the profiles table
DROP TABLE IF EXISTS profiles CASCADE;
