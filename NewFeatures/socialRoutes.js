// ============================================
// Goa Eco-Guard: Social Engine Routes
// Handles Likes, Comments, Followers, and Reposts
// ============================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

// ---------- Auth Middleware ----------
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

/* ===============================
   1. LIKES (Twitter-style)
================================ */

router.post('/api/social/like', authenticateToken, async (req, res) => {
  try {
    const { item_id, item_type } = req.body;
    const user_id = req.user.userId;

    // 1. Check if already liked
    const { data: existing } = await supabase
      .from('social_likes')
      .select('id')
      .eq('user_id', user_id)
      .eq('item_id', item_id)
      .eq('item_type', item_type)
      .single();

    if (existing) {
      // Unlike
      await supabaseAdmin.from('social_likes').delete().eq('id', existing.id);
      
      // Decrement count in target table
      const tableName = item_type === 'report' ? 'eco_reports' : (item_type === 'sighting' ? 'eco_sightings' : 'eco_stories');
      const { data: item } = await supabase.from(tableName).select('likes_count').eq('id', item_id).single();
      await supabaseAdmin.from(tableName).update({ likes_count: Math.max(0, (item.likes_count || 1) - 1) }).eq('id', item_id);

      return res.json({ success: true, action: 'unliked', likes_count: Math.max(0, (item.likes_count || 1) - 1) });
    }

    // Like
    await supabaseAdmin.from('social_likes').insert([{ user_id, item_id, item_type }]);
    
    // Increment count
    const tableName = item_type === 'report' ? 'eco_reports' : (item_type === 'sighting' ? 'eco_sightings' : 'eco_stories');
    const { data: item } = await supabase.from(tableName).select('likes_count').eq('id', item_id).single();
    await supabaseAdmin.from(tableName).update({ likes_count: (item.likes_count || 0) + 1 }).eq('id', item_id);

    res.json({ success: true, action: 'liked', likes_count: (item.likes_count || 0) + 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   2. COMMENTS (Threaded)
================================ */

router.get('/api/social/comments/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { data, error } = await supabase
      .from('social_comments')
      .select('*, users!user_id(name)')
      .eq('item_id', id)
      .eq('item_type', type)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/social/comment', authenticateToken, async (req, res) => {
  try {
    const { item_id, item_type, text, parent_id } = req.body;
    const user_id = req.user.userId;

    const { data, error } = await supabaseAdmin
      .from('social_comments')
      .insert([{ user_id, item_id, item_type, text, parent_id }])
      .select('*, users!user_id(name)')
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   3. FOLLOW SYSTEM
================================ */

router.post('/api/social/follow', authenticateToken, async (req, res) => {
  try {
    const { following_id } = req.body;
    const follower_id = req.user.userId;

    if (follower_id === following_id) return res.status(400).json({ error: "Can't follow yourself" });

    const { data: existing } = await supabase
      .from('social_follows')
      .select('*')
      .eq('follower_id', follower_id)
      .eq('following_id', following_id)
      .single();

    if (existing) {
      await supabaseAdmin.from('social_follows').delete().eq('follower_id', follower_id).eq('following_id', following_id);
      return res.json({ success: true, action: 'unfollowed' });
    }

    await supabaseAdmin.from('social_follows').insert([{ follower_id, following_id }]);
    res.json({ success: true, action: 'followed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   4. USER PROFILES & FEED
================================ */

router.get('/api/social/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user info
    const { data: user } = await supabase.from('users').select('id, name, created_at, is_verified').eq('id', userId).single();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get stats
    const { count: followers } = await supabase.from('social_follows').select('*', { count: 'exact', head: true }).eq('following_id', userId);
    const { count: following } = await supabase.from('social_follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId);
    
    // Get feed (reports + sightings)
    const { data: reports } = await supabase.from('eco_reports').select('*').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false });
    const { data: sightings } = await supabase.from('eco_sightings').select('*').eq('user_id', userId).order('created_at', { ascending: false });

    res.json({
      user,
      stats: { followers: followers || 0, following: following || 0 },
      feed: [...(reports || []), ...(sightings || [])].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   5. REPOSTS
================================ */

router.post('/api/social/repost', authenticateToken, async (req, res) => {
  try {
    const { original_item_id, item_type, commentary } = req.body;
    const user_id = req.user.userId;

    const { data, error } = await supabaseAdmin
      .from('social_reposts')
      .insert([{ user_id, original_item_id, item_type, commentary }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
