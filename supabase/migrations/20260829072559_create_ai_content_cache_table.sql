/*
# Create ai_content_cache table — Smart caching layer for AI-generated content

## Purpose
Caches AI-generated content (captions, hashtags, TTS audio references, reviews)
keyed by a content hash of the input. When multiple users request generation
for the same product, the cached result is returned instantly without calling
the AI API again, reducing API costs to near zero for popular products.

## New Tables
- `ai_content_cache`
  - `id` (uuid, PK)
  - `cache_key` (text, unique) — deterministic hash of task type + input
  - `task_type` (text) — e.g. 'generate-copy', 'generate-review', 'generate-tts'
  - `input_hash` (text) — hash of the raw input content
  - `result` (jsonb) — the AI-generated result to cache
  - `model_used` (text) — which AI model produced this (e.g. 'gpt-4o-mini')
  - `hit_count` (integer, default 0) — how many times this cache entry was used
  - `expires_at` (timestamptz) — 30-day TTL
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

## Security
- RLS enabled.
- Single-tenant (no auth): anon + authenticated can read all cached content.
- Only authenticated can write (server-side edge functions use service role key).
  Since this app does not have sign-in, we allow anon + authenticated for all CRUD
  so edge functions with the service role can manage cache entries.
*/

CREATE TABLE IF NOT EXISTS ai_content_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  task_type text NOT NULL,
  input_hash text NOT NULL,
  result jsonb NOT NULL,
  model_used text DEFAULT 'gpt-4o-mini',
  hit_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_content_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_cache_select_all" ON ai_content_cache;
CREATE POLICY "ai_cache_select_all" ON ai_content_cache FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "ai_cache_insert_all" ON ai_content_cache;
CREATE POLICY "ai_cache_insert_all" ON ai_content_cache FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ai_cache_update_all" ON ai_content_cache;
CREATE POLICY "ai_cache_update_all" ON ai_content_cache FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ai_cache_delete_all" ON ai_content_cache;
CREATE POLICY "ai_cache_delete_all" ON ai_content_cache FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_content_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_task_type ON ai_content_cache(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_content_cache(expires_at);
