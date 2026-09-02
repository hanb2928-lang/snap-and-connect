/*
# Add POS integration fields to inventory_items

## Purpose
Extends the existing inventory_items table with pricing and menu visibility fields
so it can function as a POS-connected menu/inventory source for the marketing
short-form pipeline. This enables automatic price/special reflecting in 15-second
short-form templates without manual typing.

## Changes
1. New columns on `inventory_items`:
   - `price` (integer, nullable): current selling price in KRW
   - `original_price` (integer, nullable): regular price before discount (for special/마감 세일)
   - `is_today_menu` (boolean, default false): marks items featured as today's recommended menu
   - `is_closing_sale` (boolean, default false): auto-set true when quantity drops below threshold
   - `auto_shortform` (boolean, default false): when true, auto-generates a short-form prompt on low stock

2. No new tables.
3. No RLS policy changes — existing policies on inventory_items remain intact.
4. Safe to re-run (uses IF NOT EXISTS pattern via DO block).
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'price') THEN
    ALTER TABLE inventory_items ADD COLUMN price integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'original_price') THEN
    ALTER TABLE inventory_items ADD COLUMN original_price integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'is_today_menu') THEN
    ALTER TABLE inventory_items ADD COLUMN is_today_menu boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'is_closing_sale') THEN
    ALTER TABLE inventory_items ADD COLUMN is_closing_sale boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'auto_shortform') THEN
    ALTER TABLE inventory_items ADD COLUMN auto_shortform boolean NOT NULL DEFAULT false;
  END IF;
END $$;
