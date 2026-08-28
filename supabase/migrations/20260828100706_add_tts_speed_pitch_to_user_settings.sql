/*
# Add TTS speed and pitch controls to user_settings

1. New Columns on `user_settings`
- `tts_speed` (real, default 1.0) — TTS 내레이션 재생 속도 (0.5 ~ 2.0)
- `tts_pitch` (integer, default 0) — TTS 피치 조절 (-12 ~ +12, OpenAI tts-1 instructions pitch shift)

2. Notes
- Both columns are nullable-safe with defaults so existing rows and new inserts work without changes.
- No RLS changes needed — existing policies already cover the new columns.
- tts_speed maps directly to OpenAI TTS `speed` parameter.
- tts_pitch is stored as a semitone offset; the edge function applies a post-processing pitch shift.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'tts_speed') THEN
    ALTER TABLE user_settings ADD COLUMN tts_speed real DEFAULT 1.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'tts_pitch') THEN
    ALTER TABLE user_settings ADD COLUMN tts_pitch integer DEFAULT 0;
  END IF;
END $$;
