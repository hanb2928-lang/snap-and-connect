/*
# Add tts_url column to scans table

1. Modified Tables
- `scans`: adds `tts_url` (text, nullable) to store the public URL of an auto-generated Korean TTS narration audio file.
- The TTS audio is generated automatically from the analysis hook text after a photo scan completes, uploaded to the `scans` storage bucket, and the public URL is stored here.
2. Security
- No RLS policy changes — the existing scans policies already cover the new column.
3. Important Notes
- The column is nullable so existing scan rows are unaffected.
- TTS generation is best-effort: if it fails, the column stays NULL and the user can still generate TTS manually on the result page.
*/

ALTER TABLE scans ADD COLUMN IF NOT EXISTS tts_url text;
