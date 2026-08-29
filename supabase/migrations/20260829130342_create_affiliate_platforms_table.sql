/*
# Create affiliate_platforms table for user-managed affiliate partner IDs

1. New Tables
- `affiliate_platforms`
  - `id` (uuid, primary key)
  - `key` (text, unique platform identifier, e.g. 'Coupang', 'Toss', 'my_custom')
  - `label` (text, display name, e.g. '쿠팡 파트너스')
  - `partners_id` (text, the user's partner/affiliate ID for this platform)
  - `tracking_param` (text, URL query parameter name for tracking, e.g. 'partner', 'tag', 'aff_id')
  - `tracking_url_template` (text, optional full URL template with {ID} and {QUERY} placeholders for search-style links)
  - `color` (text, hex color for UI)
  - `is_enabled` (boolean, whether this platform appears in affiliate tab / marketing flows)
  - `is_builtin` (boolean, true for default platforms, false for user-created)
  - `sort_order` (int, display order)
  - `created_at` (timestamptz)

2. Seed Data
- 3 builtin Korean platforms: Coupang (partner), Toss (sharelink), BrandConnect/Naver (nsh)
- 3 builtin global platforms: Amazon (tag), AliExpress (aff_short_key), Shopee (aff_id)
- All builtins seeded with is_enabled=true, partners_id empty (user fills in)

3. Security
- Enable RLS on `affiliate_platforms`
- Allow anon + authenticated full CRUD (single-tenant app, no sign-in)
*/

CREATE TABLE IF NOT EXISTS affiliate_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  partners_id text NOT NULL DEFAULT '',
  tracking_param text NOT NULL DEFAULT '',
  tracking_url_template text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#FF3E3E',
  is_enabled boolean NOT NULL DEFAULT true,
  is_builtin boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE affiliate_platforms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_affiliate_platforms" ON affiliate_platforms;
CREATE POLICY "anon_select_affiliate_platforms"
ON affiliate_platforms FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_affiliate_platforms" ON affiliate_platforms;
CREATE POLICY "anon_insert_affiliate_platforms"
ON affiliate_platforms FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_affiliate_platforms" ON affiliate_platforms;
CREATE POLICY "anon_update_affiliate_platforms"
ON affiliate_platforms FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_affiliate_platforms" ON affiliate_platforms;
CREATE POLICY "anon_delete_affiliate_platforms"
ON affiliate_platforms FOR DELETE
TO anon, authenticated USING (true);

-- Seed default affiliate platforms
INSERT INTO affiliate_platforms (key, label, partners_id, tracking_param, tracking_url_template, color, is_enabled, is_builtin, sort_order) VALUES
  ('Coupang', '쿠팡 파트너스', '', 'partner', 'https://www.coupang.com/np/search?component=&q={QUERY}&partner={ID}', '#FF3E3E', true, true, 1),
  ('Toss', '토스 쉐어링크', '', '', 'https://sharelink.toss.im/{ID}', '#0064FF', true, true, 2),
  ('BrandConnect', '네이버 브랜드커넥트', '', 'nsh', 'https://search.shopping.naver.com/search/all?query={QUERY}&nsh={ID}', '#03C75A', true, true, 3),
  ('Amazon', 'Amazon Associates', '', 'tag', '', '#FF9900', true, true, 4),
  ('AliExpress', 'AliExpress Affiliate', '', 'aff_short_key', '', '#E62E04', true, true, 5),
  ('Shopee', 'Shopee Affiliate', '', 'aff_id', '', '#EE4D2D', true, true, 6)
ON CONFLICT (key) DO NOTHING;
