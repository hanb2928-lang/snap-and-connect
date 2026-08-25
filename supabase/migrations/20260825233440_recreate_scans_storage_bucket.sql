
-- Recreate the scans storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('scans', 'scans', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, public = EXCLUDED.public;

-- Allow anon and authenticated to upload to scans bucket
CREATE POLICY "scans_upload_all" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'scans');

-- Allow public read of scans bucket
CREATE POLICY "scans_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'scans');

-- Allow anon and authenticated to update scans objects
CREATE POLICY "scans_update_all" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'scans')
  WITH CHECK (bucket_id = 'scans');

-- Allow anon and authenticated to delete scans objects
CREATE POLICY "scans_delete_all" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'scans');
