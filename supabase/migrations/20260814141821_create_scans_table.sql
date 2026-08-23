/*
# Create scans table for Snap & Connect

## Overview
Stores photo analysis records — each row represents one photo the user captured or uploaded,
along with the AI-generated analysis (title, summary, extracted contacts, tags).

## New Tables
- `scans`
  - `id` (uuid, primary key)
  - `image_url` (text, not null) — URL of the stored image in Supabase Storage
  - `title` (text) — AI-generated short title for the scan
  - `summary` (text) — AI-generated summary of what's in the photo
  - `contacts` (jsonb, default '[]') — extracted social/contact info as a JSON array
  - `tags` (text[], default '{}') — descriptive tags for the photo
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on `scans`.
- Single-tenant (no auth): all CRUD open to anon + authenticated since data is intentionally shared.
*/

CREATE TABLE IF NOT EXISTS scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text,
  summary text,
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_scans" ON scans;
CREATE POLICY "anon_select_scans" ON scans FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_scans" ON scans;
CREATE POLICY "anon_insert_scans" ON scans FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_scans" ON scans;
CREATE POLICY "anon_update_scans" ON scans FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_scans" ON scans;
CREATE POLICY "anon_delete_scans" ON scans FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS scans_created_at_idx ON scans (created_at DESC);
