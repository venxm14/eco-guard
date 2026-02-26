-- Add severity and featured columns to eco_reports table
-- Run this in Supabase SQL Editor

-- Add severity column
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS severity VARCHAR(20);

-- Add featured column
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'eco_reports'
AND column_name IN ('severity', 'featured');
