/*
# Create saved_assets table and assets storage bucket

## Overview
Adds a `saved_assets` table and an `assets` storage bucket so users can save
generated template card images and video clips, then browse and re-download
them later from a dedicated "내 제작물" tab.

## New Tables
- `saved_assets`
  - `id` (uuid, primary key)
  - `profile_id` (uuid, references profiles, ON DELETE CASCADE) — which profile owns this asset
  - `scan_id` (uuid, references scans, ON DELETE SET NULL) — which scan produced this asset
  - `asset_type` (text, not null) — 'image' or 'video'
  - `title` (text, not null) — display title (product name or custom label)
  - `file_url` (text, not null) — public URL of the file in the assets bucket
  - `file_name` (text, not null) — original file name in storage
  - `file_size` (bigint) — file size in bytes (optional)
  - `mime_type` (text) — mime type of the file (optional)
  - `thumbnail_url` (text) — for videos, a poster/thumbnail URL (optional)
  - `platform` (text) — which platform style was used (optional)
  - `affiliate_platform` (text) — which affiliate platform was selected (optional)
  - `created_at` (timestamptz, default now())

## Storage
- New bucket `assets` (public) for storing generated images and videos.
- CRUD policies allow anon + authenticated to manage objects (single-tenant app).

## Security
- RLS enabled on `saved_assets`.
- No auth: all CRUD open to anon + authenticated (single-device multi-profile model).
- Policies match the existing scans/profiles pattern.
*/

-- Step 1: Create saved_assets table
CREATE TABLE IF NOT EXISTS saved_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  scan_id uuid REFERENCES scans(id) ON DELETE SET NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('image', 'video')),
  title text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  thumbnail_url text,
  platform text,
  affiliate_platform text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_saved_assets" ON saved_assets;
CREATE POLICY "anon_select_saved_assets" ON saved_assets FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_saved_assets" ON saved_assets;
CREATE POLICY "anon_insert_saved_assets" ON saved_assets FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_saved_assets" ON saved_assets;
CREATE POLICY "anon_update_saved_assets" ON saved_assets FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_saved_assets" ON saved_assets;
CREATE POLICY "anon_delete_saved_assets" ON saved_assets FOR DELETE
  TO anon, authenticated USING (true);

-- Index for profile-based queries
CREATE INDEX IF NOT EXISTS saved_assets_profile_id_idx ON saved_assets (profile_id);
CREATE INDEX IF NOT EXISTS saved_assets_created_at_idx ON saved_assets (created_at DESC);

-- Step 2: Create assets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Storage policies for assets bucket
DROP POLICY IF EXISTS "anon_upload_assets" ON storage.objects;
CREATE POLICY "anon_upload_assets" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'assets');

DROP POLICY IF EXISTS "anon_read_assets" ON storage.objects;
CREATE POLICY "anon_read_assets" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'assets');

DROP POLICY IF EXISTS "anon_delete_assets" ON storage.objects;
CREATE POLICY "anon_delete_assets" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'assets');