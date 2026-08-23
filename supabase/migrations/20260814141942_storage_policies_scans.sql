/*
# Storage policies for scans bucket

## Overview
The `scans` bucket is public (images are served via public URLs). These policies allow
the anon + authenticated roles to upload, read, and delete objects in the bucket.

## Security
- Public bucket — images are accessible via public URL.
- CRUD policies allow anon + authenticated to manage objects (single-tenant app).
*/

DROP POLICY IF EXISTS "anon_upload_scans" ON storage.objects;
CREATE POLICY "anon_upload_scans" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'scans');

DROP POLICY IF EXISTS "anon_read_scans" ON storage.objects;
CREATE POLICY "anon_read_scans" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'scans');

DROP POLICY IF EXISTS "anon_delete_scans" ON storage.objects;
CREATE POLICY "anon_delete_scans" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'scans');
