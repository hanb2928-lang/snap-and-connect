/*
# Add additional_image_urls column to scans table

## Description
The scans table is missing the `additional_image_urls` column that the frontend
expects when saving multi-shot scan results. The migration file
20260822084239_add_additional_image_urls_to_scans.sql exists on disk but was
never applied to the live database, causing INSERT/UPDATE failures with
"column additional_image_urls does not exist" whenever a multi-shot scan
is saved.

## Changes
1. Adds `additional_image_urls` column (text[], nullable, default empty array)
   to the `scans` table.
2. Backfills existing rows with an empty array so the column is never NULL.

## Security
- No RLS or policy changes. Existing policies remain intact.
*/

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS additional_image_urls text[] DEFAULT '{}'::text[];

UPDATE public.scans
  SET additional_image_urls = '{}'::text[]
  WHERE additional_image_urls IS NULL;
