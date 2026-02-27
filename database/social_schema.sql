-- ============================================
-- Goa Eco-Guard: Social Engine Schema
-- ============================================

-- 1. LIKES TABLE (Twitter-style one-like-per-user)
CREATE TABLE IF NOT EXISTS social_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type TEXT NOT NULL, -- 'report', 'sighting', 'story'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, item_id, item_type) -- Ensures only one like per user per item
);

-- 2. COMMENTS TABLE (Supports threaded replies)
CREATE TABLE IF NOT EXISTS social_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type TEXT NOT NULL, -- 'report', 'sighting', 'story'
    parent_id UUID REFERENCES social_comments(id) ON DELETE CASCADE, -- For threaded replies
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FOLLOW SYSTEM
CREATE TABLE IF NOT EXISTS social_follows (
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- 4. REPOSTS (Eco-Reposts)
CREATE TABLE IF NOT EXISTS social_reposts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_item_id UUID NOT NULL,
    item_type TEXT NOT NULL,
    commentary TEXT, -- Added thoughts when reposting
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. UPDATE EXISTING TABLES
-- Add likes_count to reports if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_reports' AND column_name='likes_count') THEN
        ALTER TABLE eco_reports ADD COLUMN likes_count INT DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_sightings' AND column_name='likes_count') THEN
        ALTER TABLE eco_sightings ADD COLUMN likes_count INT DEFAULT 0;
    END IF;

    -- Add verified badge to users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_verified') THEN
        ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 6. RLS POLICIES
ALTER TABLE social_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_reposts ENABLE ROW LEVEL SECURITY;

-- Select: Anyone can view
CREATE POLICY "Public read social_likes" ON social_likes FOR SELECT USING (true);
CREATE POLICY "Public read social_comments" ON social_comments FOR SELECT USING (true);
CREATE POLICY "Public read social_follows" ON social_follows FOR SELECT USING (true);
CREATE POLICY "Public read social_reposts" ON social_reposts FOR SELECT USING (true);

-- Insert: Authenticated users only
CREATE POLICY "Auth insert social_likes" ON social_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth insert social_comments" ON social_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth insert social_follows" ON social_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Auth insert social_reposts" ON social_reposts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Delete: Owners only (for unliking/unfollowing)
CREATE POLICY "Owner delete social_likes" ON social_likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Owner delete social_follows" ON social_follows FOR DELETE USING (auth.uid() = follower_id);
