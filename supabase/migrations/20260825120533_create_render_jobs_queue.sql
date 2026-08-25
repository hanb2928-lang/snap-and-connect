/*
# Create render_jobs table for async job queue

1. New Tables
- `render_jobs`: Stores async heavy-compute jobs (photo analysis, virtual fitting, virtual cuts, TTS, etc.)
  - `id` (uuid, primary key)
  - `job_type` (text, not null) — e.g. 'analyze-photo', 'virtual-fitting', 'virtual-cuts', 'generate-tts'
  - `status` (text, not null, default 'queued') — 'queued' | 'processing' | 'done' | 'error'
  - `priority` (int, default 5) — lower = higher priority
  - `payload` (jsonb) — input parameters for the job
  - `result` (jsonb) — output from the job when done
  - `error_message` (text) — error description if failed
  - `scan_id` (uuid, nullable) — optional link to scans table
  - `created_at` (timestamptz, default now())
  - `started_at` (timestamptz, nullable) — when processing began
  - `completed_at` (timestamptz, nullable) — when processing finished
  - `attempts` (int, default 0) — retry counter

2. Indexes
- `idx_render_jobs_status_priority` on (status, priority, created_at) — for dequeue ordering
- `idx_render_jobs_created_at` on (created_at) — for cleanup queries

3. Security
- Enable RLS on render_jobs.
- This app has no sign-in screen, so policies use TO anon, authenticated for full CRUD.
*/

CREATE TABLE IF NOT EXISTS render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  priority int NOT NULL DEFAULT 5,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  scan_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  attempts int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_render_jobs_status_priority
  ON render_jobs (status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_render_jobs_created_at
  ON render_jobs (created_at);

ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_render_jobs" ON render_jobs;
CREATE POLICY "anon_select_render_jobs"
  ON render_jobs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_render_jobs" ON render_jobs;
CREATE POLICY "anon_insert_render_jobs"
  ON render_jobs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_render_jobs" ON render_jobs;
CREATE POLICY "anon_update_render_jobs"
  ON render_jobs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_render_jobs" ON render_jobs;
CREATE POLICY "anon_delete_render_jobs"
  ON render_jobs FOR DELETE
  TO anon, authenticated USING (true);
