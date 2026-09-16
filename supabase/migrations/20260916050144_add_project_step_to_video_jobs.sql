/*
# Add pipeline step tracking to video_jobs

1. New Types
- `project_step` enum: 'idle', 'uploading', 'rendering', 'completed', 'failed'
  Tracks the current phase of a video generation job at a finer granularity
  than the existing `status` column (which tracks Runway task state).

2. Modified Tables
- `video_jobs`: add `step` column of type `project_step`, default 'idle', NOT NULL.
  This is additive only — no existing columns are changed or removed.

3. Security
- No RLS policy changes. Existing policies on video_jobs remain unchanged.

4. Important Notes
- The `step` column is independent of `status`. `status` reflects the Runway
  API task lifecycle (PENDING/RUNNING/SUCCESS/FAILED), while `step` tracks
  the app-level pipeline phases (uploading images, rendering, etc.).
- Default 'idle' ensures existing rows and new rows start in a neutral state.
*/

DO $$ BEGIN
  CREATE TYPE public.project_step AS ENUM (
    'idle',
    'uploading',
    'rendering',
    'completed',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS step public.project_step DEFAULT 'idle' NOT NULL;
