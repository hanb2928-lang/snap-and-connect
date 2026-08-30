/*
# Customer Reviews, Inventory Items, and Push Alerts

## Purpose
Implements two automation modules:
1. "계산대 영수증 바이럴 루프" — customer one-line reviews collected via QR/table,
   auto-merged with store photos into Instagram-format "오늘의 단골 목격담" reels.
2. "재고·시간 연동 능동형 푸시" — inventory quantity + time-of-day conditions
   trigger push alerts that deep-link into marketing.tsx with pre-filled hooks.

## New Tables

### customer_reviews
- `id` (uuid PK)
- `reviewer_name` (text, nullable — customer can be anonymous)
- `review_text` (text, not null — one-line review e.g. "명란 비빔밥 진짜 고소하고 맛있어요!")
- `rating` (int, 1-5, default 5)
- `table_number` (text, nullable — which table/QR the review came from)
- `store_photo_url` (text, nullable — store photo to merge with review)
- `reel_asset_url` (text, nullable — generated reel asset URL, null until auto-rendered)
- `reel_status` (text, default 'pending' — pending|rendering|completed|failed)
- `is_published` (boolean, default false — whether reel has been published to saved_assets)
- `created_at` (timestamptz, default now())

### inventory_items
- `id` (uuid PK)
- `name` (text, not null — e.g. "활어", "항정살", "명란")
- `quantity` (int, not null, default 0 — current stock count)
- `unit` (text, default '개' — 개, 마리, kg, etc.)
- `low_stock_threshold` (int, default 3 — trigger alert when quantity <= this)
- `category` (text, nullable — e.g. "식재료", "사이드", "음료")
- `is_active` (boolean, default true — soft delete / deactivate)
- `last_updated` (timestamptz, default now())

### push_alerts
- `id` (uuid PK)
- `alert_type` (text, not null — 'low_stock' | 'breaktime' | 'closing_soon' | 'custom')
- `title` (text, not null — push notification title)
- `body` (text, not null — push notification body text)
- `hook_phrase` (text, nullable — pre-filled hook for marketing.tsx e.g. "마감 떨이")
- `prompt_text` (text, nullable — pre-filled prompt for marketing.tsx)
- `inventory_item_id` (uuid, nullable FK → inventory_items.id)
- `is_read` (boolean, default false — whether the owner tapped/dismissed it)
- `is_acted_on` (boolean, default false — whether owner clicked "발송하기" button)
- `triggered_at` (timestamptz, default now())
- `read_at` (timestamptz, nullable)

### inventory_alert_settings (single-row config)
- `id` (int PK, default 1 — singleton)
- `enabled` (boolean, default false — master toggle for inventory/breaktime push alerts)
- `breaktime_start` (text, default '15:00' — HH:mm format)
- `breaktime_end` (text, default '17:00')
- `closing_hour` (int, default 21 — closing time hour, 24h format)
- `closing_alert_minutes` (int, default 60 — minutes before closing to trigger alert)
- `updated_at` (timestamptz, default now())

## Security
- All tables are single-tenant (no auth, no user_id columns).
- RLS enabled on every table.
- Policies: TO anon, authenticated with USING (true) / WITH CHECK (true) —
  the data is intentionally shared/public for this single-owner app.

## Indexes
- customer_reviews: created_at DESC for listing recent reviews
- inventory_items: is_active for filtering active items
- push_alerts: is_read + triggered_at DESC for unread alert listing
*/

-- ─── customer_reviews ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_name text,
  review_text text NOT NULL,
  rating int NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  table_number text,
  store_photo_url text,
  reel_asset_url text,
  reel_status text NOT NULL DEFAULT 'pending',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reviews" ON customer_reviews;
CREATE POLICY "anon_select_reviews" ON customer_reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reviews" ON customer_reviews;
CREATE POLICY "anon_insert_reviews" ON customer_reviews FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reviews" ON customer_reviews;
CREATE POLICY "anon_update_reviews" ON customer_reviews FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reviews" ON customer_reviews;
CREATE POLICY "anon_delete_reviews" ON customer_reviews FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_created_at
  ON customer_reviews (created_at DESC);

-- ─── inventory_items ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  quantity int NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '개',
  low_stock_threshold int NOT NULL DEFAULT 3,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  last_updated timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_inventory" ON inventory_items;
CREATE POLICY "anon_select_inventory" ON inventory_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_inventory" ON inventory_items;
CREATE POLICY "anon_insert_inventory" ON inventory_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_inventory" ON inventory_items;
CREATE POLICY "anon_update_inventory" ON inventory_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_inventory" ON inventory_items;
CREATE POLICY "anon_delete_inventory" ON inventory_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_inventory_items_active
  ON inventory_items (is_active);

-- ─── push_alerts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  hook_phrase text,
  prompt_text text,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  is_acted_on boolean NOT NULL DEFAULT false,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE push_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_alerts" ON push_alerts;
CREATE POLICY "anon_select_alerts" ON push_alerts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_alerts" ON push_alerts;
CREATE POLICY "anon_insert_alerts" ON push_alerts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_alerts" ON push_alerts;
CREATE POLICY "anon_update_alerts" ON push_alerts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_alerts" ON push_alerts;
CREATE POLICY "anon_delete_alerts" ON push_alerts FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_push_alerts_unread
  ON push_alerts (is_read, triggered_at DESC);

-- ─── inventory_alert_settings (singleton) ───────────────────────
CREATE TABLE IF NOT EXISTS inventory_alert_settings (
  id int PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT false,
  breaktime_start text NOT NULL DEFAULT '15:00',
  breaktime_end text NOT NULL DEFAULT '17:00',
  closing_hour int NOT NULL DEFAULT 21,
  closing_alert_minutes int NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventory_alert_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_alert_settings" ON inventory_alert_settings;
CREATE POLICY "anon_select_alert_settings" ON inventory_alert_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_alert_settings" ON inventory_alert_settings;
CREATE POLICY "anon_insert_alert_settings" ON inventory_alert_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_alert_settings" ON inventory_alert_settings;
CREATE POLICY "anon_update_alert_settings" ON inventory_alert_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed singleton row
INSERT INTO inventory_alert_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;