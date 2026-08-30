/*
# Weather-Triggered Emergency Marketing Automation

## Purpose
When sudden rain, cold snaps, or snow hits near the store, the app automatically
detects the weather change and fires a push alert prompting the owner to send a
weather-specific "emergency deal" shortform (e.g. "따뜻한 어묵탕+소주 특가"
on a rainy day). The owner taps one button and lands in marketing.tsx with a
pre-filled weather-appropriate hook and prompt.

## New Tables

### weather_alert_settings (singleton, id=1)
- `id` (int PK, default 1)
- `enabled` (boolean, default false — master toggle)
- `store_latitude` (float8, nullable — store location latitude)
- `store_longitude` (float8, nullable — store location longitude)
- `store_name` (text, nullable — store name for prompt personalization)
- `rain_alert_enabled` (boolean, default true — trigger on rain/snow)
- `cold_snap_threshold` (float8, default 0.0 — trigger when temp drops below this °C)
- `heat_wave_threshold` (float8, default 35.0 — trigger when temp exceeds this °C)
- `last_weather_check` (timestamptz, nullable — debounce: don't re-alert within 2h)
- `last_alert_type` (text, nullable — last triggered weather type, to avoid duplicates)
- `updated_at` (timestamptz, default now())

### weather_alerts
- `id` (uuid PK)
- `alert_type` (text, not null — 'rain' | 'snow' | 'cold_snap' | 'heat_wave')
- `title` (text, not null)
- `body` (text, not null)
- `hook_phrase` (text, nullable — pre-filled hook for marketing.tsx)
- `prompt_text` (text, nullable — pre-filled marketing prompt)
- `temperature` (float8, nullable — current temp at trigger time)
- `precipitation` (float8, nullable — current precipitation mm)
- `weather_code` (int, nullable — WMO weather code from API)
- `is_read` (boolean, default false)
- `is_acted_on` (boolean, default false)
- `triggered_at` (timestamptz, default now())
- `read_at` (timestamptz, nullable)

## Security
- Single-tenant app (no auth, no user_id). RLS enabled.
- Policies: TO anon, authenticated with USING(true)/WITH CHECK(true).

## Indexes
- weather_alerts: is_read + triggered_at DESC for unread listing
*/

CREATE TABLE IF NOT EXISTS weather_alert_settings (
  id int PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT false,
  store_latitude double precision,
  store_longitude double precision,
  store_name text,
  rain_alert_enabled boolean NOT NULL DEFAULT true,
  cold_snap_threshold double precision NOT NULL DEFAULT 0.0,
  heat_wave_threshold double precision NOT NULL DEFAULT 35.0,
  last_weather_check timestamptz,
  last_alert_type text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE weather_alert_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_weather_settings" ON weather_alert_settings;
CREATE POLICY "anon_select_weather_settings" ON weather_alert_settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_weather_settings" ON weather_alert_settings;
CREATE POLICY "anon_insert_weather_settings" ON weather_alert_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_weather_settings" ON weather_alert_settings;
CREATE POLICY "anon_update_weather_settings" ON weather_alert_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO weather_alert_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS weather_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  hook_phrase text,
  prompt_text text,
  temperature double precision,
  precipitation double precision,
  weather_code int,
  is_read boolean NOT NULL DEFAULT false,
  is_acted_on boolean NOT NULL DEFAULT false,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE weather_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_weather_alerts" ON weather_alerts;
CREATE POLICY "anon_select_weather_alerts" ON weather_alerts FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_weather_alerts" ON weather_alerts;
CREATE POLICY "anon_insert_weather_alerts" ON weather_alerts FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_weather_alerts" ON weather_alerts;
CREATE POLICY "anon_update_weather_alerts" ON weather_alerts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_weather_alerts" ON weather_alerts;
CREATE POLICY "anon_delete_weather_alerts" ON weather_alerts FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_weather_alerts_unread
  ON weather_alerts (is_read, triggered_at DESC);