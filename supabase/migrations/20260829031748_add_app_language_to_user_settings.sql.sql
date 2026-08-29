/*
# Add app_language column to user_settings

1. Modified Tables
- `user_settings`: adds `app_language` column (text, nullable) to store the user's preferred app interface language.
  Values: 'ko', 'en', 'ja', 'vi', 'es', 'zh'. NULL means use system default.

2. Security
- No RLS policy changes needed — existing policies on user_settings already cover the new column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'app_language'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN app_language text;
  END IF;
END $$;
