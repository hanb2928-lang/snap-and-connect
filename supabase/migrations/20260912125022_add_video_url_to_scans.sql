/*
# Add video_url column to scans table

1. Changes
- Add `video_url` (text, nullable) to `scans` table to store the AI-generated commercial video URL.
- This enables Zero-Touch auto-play: when a user revisits a result page, the previously generated AI video loads and auto-plays without requiring manual regeneration.
2. Security
- No RLS policy changes needed — the column inherits existing scan-level RLS policies.
- No new tables created.
3. Notes
- Column is nullable so existing scan rows are unaffected.
- The generate-video edge function already calls `updateScanWithVideo` which writes to this column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scans' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE scans ADD COLUMN video_url text;
  END IF;
END $$;
