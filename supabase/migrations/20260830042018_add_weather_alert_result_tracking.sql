/*
# Add Result Tracking to Weather Alerts

## Purpose
Track the business impact of weather-triggered marketing: how many extra
visitors came, how much additional revenue was generated, and whether the
alert was converted into a published shortform.

## Changes to weather_alerts table
- `visitor_count` (int, default 0 — estimated extra visitors from the campaign)
- `revenue_impact` (int, default 0 — estimated additional revenue in KRW)
- `shortform_created` (boolean, default false — whether a shortform was generated)
- `result_note` (text, nullable — free text note about the outcome)

## Security
- No new tables. Existing RLS policies on weather_alerts cover the new columns
  since they were defined with TO anon, authenticated USING(true)/WITH CHECK(true).
*/

ALTER TABLE weather_alerts
  ADD COLUMN IF NOT EXISTS visitor_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_impact int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shortform_created boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS result_note text;