/*
# Add content default settings to user_settings

1. New Columns on `user_settings`
- `default_video_duration` (text, default '15s') — 기본 영상 길이 (10s/15s/20s/30s)
- `default_tts_voice` (text, default 'alloy') — 기본 TTS 음성 (alloy/echo/verse/onyx/shimmer)
- `auto_disclosure` (boolean, default true) — 제휴 공시문 자동 포함 여부

2. Notes
- All columns are nullable-safe with defaults so existing rows and new inserts work without changes.
- No RLS changes needed — existing policies already cover the new columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'default_video_duration') THEN
    ALTER TABLE user_settings ADD COLUMN default_video_duration text DEFAULT '15s';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'default_tts_voice') THEN
    ALTER TABLE user_settings ADD COLUMN default_tts_voice text DEFAULT 'alloy';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'auto_disclosure') THEN
    ALTER TABLE user_settings ADD COLUMN auto_disclosure boolean DEFAULT true;
  END IF;
END $$;
