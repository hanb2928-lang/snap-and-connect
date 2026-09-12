/*
# Create video_jobs table for async video generation tracking

1. New Tables
- `video_jobs`
  - `id` (uuid, primary key)
  - `scan_id` (uuid, references scans, nullable for non-scan jobs)
  - `task_id` (text, Runway task identifier)
  - `status` (text: PENDING, RUNNING, SUCCESS, FAILED — default PENDING)
  - `is_draft` (boolean, default false — marks quick-preview renders)
  - `video_url` (text, nullable — filled when job completes)
  - `error_message` (text, nullable — filled on failure)
  - `completed_at` (timestamptz, nullable)
  - `created_at` (timestamptz, default now())
2. Indexes
- Index on `scan_id` for fast lookup
- Index on `task_id` for webhook matching
3. Security
- Enable RLS on `video_jobs`
- This is a single-tenant app (no auth), so allow anon + authenticated CRUD
*/

CREATE TABLE IF NOT EXISTS video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid REFERENCES scans(id) ON DELETE CASCADE,
  task_id text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  is_draft boolean NOT NULL DEFAULT false,
  video_url text,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_scan_id ON video_jobs(scan_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_task_id ON video_jobs(task_id);

ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_video_jobs" ON video_jobs;
CREATE POLICY "anon_select_video_jobs" ON video_jobs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_video_jobs" ON video_jobs;
CREATE POLICY "anon_insert_video_jobs" ON video_jobs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_video_jobs" ON video_jobs;
CREATE POLICY "anon_update_video_jobs" ON video_jobs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_video_jobs" ON video_jobs;
CREATE POLICY "anon_delete_video_jobs" ON video_jobs FOR DELETE
  TO anon, authenticated USING (true);
