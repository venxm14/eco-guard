-- ============================================

-- 0. SCHEMA UPDATES (Safe Migration)
DO $$ 
BEGIN 
    -- Eco Reports
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_reports' AND column_name='likes_count') THEN
        ALTER TABLE eco_reports ADD COLUMN likes_count INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_reports' AND column_name='comments_count') THEN
        ALTER TABLE eco_reports ADD COLUMN comments_count INT DEFAULT 0;
    END IF;

    -- Eco Sightings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_sightings' AND column_name='likes_count') THEN
        ALTER TABLE eco_sightings ADD COLUMN likes_count INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_sightings' AND column_name='comments_count') THEN
        ALTER TABLE eco_sightings ADD COLUMN comments_count INT DEFAULT 0;
    END IF;

    -- Eco Stories
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_stories' AND column_name='comments_count') THEN
        ALTER TABLE eco_stories ADD COLUMN comments_count INT DEFAULT 0;
    END IF;
END $$;

-- 0.1 Generic Atomic Increment Function
CREATE OR REPLACE FUNCTION increment_social_count(t_name text, c_name text, row_id text)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE %I SET %I = COALESCE(%I, 0) + 1 WHERE id = %L', t_name, c_name, c_name, row_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Ensure phone column exists in users table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
        ALTER TABLE users ADD COLUMN phone TEXT;
    END IF;
END $$;

-- 2. SOCIAL NOTIFICATIONS & INTERACTIONS (TEXT ID for Int/UUID support)
CREATE TABLE IF NOT EXISTS social_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'like', 'comment', 'repost', 'mission'
    item_id TEXT NOT NULL, -- Changed from UUID to TEXT
    item_type TEXT NOT NULL, -- 'report', 'sighting', 'story'
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure existing columns are TEXT if table already exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_notifications' AND column_name='item_id' AND data_type='uuid') THEN
        ALTER TABLE social_notifications ALTER COLUMN item_id TYPE TEXT;
    END IF;
END $$;

-- 2.1 Hardening Likes and Comments (Ensure TEXT itemId)
DO $$ 
BEGIN 
    -- social_likes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='social_likes') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_likes' AND column_name='item_id' AND data_type='uuid') THEN
            ALTER TABLE social_likes ALTER COLUMN item_id TYPE TEXT;
        END IF;
    END IF;

    -- social_comments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='social_comments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_comments' AND column_name='item_id' AND data_type='uuid') THEN
            ALTER TABLE social_comments ALTER COLUMN item_id TYPE TEXT;
        END IF;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON social_notifications(recipient_id) WHERE is_read = FALSE;

-- 3. RLS POLICIES FOR NOTIFICATIONS
ALTER TABLE social_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own notifications') THEN
        CREATE POLICY "Users can view own notifications" 
            ON social_notifications FOR SELECT 
            USING (auth.uid() = recipient_id);
    END IF;
END $$;

-- System (Admin Client) will handle inserts via triggers/code
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can managed notifications') THEN
        CREATE POLICY "System can managed notifications" 
            ON social_notifications FOR ALL 
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
