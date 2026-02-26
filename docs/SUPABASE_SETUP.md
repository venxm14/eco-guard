# Supabase Database Setup Guide

This guide will help you set up the required database tables in Supabase for the Goa Eco-Guard admin panel.

## Step 1: Access Supabase SQL Editor

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

## Step 2: Create the `eco_spots` Table

Copy and paste the following SQL into the SQL Editor and click **Run**:

```sql
-- Create eco_spots table
CREATE TABLE IF NOT EXISTS eco_spots (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rating DECIMAL(3,1) DEFAULT 0.0,
  location VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  price VARCHAR(100),
  features TEXT,
  details TEXT,
  image VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE eco_spots IS 'Eco-friendly spots (hotels, restaurants, places) created by admins';
```

## Step 3: Add `deleted_at` Column to `eco_reports` Table

If the `eco_reports` table doesn't have a `deleted_at` column, run this:

```sql
-- Add deleted_at column for soft delete functionality
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_eco_reports_deleted_at 
ON eco_reports(deleted_at);
```

## Step 4: Verify Tables Exist

Run this query to check if all tables are created:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('eco_spots', 'eco_reports', 'users', 'missions', 'mission_registrations', 'eco_guides');
```

## Step 5: Set Up Row Level Security (RLS) - Optional but Recommended

### For `eco_spots` table:

```sql
-- Enable RLS
ALTER TABLE eco_spots ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read eco spots (public access)
CREATE POLICY "Eco spots are viewable by everyone"
ON eco_spots FOR SELECT
USING (true);

-- Policy: Only admins can insert/update/delete
CREATE POLICY "Only admins can insert eco spots"
ON eco_spots FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Only admins can update eco spots"
ON eco_spots FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Only admins can delete eco spots"
ON eco_spots FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);
```

### For `eco_reports` table (if RLS is enabled):

```sql
-- Policy: Users can see their own reports, admins can see all
CREATE POLICY "Users can view their own reports"
ON eco_reports FOR SELECT
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);
```

## Step 6: Create a Trigger for `updated_at` (Optional)

Automatically update the `updated_at` timestamp when a row is modified:

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for eco_spots table
CREATE TRIGGER update_eco_spots_updated_at
BEFORE UPDATE ON eco_spots
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## Step 7: Test the Setup

Run these test queries to verify everything works:

```sql
-- Test: Insert a sample eco spot (you'll need to be authenticated as admin)
-- This is just for testing - you can delete it later
INSERT INTO eco_spots (name, rating, location, description, category, price, features, details)
VALUES (
  'Eco-Luxury Beach Resort',
  4.8,
  'Agonda Beach',
  'Solar-powered beachfront resort with organic gardens, rainwater harvesting, and zero-waste practices.',
  'Hotel',
  'From ₹8,000/night',
  'Solar Energy, Organic Gardens, Zero Waste',
  '100% renewable energy, Local sourcing'
);

-- Test: Check if the record was inserted
SELECT * FROM eco_spots WHERE name = 'Eco-Luxury Beach Resort';

-- Test: Check if deleted_at column exists in eco_reports
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'eco_reports' 
AND column_name = 'deleted_at';
```

## Alternative: Using Supabase Table Editor (GUI)

If you prefer using the visual interface:

### Create `eco_spots` Table:

1. Go to **Table Editor** in Supabase dashboard
2. Click **New Table**
3. Name it: `eco_spots`
4. Add columns one by one:
   - `id` - Type: `int8` (bigint), Primary Key, Default: `auto-increment`
   - `name` - Type: `varchar`, Length: `255`, Not Null
   - `rating` - Type: `numeric`, Precision: `3`, Scale: `1`, Default: `0.0`
   - `location` - Type: `varchar`, Length: `255`, Not Null
   - `description` - Type: `text`
   - `category` - Type: `varchar`, Length: `100`, Not Null
   - `price` - Type: `varchar`, Length: `100`
   - `features` - Type: `text`
   - `details` - Type: `text`
   - `image` - Type: `varchar`, Length: `255`
   - `created_at` - Type: `timestamptz`, Default: `now()`
   - `updated_at` - Type: `timestamptz`, Default: `now()`
5. Click **Save**

### Add `deleted_at` to `eco_reports`:

1. Go to **Table Editor**
2. Select the `eco_reports` table
3. Click **Add Column**
4. Name: `deleted_at`
5. Type: `timestamptz`
6. Click **Save**

## Troubleshooting

### If you get permission errors:
- Make sure you're logged in as the project owner
- Check that RLS policies are set correctly
- Verify your user role is 'admin' in the users table

### If tables don't appear:
- Refresh the Supabase dashboard
- Check the SQL Editor for any error messages
- Verify you're in the correct project

### If RLS is blocking access:
- Temporarily disable RLS to test: `ALTER TABLE eco_spots DISABLE ROW LEVEL SECURITY;`
- Remember to re-enable it after testing

## Quick Setup Script (All-in-One)

If you want to run everything at once, use this complete script:

```sql
-- ============================================
-- COMPLETE SETUP SCRIPT FOR GOA ECO-GUARD
-- ============================================

-- 1. Create eco_spots table
CREATE TABLE IF NOT EXISTS eco_spots (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rating DECIMAL(3,1) DEFAULT 0.0,
  location VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  price VARCHAR(100),
  features TEXT,
  details TEXT,
  image VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add deleted_at to eco_reports
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 3. Create index for deleted_at
CREATE INDEX IF NOT EXISTS idx_eco_reports_deleted_at 
ON eco_reports(deleted_at);

-- 4. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger for eco_spots
DROP TRIGGER IF EXISTS update_eco_spots_updated_at ON eco_spots;
CREATE TRIGGER update_eco_spots_updated_at
BEFORE UPDATE ON eco_spots
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. Enable RLS (optional - uncomment if you want RLS)
-- ALTER TABLE eco_spots ENABLE ROW LEVEL SECURITY;

-- Success message
SELECT 'Database setup completed successfully!' AS status;
```

## Next Steps

After setting up the database:

1. ✅ Restart your Node.js server (`node server.js`)
2. ✅ Test the admin panel by logging in as an admin
3. ✅ Try creating an eco spot from the admin panel
4. ✅ Verify it appears on the main page in the tourist guide section

## Need Help?

If you encounter any issues:
- Check the Supabase logs in the dashboard
- Verify your `.env` file has correct `SUPABASE_URL` and `SUPABASE_KEY`
- Make sure your server is running and connected to Supabase
