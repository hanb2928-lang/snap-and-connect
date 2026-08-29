/*
# Add share_platform column to short_links

1. Changes
- Adds `share_platform` text column to `short_links` table to track which social platform (youtube_shorts, instagram_reels, tiktok, etc.) shared each short link.
- Defaults to NULL (existing links have no share platform recorded).
2. Security
- No RLS policy changes needed — existing policies already cover the new column.
3. Notes
- The column is nullable so existing rows are unaffected.
- Frontend will set this when generating share links for specific platforms.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'short_links' AND column_name = 'share_platform'
  ) THEN
    ALTER TABLE short_links ADD COLUMN share_platform text;
  END IF;
END $$;
