/*
# Add Brand Persona & Smart Auto-Publish Settings

## Purpose
Adds new columns to `user_settings` for the Brand Persona automation section
and the Smart Affiliate & SNS Auto-Publish sandbox section in the Settings tab.

## New Columns on `user_settings`
1. `default_caption_tone` (text) — Default caption tone & manner for AI-generated content
   (e.g. "casual", "professional", "emotional", "humorous")
2. `fixed_hook_phrase` (text) — A fixed 3-second hook phrase that is always prepended to generated videos
3. `affiliate_priority_mapping` (boolean, default false) — Toggle: prioritize affiliate links with highest commission when auto-routing
4. `auto_publish_reels` (boolean, default false) — Auto-schedule Reels uploads (sandbox)
5. `auto_publish_tiktok` (boolean, default false) — Auto-schedule TikTok uploads (sandbox)
6. `auto_publish_shorts` (boolean, default false) — Auto-schedule YouTube Shorts uploads (sandbox)
7. `auto_publish_sandbox_mode` (boolean, default true) — When true, auto-publish runs in sandbox (no real upload, simulation only)

## Security
- No new tables created. Only additive columns on existing `user_settings`.
- RLS already enabled on `user_settings` with existing policies. No policy changes needed.
- All columns are nullable / have safe defaults. No data loss risk.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'default_caption_tone') THEN
    ALTER TABLE user_settings ADD COLUMN default_caption_tone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'fixed_hook_phrase') THEN
    ALTER TABLE user_settings ADD COLUMN fixed_hook_phrase text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'affiliate_priority_mapping') THEN
    ALTER TABLE user_settings ADD COLUMN affiliate_priority_mapping boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'auto_publish_reels') THEN
    ALTER TABLE user_settings ADD COLUMN auto_publish_reels boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'auto_publish_tiktok') THEN
    ALTER TABLE user_settings ADD COLUMN auto_publish_tiktok boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'auto_publish_shorts') THEN
    ALTER TABLE user_settings ADD COLUMN auto_publish_shorts boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'auto_publish_sandbox_mode') THEN
    ALTER TABLE user_settings ADD COLUMN auto_publish_sandbox_mode boolean NOT NULL DEFAULT true;
  END IF;
END $$;
