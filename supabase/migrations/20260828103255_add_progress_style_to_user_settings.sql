/*
# Add progress_style column to user_settings

1. New Column on `user_settings`
- `progress_style` (text, default 'circular') — 진행 상태 표시 스타일
  Values: 'circular' (원형 회전형), 'baby-run' (아기 달리기형), 'status-bar' (실시간 상태 바형)

2. Notes
- Nullable-safe with default so existing rows and new inserts work without changes.
- No RLS changes needed — existing policies already cover the new column.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'progress_style') THEN
    ALTER TABLE user_settings ADD COLUMN progress_style text DEFAULT 'circular';
  END IF;
END $$;
