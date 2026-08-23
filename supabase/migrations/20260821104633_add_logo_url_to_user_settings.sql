/*
# Add logo_url column to user_settings

1. Modified Tables
- `user_settings`: added `logo_url` (text, nullable) column to store the user's uploaded logo/stamp image URL.
2. Security
- No new tables. Existing RLS policies on user_settings remain unchanged.
3. Notes
- The logo_url stores the Supabase Storage public URL of the user's uploaded PNG logo/stamp.
- Used as a watermark on generated template cards, video clips, and comic content.
*/

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS logo_url text;
