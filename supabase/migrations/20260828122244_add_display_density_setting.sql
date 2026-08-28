/*
# Add display_density to user_settings

1. New Column on `user_settings`
- `display_density` (text, default 'standard'): Controls screen layout density and text readability.
  - 'compact': Reduces spacing on small screens (iPhone Mini/SE) to show more info at once.
  - 'standard': Default balanced spacing.
  - 'wide': Enlarges body font and expands spacing for better readability.

2. Security
- No new tables. Existing RLS policies remain unchanged.
- Column is a user-editable preference, no security implications.

3. Notes
- Nullable text with default, so existing rows and reads work seamlessly.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'display_density') THEN
    ALTER TABLE user_settings ADD COLUMN display_density text DEFAULT 'standard';
  END IF;
END $$;
