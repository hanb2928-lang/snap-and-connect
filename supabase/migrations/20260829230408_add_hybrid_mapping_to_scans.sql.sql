-- Add hybrid_mapping JSONB column to scans table for local store + affiliate hybrid mapping
ALTER TABLE scans ADD COLUMN IF NOT EXISTS hybrid_mapping JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN scans.hybrid_mapping IS 'Hybrid mapping data combining local store context with affiliate product matches';
