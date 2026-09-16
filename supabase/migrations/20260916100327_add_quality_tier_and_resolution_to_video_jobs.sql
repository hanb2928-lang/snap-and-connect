-- Add quality tier and resolution columns to video_jobs
-- Uses IF NOT EXISTS for idempotent re-runs without duplicate column errors

ALTER TABLE video_jobs ADD COLUMN IF NOT EXISTS quality_tier TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE video_jobs ADD COLUMN IF NOT EXISTS resolution TEXT NOT NULL DEFAULT '720p';