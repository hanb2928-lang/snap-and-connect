/*
# Add capture guide mode, UI performance, and theme mode to user_settings

1. New Columns on `user_settings`
- `capture_guide_mode` (text, default 'beginner'): Controls the camera tab shooting guide.
  - 'beginner': Simple single-shot mode with basic tips.
  - 'pro': Multi-angle mode with detailed shooting guide (front, side, back, detail).
- `ui_performance` (text, default 'high'): Controls glassmorphism and blur effects.
  - 'high': Full glassmorphism with blur effects (for modern devices).
  - 'lite': Flat solid backgrounds instead of blur (for older/low-end devices).
- `theme_mode` (text, default 'dark'): Controls the app's color theme.
  - 'dark': Deep dark gradient creator mode (default).
  - 'light': Bright clean mode for outdoor use or light preference.

2. Security
- No new tables. Existing RLS policies on user_settings remain unchanged.
- Columns are user-editable preferences, no security implications.

3. Notes
- All columns are nullable text with defaults, so existing rows and reads work seamlessly.
- The app reads these via the existing getUserSettings() function.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'capture_guide_mode') THEN
    ALTER TABLE user_settings ADD COLUMN capture_guide_mode text DEFAULT 'beginner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'ui_performance') THEN
    ALTER TABLE user_settings ADD COLUMN ui_performance text DEFAULT 'high';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'theme_mode') THEN
    ALTER TABLE user_settings ADD COLUMN theme_mode text DEFAULT 'dark';
  END IF;
END $$;
