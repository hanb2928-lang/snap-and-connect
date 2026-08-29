/*
# Create custom_platforms table for user-managed marketing platforms

1. New Tables
- `custom_platforms`
  - `id` (uuid, primary key)
  - `key` (text, unique identifier, e.g. 'tiktok', 'my_blog')
  - `label` (text, display name, e.g. '틱톡')
  - `ratio` (text, aspect ratio, e.g. '9:16', '1:1', '4:5', '16:9', '2:3')
  - `width` (int, pixel width)
  - `height` (int, pixel height)
  - `color` (text, hex color for UI, e.g. '#FF0050')
  - `safe_zone_top` (int, pixels reserved at top for platform UI)
  - `safe_zone_bottom` (int, pixels reserved at bottom)
  - `safe_zone_sides` (int, pixels reserved on left/right)
  - `is_enabled` (boolean, whether platform appears in marketing tab)
  - `is_builtin` (boolean, true for 6 default platforms, false for user-created)
  - `sort_order` (int, display order)
  - `created_at` (timestamptz)

2. Seed Data
- Inserts 6 default platforms: tiktok, reels, shorts, threads, naverclip, pinterest
- All defaults are enabled and marked as builtin

3. Security
- Enable RLS on `custom_platforms`
- Allow anon + authenticated full CRUD (single-tenant app, no sign-in)
*/

CREATE TABLE IF NOT EXISTS custom_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  ratio text NOT NULL DEFAULT '9:16',
  width int NOT NULL DEFAULT 1080,
  height int NOT NULL DEFAULT 1920,
  color text NOT NULL DEFAULT '#FF0050',
  safe_zone_top int NOT NULL DEFAULT 200,
  safe_zone_bottom int NOT NULL DEFAULT 280,
  safe_zone_sides int NOT NULL DEFAULT 50,
  is_enabled boolean NOT NULL DEFAULT true,
  is_builtin boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_platforms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_custom_platforms" ON custom_platforms;
CREATE POLICY "anon_select_custom_platforms"
ON custom_platforms FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_custom_platforms" ON custom_platforms;
CREATE POLICY "anon_insert_custom_platforms"
ON custom_platforms FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_custom_platforms" ON custom_platforms;
CREATE POLICY "anon_update_custom_platforms"
ON custom_platforms FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_custom_platforms" ON custom_platforms;
CREATE POLICY "anon_delete_custom_platforms"
ON custom_platforms FOR DELETE
TO anon, authenticated USING (true);

-- Seed default platforms
INSERT INTO custom_platforms (key, label, ratio, width, height, color, safe_zone_top, safe_zone_bottom, safe_zone_sides, is_enabled, is_builtin, sort_order) VALUES
  ('tiktok', '틱톡', '9:16', 1080, 1920, '#FF0050', 220, 280, 60, true, true, 1),
  ('reels', '인스타 릴스', '9:16', 1080, 1920, '#E1306C', 200, 300, 50, true, true, 2),
  ('shorts', '유튜브 숏츠', '9:16', 1080, 1920, '#FF0000', 180, 320, 50, true, true, 3),
  ('threads', '스레드', '9:16', 1080, 1350, '#8B5CF6', 140, 160, 48, true, true, 4),
  ('naverclip', '네이버클립', '9:16', 1080, 1920, '#03C75A', 160, 240, 50, true, true, 5),
  ('pinterest', '핀터레스트', '2:3', 1000, 1500, '#E60023', 120, 180, 48, true, true, 6)
ON CONFLICT (key) DO NOTHING;
