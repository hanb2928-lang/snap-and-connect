/*
# Create upload_schedules table for Smart Upload Scheduler

1. New Tables
- `upload_schedules`
  - `id` (uuid, primary key)
  - `scan_id` (text, references scans id, nullable — links schedule to a specific scan result)
  - `scheduled_time` (timestamptz, not null — when the golden-time upload reminder should fire)
  - `platform` (text, nullable — target platform e.g. 'youtube', 'instagram', 'tiktok')
  - `caption` (text, nullable — pre-filled caption to copy when notification fires)
  - `hashtags` (text[], nullable — pre-filled hashtags to copy)
  - `affiliate_url` (text, nullable — affiliate link to copy)
  - `status` (text, not null, default 'pending' — 'pending', 'fired', 'dismissed')
  - `notification_enabled` (boolean, default true)
  - `created_at` (timestamptz, default now())
  - `fired_at` (timestamptz, nullable — when notification was actually sent)

2. Security
- Enable RLS on `upload_schedules`.
- Single-tenant app (no sign-in): allow anon + authenticated CRUD.
*/

CREATE TABLE IF NOT EXISTS upload_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id text,
  scheduled_time timestamptz NOT NULL,
  platform text,
  caption text,
  hashtags text[],
  affiliate_url text,
  status text NOT NULL DEFAULT 'pending',
  notification_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  fired_at timestamptz
);

ALTER TABLE upload_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_upload_schedules" ON upload_schedules;
CREATE POLICY "anon_select_upload_schedules" ON upload_schedules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_upload_schedules" ON upload_schedules;
CREATE POLICY "anon_insert_upload_schedules" ON upload_schedules FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_upload_schedules" ON upload_schedules;
CREATE POLICY "anon_update_upload_schedules" ON upload_schedules FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_upload_schedules" ON upload_schedules;
CREATE POLICY "anon_delete_upload_schedules" ON upload_schedules FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_upload_schedules_status ON upload_schedules(status);
CREATE INDEX IF NOT EXISTS idx_upload_schedules_scheduled_time ON upload_schedules(scheduled_time);
