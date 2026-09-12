/*
# Add product_vision column to scans table

1. Changes
- Add `product_vision` (jsonb, nullable) to `scans` table to cache the GPT-4o Vision API analysis result.
- This avoids re-calling the Vision API when a user revisits the result page, saving API costs and reducing latency.
2. Security
- No RLS policy changes needed — the column inherits existing scan-level RLS policies.
- No new tables created.
3. Notes
- Column is nullable so existing scan rows are unaffected.
- The analyze-product-vision edge function writes to this column after successful analysis.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scans' AND column_name = 'product_vision'
  ) THEN
    ALTER TABLE scans ADD COLUMN product_vision jsonb;
  END IF;
END $$;
