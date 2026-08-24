-- Revert table policies back to anon access (no-auth app)
-- but protect the openai_api_key column via column-level privileges

-- user_settings: restore anon access to all columns EXCEPT openai_api_key
DROP POLICY IF EXISTS "auth_select_user_settings" ON user_settings;
DROP POLICY IF EXISTS "auth_insert_user_settings" ON user_settings;
DROP POLICY IF EXISTS "auth_update_user_settings" ON user_settings;
DROP POLICY IF EXISTS "auth_delete_user_settings" ON user_settings;

CREATE POLICY "anon_select_user_settings" ON user_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_user_settings" ON user_settings
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_user_settings" ON user_settings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_user_settings" ON user_settings
  FOR DELETE TO anon, authenticated USING (true);

-- Column-level: revoke anon access to openai_api_key
REVOKE SELECT (openai_api_key) ON user_settings FROM anon;
REVOKE UPDATE (openai_api_key) ON user_settings FROM anon;
-- Keep INSERT open since the settings page needs to save the key
-- But only authenticated can read it back

-- scans: restore anon access
DROP POLICY IF EXISTS "auth_select_scans" ON scans;
DROP POLICY IF EXISTS "auth_insert_scans" ON scans;
DROP POLICY IF EXISTS "auth_update_scans" ON scans;
DROP POLICY IF EXISTS "auth_delete_scans" ON scans;

CREATE POLICY "anon_select_scans" ON scans
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_scans" ON scans
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_scans" ON scans
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_scans" ON scans
  FOR DELETE TO anon, authenticated USING (true);

-- short_links: restore anon access
DROP POLICY IF EXISTS "auth_select_short_links" ON short_links;
DROP POLICY IF EXISTS "auth_insert_short_links" ON short_links;
DROP POLICY IF EXISTS "auth_update_short_links" ON short_links;
DROP POLICY IF EXISTS "auth_delete_short_links" ON short_links;

CREATE POLICY "anon_select_short_links" ON short_links
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_short_links" ON short_links
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_short_links" ON short_links
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_short_links" ON short_links
  FOR DELETE TO anon, authenticated USING (true);