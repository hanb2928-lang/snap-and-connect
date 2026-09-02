/*
# Create content archetype tracker table

1. New Tables
- `content_archetypes` — tracks recently used comedic/creative patterns per function to enforce rotation and prevent fatigue.
  - `id` (uuid, primary key)
  - `function_name` (text, which edge function generated this)
  - `archetype_key` (text, a short identifier for the comedic pattern used, e.g. "trojan-horse-frustration", "reverse-psychology", "absurd-plot-twist")
  - `tone_profile` (jsonb, snapshot of tone drift parameters used: chaos_level, sincerity_level, cadence, meme_format)
  - `created_at` (timestamptz)

2. Purpose
- Each AI generation cycle logs the archetype it used. The next cycle queries recent archetypes and picks a different one, enforcing the "never reuse the same structural punchline pattern consecutively" mandate.
- The tone_profile JSON enables tone drift calibration over time.

3. Security
- Enable RLS on `content_archetypes`.
- This is a system-level table used by edge functions with the service role key, not directly by anon users. However, for simplicity and since edge functions use the service role key (which bypasses RLS), we still enable RLS and add permissive policies for anon+authenticated in case the frontend needs to read archetype history.
*/

CREATE TABLE IF NOT EXISTS content_archetypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  archetype_key text NOT NULL,
  tone_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_archetypes_function_created
  ON content_archetypes (function_name, created_at DESC);

ALTER TABLE content_archetypes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_archetypes" ON content_archetypes;
CREATE POLICY "anon_select_archetypes"
  ON content_archetypes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_archetypes" ON content_archetypes;
CREATE POLICY "anon_insert_archetypes"
  ON content_archetypes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_archetypes" ON content_archetypes;
CREATE POLICY "anon_delete_archetypes"
  ON content_archetypes FOR DELETE
  TO anon, authenticated USING (true);
