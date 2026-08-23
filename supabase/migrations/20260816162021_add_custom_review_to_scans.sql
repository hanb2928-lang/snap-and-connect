/*
# Add custom_review column to scans table

## Summary
Adds a `custom_review` jsonb column to the `scans` table so users can
save their own usage review text for the Instagram feed template.

## Changes
- `scans` — added `custom_review` (jsonb, default '{}'::jsonb)
  - Structure: { "text": string, "rating": number, "updatedAt": string }

## Security
- No security changes. RLS policies on `scans` remain unchanged.
- The existing anon/authenticated CRUD policies cover this new column.
*/

ALTER TABLE scans ADD COLUMN IF NOT EXISTS custom_review jsonb NOT NULL DEFAULT '{}'::jsonb;