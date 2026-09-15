/*
# GPU Infrastructure Auto-Scaling System

## Purpose
Provides horizontal auto-scaling for the render_jobs queue processor.
- Min workers stay warm during low traffic to keep fixed costs down
- Workers scale up proportionally when queue depth spikes
- Heartbeats track active workers so the scaler knows current concurrency
- A cooldown prevents thrashing from rapid scale-up/scale-down cycles

## Tables
1. gpu_autoscale_config — singleton config row (id=1) with scale policy parameters
2. gpu_worker_heartbeats — one row per active worker invocation

## Security
- RLS enabled on both tables
- TO anon, authenticated — these are infrastructure tables managed by edge functions
  using the service role key, not directly by app users
*/

-- ============================================================
-- 1. gpu_autoscale_config
-- ============================================================
CREATE TABLE IF NOT EXISTS gpu_autoscale_config (
  id int PRIMARY KEY DEFAULT 1,
  min_workers int NOT NULL DEFAULT 1,
  max_workers int NOT NULL DEFAULT 6,
  scale_up_threshold int NOT NULL DEFAULT 3,
  scale_down_threshold int NOT NULL DEFAULT 0,
  worker_idle_ttl_sec int NOT NULL DEFAULT 120,
  scale_cooldown_sec int NOT NULL DEFAULT 30,
  heartbeat_timeout_sec int NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_config CHECK (id = 1)
);

INSERT INTO gpu_autoscale_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE gpu_autoscale_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_autoscale_config" ON gpu_autoscale_config FOR SELECT
  TO anon, authenticated USING (true);
-- No INSERT/UPDATE/DELETE for anon/authenticated — only service role manages config

-- ============================================================
-- 2. gpu_worker_heartbeats
-- ============================================================
CREATE TABLE IF NOT EXISTS gpu_worker_heartbeats (
  worker_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'ACTIVE',
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  jobs_processed int NOT NULL DEFAULT 0,
  queue_depth_at_start int NOT NULL DEFAULT 0
);

ALTER TABLE gpu_worker_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_worker_heartbeats" ON gpu_worker_heartbeats FOR SELECT
  TO anon, authenticated USING (true);
-- No INSERT/UPDATE/DELETE for anon/authenticated — only service role manages heartbeats

-- ============================================================
-- 3. Helper: count active workers (RPC for the autoscale function)
-- ============================================================
CREATE OR REPLACE FUNCTION count_active_workers(p_timeout_sec int DEFAULT 60)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM gpu_worker_heartbeats
  WHERE status = 'ACTIVE'
    AND last_heartbeat_at > now() - (p_timeout_sec || ' seconds')::interval
$$;

-- ============================================================
-- 4. Helper: clean stale heartbeats (called by autoscale-manager)
-- ============================================================
CREATE OR REPLACE FUNCTION clean_stale_workers(p_timeout_sec int DEFAULT 60)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM gpu_worker_heartbeats
  WHERE status = 'ACTIVE'
    AND last_heartbeat_at < now() - (p_timeout_sec || ' seconds')::interval
$$;
