-- Remove the scheduled_posts table and all associated policies/indexes.
-- This feature was never wired into the app UI.
DROP TABLE IF EXISTS scheduled_posts CASCADE;