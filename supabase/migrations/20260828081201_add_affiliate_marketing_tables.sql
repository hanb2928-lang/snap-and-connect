/*
# Add affiliate marketing tables and short_links click tracking

## Purpose
Support the expanded affiliate/marketing tab with link bookmarks,
marketing snippet management, revenue performance analytics, and
click tracking on short links.

## New Tables
1. `link_bookmarks` — saved affiliate links with labels and metadata
   - id (uuid PK)
   - label (text) — user-facing name
   - url (text) — the affiliate URL
   - platform (text) — e.g. Coupang, Toss, BrandConnect
   - short_url (text, nullable) — shortened URL if created
   - scan_id (uuid, nullable) — associated scan if any
   - click_count (int, default 0)
   - created_at (timestamptz)

2. `marketing_snippets` — reusable copy/hashtag snippets
   - id (uuid PK)
   - title (text) — snippet label
   - content (text) — the snippet body
   - snippet_type (text) — 'copy' | 'hashtag' | 'hook'
   - platform (text, nullable) — associated platform
   - created_at (timestamptz)

3. `revenue_records` — affiliate revenue entries for dashboard
   - id (uuid PK)
   - platform (text) — source platform
   - amount (numeric) — revenue amount
   - period_month (text) — YYYY-MM format
   - note (text, nullable)
   - scan_id (uuid, nullable) — linked scan
   - created_at (timestamptz)

## Modified Tables
- `short_links` — add `click_count` (int, default 0) and `last_clicked_at` (timestamptz, nullable)

## Security
- All new tables have RLS enabled with anon+authenticated full CRUD
  (single-tenant app, no auth screen)
*/

CREATE TABLE IF NOT EXISTS link_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  url text NOT NULL,
  platform text NOT NULL DEFAULT '',
  short_url text,
  scan_id uuid,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE link_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_link_bookmarks" ON link_bookmarks;
CREATE POLICY "anon_select_link_bookmarks" ON link_bookmarks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_link_bookmarks" ON link_bookmarks;
CREATE POLICY "anon_insert_link_bookmarks" ON link_bookmarks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_link_bookmarks" ON link_bookmarks;
CREATE POLICY "anon_update_link_bookmarks" ON link_bookmarks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_link_bookmarks" ON link_bookmarks;
CREATE POLICY "anon_delete_link_bookmarks" ON link_bookmarks FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS marketing_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  snippet_type text NOT NULL DEFAULT 'copy',
  platform text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marketing_snippets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_marketing_snippets" ON marketing_snippets;
CREATE POLICY "anon_select_marketing_snippets" ON marketing_snippets FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_marketing_snippets" ON marketing_snippets;
CREATE POLICY "anon_insert_marketing_snippets" ON marketing_snippets FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_marketing_snippets" ON marketing_snippets;
CREATE POLICY "anon_update_marketing_snippets" ON marketing_snippets FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_marketing_snippets" ON marketing_snippets;
CREATE POLICY "anon_delete_marketing_snippets" ON marketing_snippets FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS revenue_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  period_month text NOT NULL,
  note text,
  scan_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE revenue_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_revenue_records" ON revenue_records;
CREATE POLICY "anon_select_revenue_records" ON revenue_records FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_revenue_records" ON revenue_records;
CREATE POLICY "anon_insert_revenue_records" ON revenue_records FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_revenue_records" ON revenue_records;
CREATE POLICY "anon_update_revenue_records" ON revenue_records FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_revenue_records" ON revenue_records;
CREATE POLICY "anon_delete_revenue_records" ON revenue_records FOR DELETE
  TO anon, authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'short_links' AND column_name = 'click_count'
  ) THEN
    ALTER TABLE short_links ADD COLUMN click_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'short_links' AND column_name = 'last_clicked_at'
  ) THEN
    ALTER TABLE short_links ADD COLUMN last_clicked_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_link_bookmarks_created ON link_bookmarks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_snippets_created ON marketing_snippets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_records_period ON revenue_records (period_month DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_records_platform ON revenue_records (platform);
