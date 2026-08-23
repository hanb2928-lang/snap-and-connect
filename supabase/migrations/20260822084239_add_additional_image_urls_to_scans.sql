/*
# Add additional_image_urls column to scans

1. Modified Tables
- `scans`: Added `additional_image_urls` column (text[], nullable, default empty array).
  This stores URLs of extra angle photos taken in multi-shot mode (angles 2-4).
  The first angle remains in the existing `image_url` column for backward compatibility.

2. Security
- No RLS policy changes needed — the existing anon/authenticated policies already
  cover the new column since it's on the same table.

3. Notes
- The column is nullable with a default of '{}' (empty array) so existing rows
  and single-shot scans are unaffected.
- Multi-shot scans will store up to 3 additional angle URLs (angle 1 is in image_url).
*/

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS additional_image_urls text[] DEFAULT '{}';
