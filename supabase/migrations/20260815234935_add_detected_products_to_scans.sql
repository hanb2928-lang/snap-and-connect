/*
# Add detected_products column to scans table

1. Modified Tables
- `scans`: added `detected_products` (jsonb, nullable, default '[]') column
  - Stores an array of DetectedProduct objects when multiple products are found in a single photo
  - Each object contains: id, productName, productCategory, priceEstimate, oneLiner, shoppingMatches, templateData
  - When only one product is detected, the array will have a single entry
  - The top-level scan fields (product_name, shopping_matches, etc.) remain for backward compatibility and represent the primary/first product

2. Security
- No RLS policy changes needed — scans already has anon+authenticated CRUD policies (single-tenant app)
*/

ALTER TABLE scans ADD COLUMN IF NOT EXISTS detected_products jsonb DEFAULT '[]'::jsonb;
