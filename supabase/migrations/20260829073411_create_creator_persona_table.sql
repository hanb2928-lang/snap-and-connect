/*
# Create creator_persona table — Creator identity & persona profile system

## Purpose
Stores each creator's unique identity profile: signature opening/ending phrases,
tone preset, voice cloning reference, signature font/color, and caricature/logo.
This data is injected into all AI-generated content to maintain creator
individuality and avoid cookie-cutter output.

## New Tables
- `creator_persona`
  - `id` (uuid, PK)
  - `signature_opening` (text, nullable) — creator's unique opening catchphrase
  - `signature_ending` (text, nullable) — creator's unique ending greeting
  - `tone_preset` (text, not null, default 'casual') — tone style: honest/humor/emotional/expert/casual
  - `voice_clone_ref` (text, nullable) — reference to cloned voice audio file
  - `signature_font` (text, nullable) — creator's signature font style
  - `signature_color` (text, nullable) — creator's brand color (hex)
  - `caricature_url` (text, nullable) — URL to creator's caricature/sticker image
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

## Security
- RLS enabled.
- Single-tenant (no auth): anon + authenticated can read/write.
  This app does not have sign-in, so anon access is required for the frontend to work.
*/

CREATE TABLE IF NOT EXISTS creator_persona (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_opening text,
  signature_ending text,
  tone_preset text NOT NULL DEFAULT 'casual',
  voice_clone_ref text,
  signature_font text,
  signature_color text,
  caricature_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE creator_persona ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_select_all" ON creator_persona;
CREATE POLICY "persona_select_all" ON creator_persona FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "persona_insert_all" ON creator_persona;
CREATE POLICY "persona_insert_all" ON creator_persona FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "persona_update_all" ON creator_persona;
CREATE POLICY "persona_update_all" ON creator_persona FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_delete_all" ON creator_persona;
CREATE POLICY "persona_delete_all" ON creator_persona FOR DELETE
  TO anon, authenticated USING (true);
