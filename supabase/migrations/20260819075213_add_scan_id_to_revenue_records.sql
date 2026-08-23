/*
# Add scan_id to revenue_records

## Purpose
Link revenue records to individual content (scans) so users can track which content earned how much.

## Changes
1. Add scan_id column to revenue_records (nullable uuid, references scans.id)
   - Existing revenue records remain valid without scan_id
   - New revenue records can be linked to a specific scan
2. Index on scan_id for dashboard query performance
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'revenue_records' AND column_name = 'scan_id'
  ) THEN
    ALTER TABLE revenue_records ADD COLUMN scan_id uuid REFERENCES scans(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_revenue_records_scan_id ON revenue_records(scan_id);
