/*
# Create short_links table for self-hosted URL shortener

## Overview
Adds a `short_links` table that maps a short random slug (e.g. "aB3x9") to a full destination URL.
An edge function `r` reads the slug and redirects to the destination.
The frontend inserts a row and receives the slug, then displays `https://<project>.supabase.co/functions/v1/r/<slug>` as the short URL on template cards and video clips.

## New Tables
- `short_links`
  - `id` (uuid, primary key)
  - `slug` (text, unique, not null) — 6-character base62 random string
  - `destination_url` (text, not null) — full URL to redirect to
  - `scan_id` (uuid, references scans ON DELETE CASCADE) — optional link back to the scan that created it
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on `short_links`.
- No auth: all CRUD open to anon + authenticated (same single-device model as other tables).
- Anyone can read a short link (needed for the redirect edge function via service role, and for the app to look up its own links).
*/
CREATE TABLE IF NOT EXISTS short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  destination_url text NOT NULL,
  scan_id uuid REFERENCES scans(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_short_links" ON short_links;
CREATE POLICY "anon_select_short_links" ON short_links FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_short_links" ON short_links;
CREATE POLICY "anon_insert_short_links" ON short_links FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_short_links" ON short_links;
CREATE POLICY "anon_update_short_links" ON short_links FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_short_links" ON short_links;
CREATE POLICY "anon_delete_short_links" ON short_links FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS short_links_slug_idx ON short_links (slug);