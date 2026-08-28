/*
# Add async analysis infrastructure to scans

1. New Columns on `scans`
- `analysis_job_id` (uuid, nullable): Links to the render_jobs row processing this scan's AI analysis.
  When non-null, the result page can subscribe to this job's realtime updates to show live progress.
- `image_hash` (text, nullable): A hash of the uploaded image data for smart caching.
  Used to detect if the same (or very similar) image was already analyzed, allowing instant cache hits.

2. New Table: `analysis_cache`
- Stores cached AI analysis results keyed by image hash, so repeat or similar photos get instant results.
- `id` (uuid, primary key)
- `image_hash` (text, unique, not null): The hash key for cache lookup
- `analysis_result` (jsonb, not null): The full AnalysisResult object from AI
- `created_at` (timestamptz, default now())
- `hit_count` (int, default 0): How many times this cache entry has been used (for analytics/cleanup)

3. Security
- `analysis_cache` gets RLS with anon+authenticated full access (single-tenant no-auth app).
- `scans` already has RLS policies; new columns inherit existing access.
- No destructive changes to existing data.

4. Notes
- Both new columns on `scans` are nullable with no defaults, so existing rows are unaffected.
- The image_hash enables smart caching: when a user uploads a photo that matches a cached hash,
  the system skips the AI analysis queue and returns the cached result immediately.
- The analysis_job_id enables the non-blocking flow: the camera creates a scan row with
  analysis_job_id set, navigates immediately, and the result page subscribes to the job
  for realtime progress updates.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scans' AND column_name = 'analysis_job_id') THEN
    ALTER TABLE scans ADD COLUMN analysis_job_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scans' AND column_name = 'image_hash') THEN
    ALTER TABLE scans ADD COLUMN image_hash text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scans_analysis_job_id ON scans(analysis_job_id);
CREATE INDEX IF NOT EXISTS idx_scans_image_hash ON scans(image_hash);

CREATE TABLE IF NOT EXISTS analysis_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_hash text UNIQUE NOT NULL,
  analysis_result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  hit_count int NOT NULL DEFAULT 0
);

ALTER TABLE analysis_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_analysis_cache" ON analysis_cache;
CREATE POLICY "anon_select_analysis_cache" ON analysis_cache FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_analysis_cache" ON analysis_cache;
CREATE POLICY "anon_insert_analysis_cache" ON analysis_cache FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_analysis_cache" ON analysis_cache;
CREATE POLICY "anon_update_analysis_cache" ON analysis_cache FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_analysis_cache" ON analysis_cache;
CREATE POLICY "anon_delete_analysis_cache" ON analysis_cache FOR DELETE
  TO anon, authenticated USING (true);
