/*
# Create click_events table for QR/CTR analytics

1. New Tables
- `click_events`
  - `id` (uuid, primary key)
  - `short_link_slug` (text, the slug of the short link that was clicked)
  - `scan_id` (uuid, nullable, references scans — which scan the QR/link belongs to)
  - `platform` (text, nullable — detected platform from destination URL: Coupang, BrandConnect, Toss, etc.)
  - `clicked_at` (timestamptz, default now() — when the click happened)
  - `user_agent` (text, nullable — browser UA for bot/device filtering)
  - `referer` (text, nullable — referer header if available)

2. Indexes
- `click_events_clicked_at_idx` on `clicked_at` for time-series queries
- `click_events_scan_id_idx` on `scan_id` for per-scan stats
- `click_events_platform_idx` on `platform` for platform breakdown

3. Security
- Enable RLS on `click_events`.
- Single-tenant (no auth): allow anon + authenticated to read and insert.
  - INSERT is needed because the redirect edge function (running with service role) inserts click events.
  - SELECT is needed because the app frontend reads analytics data.
  - UPDATE/DELETE not needed for click events (immutable log).

4. Notes
- This table is an append-only log of individual click events.
- The redirect edge function (r/index.ts) will insert a row here on each non-bot redirect.
- The analytics dashboard queries this table for time-series, platform breakdown, and per-scan stats.
*/

CREATE TABLE IF NOT EXISTS click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_slug text,
  scan_id uuid REFERENCES scans(id) ON DELETE SET NULL,
  platform text,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  referer text
);

ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_click_events" ON click_events;
CREATE POLICY "anon_select_click_events" ON click_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_click_events" ON click_events;
CREATE POLICY "anon_insert_click_events" ON click_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS click_events_clicked_at_idx ON click_events (clicked_at);
CREATE INDEX IF NOT EXISTS click_events_scan_id_idx ON click_events (scan_id);
CREATE INDEX IF NOT EXISTS click_events_platform_idx ON click_events (platform);
