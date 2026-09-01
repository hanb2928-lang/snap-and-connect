/*
# Add Pexels API Key to User Settings

1. Modified Tables
- `user_settings`: adds `pexels_api_key` column (text, nullable) to store the
  Pexels API key used by the `search-pexels-videos` edge function for
  product-themed stock video search.

2. Security
- No RLS policy changes. The column is only read server-side by edge functions
  using the service role key, never exposed to the anon client.

3. Notes
- The key is stored as plain text in `user_settings` (same pattern as the
  existing `openai_api_key` column).
- The edge function resolves the key from `Deno.env` first, then falls back
  to this column.
*/

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS pexels_api_key text;
