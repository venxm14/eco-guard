-- ============================================
-- Goa Eco-Guard: NewFeatures Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. ECO STORIES (Impact Gallery)
CREATE TABLE IF NOT EXISTS eco_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    before_image TEXT,   -- Supabase Storage public URL
    after_image TEXT,    -- Supabase Storage public URL
    likes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ECO SIGHTINGS (Biodiversity Tracker)
CREATE TABLE IF NOT EXISTS eco_sightings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    species_name TEXT NOT NULL,
    description TEXT,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    location TEXT,
    image_url TEXT,       -- Supabase Storage public URL
    status TEXT DEFAULT 'verified',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Allow public read access (adjust based on your RLS policies)
ALTER TABLE eco_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco_sightings ENABLE ROW LEVEL SECURITY;

-- Public read for stories
CREATE POLICY "Public can read stories"
    ON eco_stories FOR SELECT
    USING (true);

-- Authenticated users can insert stories
CREATE POLICY "Authenticated users can create stories"
    ON eco_stories FOR INSERT
    WITH CHECK (true);

-- Anyone can update likes (for the like button)
CREATE POLICY "Anyone can update story likes"
    ON eco_stories FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Public read for sightings
CREATE POLICY "Public can read sightings"
    ON eco_sightings FOR SELECT
    USING (true);

-- Authenticated users can insert sightings
CREATE POLICY "Authenticated users can create sightings"
    ON eco_sightings FOR INSERT
    WITH CHECK (true);
