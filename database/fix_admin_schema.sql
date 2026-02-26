-- Comprehensive DB Fix for Admin Panel
-- Run this in Supabase SQL Editor to fix the "Bad Request" errors

-- 1. Add 'severity' column (Critical, High, Medium, Low)
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS severity VARCHAR(50);

-- 2. Add 'featured' column (for approved reports)
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;

-- 3. Add 'reviewed_by' column (to track which admin reviewed it)
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);

-- 4. Add 'reviewed_at' column (timestamp of review)
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- 5. Add 'status' column if it doesn't exist (pending, approved, rejected)
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- 6. Add 'deleted_at' column (for soft delete)
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 7. Add 'user_id' column if missing (links report to user)
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Verify all columns exist
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'eco_reports'
AND column_name IN ('severity', 'featured', 'reviewed_by', 'reviewed_at', 'status', 'deleted_at', 'user_id');
