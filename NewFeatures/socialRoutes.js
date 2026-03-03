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
    const { data: existing } = await supabaseAdmin
      .from('social_likes')
      .select('id')
      .filter('user_id', 'eq', user_id)
      .filter('item_id', 'eq', item_id.toString()) // cast to string for text-based ID column
      .filter('item_type', 'eq', item_type)
      .single();

    if (existing) {
      // Unlike
      await supabaseAdmin.from('social_likes').delete().eq('id', existing.id);
      
      // Decrement count in target table
      const tableName = item_type === 'report' ? 'eco_reports' : (item_type === 'sighting' ? 'eco_sightings' : 'eco_stories');
      const { data: item } = await supabaseAdmin.from(tableName).select('likes_count').eq('id', item_id).single();
      const newCount = Math.max(0, (item?.likes_count || 1) - 1);
      await supabaseAdmin.from(tableName).update({ likes_count: newCount }).eq('id', item_id);

      return res.json({ success: true, action: 'unliked', likes_count: newCount });
    }

    // Like
    const { error: insertErr } = await supabaseAdmin.from('social_likes').insert([{ 
        user_id, 
        item_id: item_id.toString(), // ensure string storage for flexibility
        item_type 
    }]);

    if (insertErr) throw insertErr;
    
    // Increment count
    const tableName = item_type === 'report' ? 'eco_reports' : (item_type === 'sighting' ? 'eco_sightings' : 'eco_stories');
    const { data: item } = await supabaseAdmin.from(tableName).select('likes_count, user_id').eq('id', item_id).single();
    const newCount = (item?.likes_count || 0) + 1;
    await supabaseAdmin.from(tableName).update({ likes_count: newCount }).eq('id', item_id);

    // 🚀 TRIGGER NOTIFICATION
    if (item && item.user_id && item.user_id !== user_id) {
        await supabaseAdmin.from('social_notifications').insert([{
            recipient_id: item.user_id,
            actor_id: user_id,
            item_id: item_id,
            item_type: item_type,
            action_type: 'like'
        }]);
    }

    res.json({ success: true, action: 'liked', likes_count: newCount });
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
    const { data, error } = await supabaseAdmin
      .from('social_comments')
      .select('*, users!user_id(name)')
      .filter('item_id', 'eq', id.toString())
      .filter('item_type', 'eq', type)
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
      .insert([{ 
          user_id, 
          item_id: item_id.toString(), // Store as string to handle Int/UUID
          item_type, 
          text, 
          parent_id 
      }])
      .select('*, users!user_id(name)')
      .single();

    if (error) throw error;

    // 🚀 INCREMENT COMMENT COUNT ON TARGET TABLE
    try {
        const tableName = item_type === 'report' ? 'eco_reports' : (item_type === 'sighting' ? 'eco_sightings' : 'eco_stories');
        
        // Use a generic increment function if available, else manual update
        const { error: updateErr } = await supabaseAdmin.rpc('increment_social_count', { 
            t_name: tableName, 
            c_name: 'comments_count',
            row_id: item_id 
        });

        if (updateErr) {
            // Manual fallback if RPC fails
            const { data: current } = await supabase.from(tableName).select('comments_count').eq('id', item_id).single();
            const newCount = (current?.comments_count || 0) + 1;
            await supabaseAdmin.from(tableName).update({ comments_count: newCount }).eq('id', item_id);
        }

        // Trigger Notification
        const { data: item } = await supabase.from(tableName).select('user_id').eq('id', item_id).single();
        if (item && item.user_id && item.user_id !== user_id) {
            await supabaseAdmin.from('social_notifications').insert([{
                recipient_id: item.user_id,
                actor_id: user_id,
                item_id: item_id,
                item_type: item_type,
                action_type: 'comment'
            }]);
        }
    } catch (bgErr) { 
        console.error('Comment background task error:', bgErr); 
        // We don't fail the request if background tasks fail
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('Comment Post Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
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

/* ===============================
   6. USER COMMENTS & INTERACTIONS
   ================================ */

router.get('/api/social/user-comments/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. Fetch comments authored by the user
    const { data: authored } = await supabaseAdmin
      .from('social_comments')
      .select('*, users!user_id(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 2. Fetch comments on items owned by the user (Replies)
    // First find item IDs owned by user across different tables
    const { data: reports } = await supabaseAdmin.from('eco_reports').select('id').eq('user_id', userId);
    const { data: sightings } = await supabaseAdmin.from('eco_sightings').select('id').eq('user_id', userId);
    const { data: stories } = await supabaseAdmin.from('eco_stories').select('id').eq('user_id', userId);
    
    const myItemIds = [
      ...(reports || []).map(r => r.id.toString()),
      ...(sightings || []).map(s => s.id.toString()),
      ...(stories || []).map(st => st.id.toString())
    ];

    let replies = [];
    if (myItemIds.length > 0) {
      const { data: repliesData } = await supabaseAdmin
        .from('social_comments')
        .select('*, users!user_id(name)')
        .in('item_id', myItemIds)
        .neq('user_id', userId) // exclude own comments on own posts
        .order('created_at', { ascending: false });
      replies = repliesData || [];
    }

    // 3. Simple Mock for "Tags/Mentions" logic (could be expanded in future)
    // For now we look for notifications of type 'comment' for this user
    const { data: mentions } = await supabaseAdmin
      .from('social_notifications')
      .select('*, actor:actor_id(name)')
      .eq('recipient_id', userId)
      .eq('action_type', 'comment')
      .order('created_at', { ascending: false });

    // Combine and label
    const unified = [
      ...(authored || []).map(c => ({ ...c, type: 'authored' })),
      ...(replies).map(r => ({ ...r, type: 'reply' })),
      ...(mentions || []).map(m => ({ ...m, type: 'notification', text: `Replying to your ${m.item_type}` }))
    ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(unified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
