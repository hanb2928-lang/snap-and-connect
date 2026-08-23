/*
# Add custom affiliate links to scans

## Overview
Adds a `custom_affiliate_links` jsonb column to the `scans` table.
This stores affiliate links that the creator manually pastes from Naver Brand Connect
(or any other affiliate platform), replacing the auto-generated search links in the
template card and share bar.

## Modified Tables
- `scans` — added `custom_affiliate_links` (jsonb, default '[]')
  - Each entry: { platform: string, label: string, url: string, productIndex: number }
  - `productIndex` links the affiliate URL to a specific detected product (0-based).

## Security
- No new policies needed — scans already has open CRUD for anon + authenticated.
*/

ALTER TABLE scans ADD COLUMN IF NOT EXISTS custom_affiliate_links jsonb NOT NULL DEFAULT '[]'::jsonb;
