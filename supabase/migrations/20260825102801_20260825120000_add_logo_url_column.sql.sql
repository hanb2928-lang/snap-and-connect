-- Add logo_url column to user_settings (migration was missing from applied list)
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS logo_url text;
