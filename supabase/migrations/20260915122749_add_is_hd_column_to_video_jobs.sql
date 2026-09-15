/*
# Add is_hd column to video_jobs

## Purpose
Persist whether a video job was submitted in PRO (HD Upscale) mode so the
client and edge functions can distinguish standard vs high-resolution jobs.

## Changes
- `is_hd` (boolean, default false): true when the job was submitted with
  hdUpscale enabled (PRO quality tier).

## Security
- No new tables. Existing RLS policies on video_jobs remain unchanged.
- Column is additive — no data loss.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_jobs' AND column_name = 'is_hd') THEN
    ALTER TABLE video_jobs ADD COLUMN is_hd boolean NOT NULL DEFAULT false;
  END IF;
END $$;
