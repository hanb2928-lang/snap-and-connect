/*
# Create link_in_bio table — Link-in-Bio landing page system

## Purpose
Gives each creator a single "Link-in-Bio" landing page that aggregates all their
product scans with affiliate links into a clean catalog. Works around SNS platforms
(Instagram, TikTok) that block external links in post captions — the creator puts
one link in their profile bio, and viewers see all products there.

## New Tables
- `link_in_bio`
  - `id` (uuid, PK)
  - `slug` (text, unique) — URL-safe identifier for the landing page (e.g. "creator-jane")
  - `title` (text) — display title for the landing page
  - `bio` (text) — short bio text shown at top of landing page
  - `scan_ids` (uuid[]) — array of scan IDs to display as product cards
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

## Security
- RLS enabled.
- Single-tenant (no auth): anon + authenticated can read all rows (landing pages are public).
- Only authenticated users can create/update/delete (creator manages their own page).
  Since this app does not have sign-in by default, we use anon+authenticated for all
  CRUD operations so the anon-key frontend can manage the page.
*/

CREATE TABLE IF NOT EXISTS link_in_bio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL DEFAULT '내 상품 모음',
  bio text DEFAULT '',
  scan_ids uuid[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE link_in_bio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lib_select_all" ON link_in_bio;
CREATE POLICY "lib_select_all" ON link_in_bio FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "lib_insert_all" ON link_in_bio;
CREATE POLICY "lib_insert_all" ON link_in_bio FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lib_update_all" ON link_in_bio;
CREATE POLICY "lib_update_all" ON link_in_bio FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lib_delete_all" ON link_in_bio;
CREATE POLICY "lib_delete_all" ON link_in_bio FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_link_in_bio_slug ON link_in_bio(slug);
