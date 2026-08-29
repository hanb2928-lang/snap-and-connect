/*
# Create gamification tables: quests, creator_tiers, leaderboard

## Purpose
Boost user retention with daily/weekly marketing quests, a creator tier system,
and a revenue-based leaderboard.

## New Tables
1. daily_quests — quest definitions and progress
2. creator_tier — single-row tier tracking (enforced by CHECK)
3. leaderboard_entries — anonymized monthly leaderboard

## Security
- RLS enabled on all tables, anon + authenticated CRUD (single-tenant).
*/

CREATE TABLE IF NOT EXISTS daily_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_type text NOT NULL DEFAULT 'daily_publish',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  reward_credits integer NOT NULL DEFAULT 50,
  target_count integer NOT NULL DEFAULT 1,
  current_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE daily_quests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quests_select_all" ON daily_quests;
CREATE POLICY "quests_select_all" ON daily_quests FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "quests_insert_all" ON daily_quests;
CREATE POLICY "quests_insert_all" ON daily_quests FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "quests_update_all" ON daily_quests;
CREATE POLICY "quests_update_all" ON daily_quests FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "quests_delete_all" ON daily_quests;
CREATE POLICY "quests_delete_all" ON daily_quests FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS creator_tier (
  id integer PRIMARY KEY DEFAULT 1,
  tier_level text NOT NULL DEFAULT 'bronze',
  total_scans integer NOT NULL DEFAULT 0,
  total_clicks integer NOT NULL DEFAULT 0,
  total_revenue integer NOT NULL DEFAULT 0,
  tier_points integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE creator_tier ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tier_select_all" ON creator_tier;
CREATE POLICY "tier_select_all" ON creator_tier FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "tier_insert_all" ON creator_tier;
CREATE POLICY "tier_insert_all" ON creator_tier FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "tier_update_all" ON creator_tier;
CREATE POLICY "tier_update_all" ON creator_tier FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tier_delete_all" ON creator_tier;
CREATE POLICY "tier_delete_all" ON creator_tier FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  tier text NOT NULL DEFAULT 'bronze',
  total_revenue integer NOT NULL DEFAULT 0,
  total_clicks integer NOT NULL DEFAULT 0,
  viral_count integer NOT NULL DEFAULT 0,
  rank integer NOT NULL DEFAULT 0,
  period text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leaderboard_select_all" ON leaderboard_entries;
CREATE POLICY "leaderboard_select_all" ON leaderboard_entries FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "leaderboard_insert_all" ON leaderboard_entries;
CREATE POLICY "leaderboard_insert_all" ON leaderboard_entries FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "leaderboard_update_all" ON leaderboard_entries;
CREATE POLICY "leaderboard_update_all" ON leaderboard_entries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "leaderboard_delete_all" ON leaderboard_entries;
CREATE POLICY "leaderboard_delete_all" ON leaderboard_entries FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_quests_status ON daily_quests(status);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON leaderboard_entries(period);
