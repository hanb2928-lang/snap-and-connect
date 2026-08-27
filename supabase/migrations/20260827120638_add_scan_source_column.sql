/*
# Add scan_source column to scans table

1. Changes
- Adds `scan_source` text column to `scans` table to track how the scan was created.
- Values: 'single' (단품 촬영), 'multi' (다각도 촬영), 'template' (템플릿/편집 모드).
- Defaults to 'single' for existing rows.
2. Security
- No RLS policy changes — existing policies already cover the new column.
*/

ALTER TABLE scans ADD COLUMN IF NOT EXISTS scan_source text NOT NULL DEFAULT 'single';