/*
# Create warmup schedule tables for account warmup (warmup) process

1. New Tables
- `warmup_schedules`: Stores a warmup plan for a specific platform account.
  - `id` (uuid, primary key)
  - `platform` (text, not null) — e.g. 'instagram', 'tiktok', 'twitter', 'blog'
  - `account_name` (text, not null) — display name for the account being warmed up
  - `start_date` (date, not null) — when the warmup period starts
  - `duration_days` (int, default 14) — length of warmup period
  - `daily_post_target` (int, default 1) — how many posts per day
  - `status` (text, default 'active') — 'active' | 'paused' | 'completed'
  - `created_at` (timestamptz)
- `warmup_tasks`: Individual daily tasks within a warmup schedule.
  - `id` (uuid, primary key)
  - `schedule_id` (uuid, FK to warmup_schedules)
  - `day_number` (int, not null) — which day in the schedule (1-based)
  - `scheduled_date` (date, not null) — the actual date for this task
  - `task_type` (text, not null) — 'post' | 'engage' | 'follow' | 'comment' | 'like' | 'story'
  - `title` (text, not null) — short description
  - `description` (text) — detailed instructions
  - `status` (text, default 'pending') — 'pending' | 'done' | 'skipped'
  - `completed_at` (timestamptz, nullable)
  - `created_at` (timestamptz)

2. Security
- Single-tenant app (no auth). Enable RLS on both tables.
- Allow anon + authenticated full CRUD since data is intentionally shared.

3. Notes
- Warmup schedules are generated automatically based on a template when a user
  creates a new plan. Tasks are created per-day with a mix of posting and
  engagement activities designed to build account credibility naturally.
- The schedule can be paused/resumed. Tasks can be checked off individually.
*/

CREATE TABLE IF NOT EXISTS warmup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  account_name text NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  duration_days int NOT NULL DEFAULT 14,
  daily_post_target int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE warmup_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_warmup_schedules" ON warmup_schedules;
CREATE POLICY "anon_select_warmup_schedules" ON warmup_schedules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_warmup_schedules" ON warmup_schedules;
CREATE POLICY "anon_insert_warmup_schedules" ON warmup_schedules FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_warmup_schedules" ON warmup_schedules;
CREATE POLICY "anon_update_warmup_schedules" ON warmup_schedules FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_warmup_schedules" ON warmup_schedules;
CREATE POLICY "anon_delete_warmup_schedules" ON warmup_schedules FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS warmup_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES warmup_schedules(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  scheduled_date date NOT NULL,
  task_type text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE warmup_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_warmup_tasks" ON warmup_tasks;
CREATE POLICY "anon_select_warmup_tasks" ON warmup_tasks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_warmup_tasks" ON warmup_tasks;
CREATE POLICY "anon_insert_warmup_tasks" ON warmup_tasks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_warmup_tasks" ON warmup_tasks;
CREATE POLICY "anon_update_warmup_tasks" ON warmup_tasks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_warmup_tasks" ON warmup_tasks;
CREATE POLICY "anon_delete_warmup_tasks" ON warmup_tasks FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_warmup_tasks_schedule_id ON warmup_tasks(schedule_id);
CREATE INDEX IF NOT EXISTS idx_warmup_tasks_scheduled_date ON warmup_tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_warmup_schedules_status ON warmup_schedules(status);
