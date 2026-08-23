/*
# Add openai_api_key column to user_settings

1. Modified Tables
- `user_settings`: added `openai_api_key` (text, nullable) column
  - Stores the OpenAI API key entered by the user in the settings screen
  - The edge function reads this column to call OpenAI Vision API
  - Falls back to OPENAI_API_KEY env var if not set

2. Security
- No RLS policy changes needed — user_settings already has anon+authenticated CRUD policies (single-tenant app)
- The key is stored as plaintext text since the edge function needs to use it directly
*/

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS openai_api_key text;
