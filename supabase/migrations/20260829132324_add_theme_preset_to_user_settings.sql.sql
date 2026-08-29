/*
# Add theme_preset column to user_settings

1. Changes
- Adds `theme_preset` text column to `user_settings` table.
- Stores one of three color theme presets: 'cinematic-dark', 'studio-light', 'trendy-viral'.
- Defaults to 'cinematic-dark' (the current default look).
2. Security
- No RLS policy changes — existing policies on user_settings remain unchanged.
3. Notes
- The column is nullable so existing rows are not affected.
- The frontend reads this column and applies the corresponding color palette.
*/

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS theme_preset text DEFAULT 'cinematic-dark';
