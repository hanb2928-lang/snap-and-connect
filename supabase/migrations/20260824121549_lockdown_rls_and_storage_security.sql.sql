-- F1: Lock down user_settings — only authenticated can access
DROP POLICY IF EXISTS "anon_select_user_settings" ON user_settings;
DROP POLICY IF EXISTS "anon_insert_user_settings" ON user_settings;
DROP POLICY IF EXISTS "anon_update_user_settings" ON user_settings;
DROP POLICY IF EXISTS "anon_delete_user_settings" ON user_settings;

CREATE POLICY "auth_select_user_settings" ON user_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_user_settings" ON user_settings
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_user_settings" ON user_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_user_settings" ON user_settings
  FOR DELETE TO authenticated USING (true);

-- F4: Lock down scans — only authenticated can access
DROP POLICY IF EXISTS "anon_select_scans" ON scans;
DROP POLICY IF EXISTS "anon_insert_scans" ON scans;
DROP POLICY IF EXISTS "anon_update_scans" ON scans;
DROP POLICY IF EXISTS "anon_delete_scans" ON scans;

CREATE POLICY "auth_select_scans" ON scans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_scans" ON scans
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_scans" ON scans
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_scans" ON scans
  FOR DELETE TO authenticated USING (true);

-- Lock down short_links — only authenticated can access
DROP POLICY IF EXISTS "anon_select_short_links" ON short_links;
DROP POLICY IF EXISTS "anon_insert_short_links" ON short_links;
DROP POLICY IF EXISTS "anon_update_short_links" ON short_links;
DROP POLICY IF EXISTS "anon_delete_short_links" ON short_links;

CREATE POLICY "auth_select_short_links" ON short_links
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_short_links" ON short_links
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_short_links" ON short_links
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_short_links" ON short_links
  FOR DELETE TO authenticated USING (true);

-- F2: Lock down storage buckets — only authenticated can read/write
-- scans bucket: drop old anon policies
DROP POLICY IF EXISTS "anon_delete_scans" ON storage.objects;
DROP POLICY IF EXISTS "anon_read_scans" ON storage.objects;
DROP POLICY IF EXISTS "anon_upload_scans" ON storage.objects;

CREATE POLICY "auth_select_scans_storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'scans');
CREATE POLICY "auth_insert_scans_storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scans');
CREATE POLICY "auth_update_scans_storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'scans') WITH CHECK (bucket_id = 'scans');
CREATE POLICY "auth_delete_scans_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'scans');

-- assets bucket (if it exists)
CREATE POLICY "auth_select_assets_storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'assets');
CREATE POLICY "auth_insert_assets_storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assets');
CREATE POLICY "auth_update_assets_storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'assets') WITH CHECK (bucket_id = 'assets');
CREATE POLICY "auth_delete_assets_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'assets');