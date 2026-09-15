/*
# Add HD upgrade tracking columns to video_jobs

## Purpose
Supports the two-stage video generation pipeline:
1. Stage 1 (Draft): A low-resolution, low-frame-rate draft video is generated quickly and shown to the user.
2. Stage 2 (HD Upgrade): While the user reviews the draft, a full HD version is generated in the background. When ready, the draft is seamlessly swapped for the HD version.

## Changes
- `hd_task_id` (text, nullable): Runway task ID for the HD upgrade job.
- `hd_video_url` (text, nullable): Final HD video URL after upgrade completes.
- `hd_status` (text, default 'PENDING'): Status of the HD upgrade — PENDING, RUNNING, SUCCESS, FAILED.
- `hd_completed_at` (timestamptz, nullable): When the HD upgrade finished.

## Security
- No new tables. Existing RLS policies on video_jobs remain unchanged.
- Columns are additive — no data loss.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_jobs' AND column_name = 'hd_task_id') THEN
    ALTER TABLE video_jobs ADD COLUMN hd_task_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_jobs' AND column_name = 'hd_video_url') THEN
    ALTER TABLE video_jobs ADD COLUMN hd_video_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_jobs' AND column_name = 'hd_status') THEN
    ALTER TABLE video_jobs ADD COLUMN hd_status text NOT NULL DEFAULT 'PENDING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_jobs' AND column_name = 'hd_completed_at') THEN
    ALTER TABLE video_jobs ADD COLUMN hd_completed_at timestamptz;
  END IF;
END $$;
