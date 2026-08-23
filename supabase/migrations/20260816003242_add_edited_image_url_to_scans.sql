/*
# Add edited_image_url column to scans table

1. Modified Tables
- `scans`: added `edited_image_url` (text, nullable) column
  - Stores the URL of a user-edited version of the original scan image
  - When the user uses the photo editor (crop, rotate, bg removal, overlays), the edited image is saved here
  - The original image_url remains untouched for reference

2. Security
- No RLS policy changes needed — scans already has anon+authenticated CRUD policies (single-tenant app)
*/

ALTER TABLE scans ADD COLUMN IF NOT EXISTS edited_image_url text;
