/*
# Upgrade scans table with product/shopping fields + add user_settings table

## Overview
Expands the scans table with product identification, shopping match, and short-form template data.
Adds a user_settings table for storing affiliate marketing links (Coupang Partners, Naver Shopping Connect, Toss Share).

## Modified Tables
- `scans` (new columns added):
  - `product_name` (text) — identified product name from AI analysis
  - `product_category` (text) — product category (e.g. sneakers, lamp, jacket)
  - `price_estimate` (text) — estimated price range
  - `one_liner` (text) — AI-generated one-line recommendation for short-form card
  - `shopping_matches` (jsonb, default '[]') — array of shopping platform matches with product name, price, and link
  - `affiliate_links` (jsonb, default '[]') — array of generated affiliate links per platform
  - `template_data` (jsonb, default '{}') — data for rendering the short-form card template

## New Tables
- `user_settings`:
  - `id` (int, primary key, always 1 — singleton row for single-tenant app)
  - `coupang_partners_id` (text) — Coupang Partners tracking ID
  - `naver_shopping_id` (text) — Naver Shopping Connect affiliate ID
  - `toss_share_id` (text) — Toss Share link ID
  - `updated_at` (timestamptz, default now())

## Security
- RLS enabled on both tables.
- Single-tenant (no auth): all CRUD open to anon + authenticated.
*/

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS price_estimate text,
  ADD COLUMN IF NOT EXISTS one_liner text,
  ADD COLUMN IF NOT EXISTS shopping_matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS affiliate_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS template_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS user_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  coupang_partners_id text,
  naver_shopping_id text,
  toss_share_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO user_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_user_settings" ON user_settings;
CREATE POLICY "anon_select_user_settings" ON user_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_user_settings" ON user_settings;
CREATE POLICY "anon_insert_user_settings" ON user_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_user_settings" ON user_settings;
CREATE POLICY "anon_update_user_settings" ON user_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_user_settings" ON user_settings;
CREATE POLICY "anon_delete_user_settings" ON user_settings FOR DELETE
  TO anon, authenticated USING (true);
