
-- Create videos storage bucket for mobile video uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, public = EXCLUDED.public;

-- Allow anon and authenticated to upload to videos bucket
CREATE POLICY "videos_upload_all" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'videos');

-- Allow public read of videos bucket
CREATE POLICY "videos_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'videos');

-- Allow anon and authenticated to update videos objects
CREATE POLICY "videos_update_all" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'videos')
  WITH CHECK (bucket_id = 'videos');

-- Allow anon and authenticated to delete videos objects
CREATE POLICY "videos_delete_all" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'videos');
