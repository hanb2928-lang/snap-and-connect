/*
# Add click tracking to short_links + create revenue_records table

## Overview
1. Adds `click_count` and `last_clicked_at` columns to the existing `short_links` table
   so the redirect edge function can increment a counter every time someone follows a short URL.
2. Creates a new `revenue_records` table for manually-entered affiliate revenue data.
   Users enter earnings they confirmed on each affiliate platform (Coupang, Naver, Toss, etc.)
   and the app aggregates them by platform, month, and total.

## Modified Tables
- `short_links`
  - `click_count` (integer, default 0) — incremented on each redirect
  - `last_clicked_at` (timestamptz, nullable) — timestamp of the most recent click

## New Tables
- `revenue_records`
  - `id` (uuid, primary key)
  - `profile_id` (uuid, references profiles, ON DELETE CASCADE) — which profile owns this record
  - `platform` (text, not null) — which affiliate platform: 'Coupang', 'Toss', 'BrandConnect', or custom text
  - `amount` (numeric(12,2), not null) — revenue amount in KRW
  - `period_month` (text, not null) — YYYY-MM format (e.g. '2026-08')
  - `note` (text, nullable) — optional note
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on `revenue_records`.
- No auth: all CRUD open to anon + authenticated (single-device multi-profile model).
- short_links already has open policies; only adding columns, no policy changes needed.
*/

-- Step 1: Add click tracking columns to short_links
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS last_clicked_at timestamptz;

CREATE INDEX IF NOT EXISTS short_links_click_count_idx ON short_links (click_count DESC);

-- Step 2: Create revenue_records table
CREATE TABLE IF NOT EXISTS revenue_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  amount numeric(12,2) NOT NULL,
  period_month text NOT NULL,
  note text,
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

CREATE INDEX IF NOT EXISTS revenue_records_profile_id_idx ON revenue_records (profile_id);
CREATE INDEX IF NOT EXISTS revenue_records_period_month_idx ON revenue_records (period_month DESC);