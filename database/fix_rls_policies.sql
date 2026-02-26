-- Fix RLS (Row Level Security) policies for eco_reports table
-- Run this in Supabase SQL Editor if you don't want to use service role key

-- Option 1: Allow anyone to insert reports (less secure, but works)
CREATE POLICY "Allow public inserts to eco_reports"
ON eco_reports FOR INSERT
WITH CHECK (true);

-- Option 2: Allow authenticated users to insert their own reports (more secure)
-- This requires auth.uid() to match user_id
CREATE POLICY "Users can insert their own reports"
ON eco_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Option 3: Disable RLS entirely (not recommended for production)
-- ALTER TABLE eco_reports DISABLE ROW LEVEL SECURITY;

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'eco_reports';
