-- Fix eco_reports table: Add missing user_id column
-- Run this in Supabase SQL Editor

-- Add user_id column to eco_reports table
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_eco_reports_user_id 
ON eco_reports(user_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'eco_reports'
AND column_name = 'user_id';
