/*
# Add clean_footage_enabled to user_settings

1. Modified Tables
- `user_settings`
  - New column `clean_footage_enabled` (boolean, default false)
  - When true, the app generates short-form content WITHOUT text overlays (hook phrases, captions, subtitles),
    producing pure clean footage of the store's menu and space visuals only.

2. Security
- No RLS changes. The existing user_settings policies remain unchanged.

3. Important Notes
- Default is `false` so existing users keep the current behavior (text overlays included).
- The frontend reads this setting to toggle text overlay rendering on the result/preview page.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'clean_footage_enabled'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN clean_footage_enabled boolean DEFAULT false;
  END IF;
END $$;
