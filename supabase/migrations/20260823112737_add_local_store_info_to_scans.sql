/*
# Add local_store_info column to scans table

1. Changes
- Added `local_store_info` (jsonb, nullable) to the `scans` table.
  Stores optional offline store details when the user activates "우리 동네 홍보 모드":
    - storeName: text — shop name (e.g. "카페 햇살")
    - address: text — full address (e.g. "경기 평택시 중앙로 12")
    - region: text — short region name extracted from address (e.g. "평택")
    - phone: text — contact phone number
    - todayOffer: text — today's promo (e.g. "오늘 방문 시 음료 서비스")
    - enabled: boolean — whether local store mode is active for this scan
2. Security
- No RLS policy changes. The scans table already has anon+authenticated CRUD policies.
- The new column inherits existing row-level access; no additional policy needed.
3. Notes
- Column is nullable so existing scans are unaffected.
- The frontend reads/writes this as part of the scan row's jsonb field.
*/

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS local_store_info jsonb DEFAULT NULL;
