// ============================================
// Goa Eco-Guard: NewFeatures Backend Routes
// ============================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

// ---------- Supabase Clients ----------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

// ---------- Multer (memory) ----------
const upload = multer({ storage: multer.memoryStorage() });

// ---------- Auth Middleware ----------
const { authenticateToken } = require('../authMiddleware');

// ---------- Supabase Storage Helper ----------
async function uploadToSupabase(buffer, folder, width = 1200, height = 800) {
  try {
    const fileName = `${folder}/${Date.now()}.jpg`;
    const jpegBuffer = await sharp(buffer)
      .resize(width, height, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();

    const { error } = await supabaseAdmin.storage
      .from('eco-images')
      .upload(fileName, jpegBuffer, { contentType: 'image/jpeg', upsert: false });

    if (error) { 
      console.error('❌ Storage upload error:', error.message); 
      return null; 
    }

    const { data } = supabaseAdmin.storage.from('eco-images').getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err) {
    console.error('❌ uploadToSupabase error:', err.message);
    return null;
  }
}

/* ===============================
   1. ECO STORIES
================================ */

// GET /api/stories — paginated story feed
// In newFeaturesRoutes.js - update the GET /api/stories endpoint

router.get('/api/stories', async (req, res) => {
  try {
    console.log('📖 Fetching stories with admin client...');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // First, get the stories without the join to see raw data
    const { data: rawData, error: rawError } = await supabaseAdmin
      .from('eco_stories')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (rawError) {
      console.error('❌ Error fetching raw stories:', rawError);
      return res.status(500).json({ error: rawError.message });
    }

    console.log(`✅ Raw stories fetched: ${rawData?.length || 0}`);
    if (rawData && rawData.length > 0) {
      console.log('Sample raw story - user_id:', rawData[0].user_id);
    }

    // Now try with join for user data
    const { data: joinedData, error: joinedError } = await supabaseAdmin
      .from('eco_stories')
      .select(`
        *,
        users!user_id (
          id,
          name,
          email,
          is_verified
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from('eco_stories')
      .select('*', { count: 'exact', head: true });

    // Use raw data if join fails, otherwise use joined data
    let stories = rawData || [];
    
    // If join succeeded, use that data
    if (!joinedError && joinedData) {
      stories = joinedData;
    }

    res.json({
      stories: stories,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
      debug: {
        raw_count: rawData?.length || 0,
        joined_count: joinedData?.length || 0,
        raw_sample: rawData?.[0] ? {
          id: rawData[0].id,
          user_id: rawData[0].user_id,
          title: rawData[0].title
        } : null
      }
    });
  } catch (err) {
    console.error('❌ Stories fetch error:', err);
    res.status(500).json({ 
      error: err.message,
      stories: [], 
      total: 0 
    });
  }
});

// POST /api/stories — create a story (auth required)
router.post(
  '/api/stories',
  authenticateToken,
  upload.fields([
    { name: 'before_image', maxCount: 1 },
    { name: 'after_image', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      console.log('📝 Creating new story for user:', req.user?.userId);
      
      const { title, description, mission_id } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      if (!req.user || !req.user.userId) {
        console.error('❌ No user ID in request');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      let beforeUrl = null;
      let afterUrl = null;

      if (req.files?.before_image?.[0]) {
        beforeUrl = await uploadToSupabase(req.files.before_image[0].buffer, 'stories');
        console.log('✅ Before image uploaded');
      }
      if (req.files?.after_image?.[0]) {
        afterUrl = await uploadToSupabase(req.files.after_image[0].buffer, 'stories');
        console.log('✅ After image uploaded');
      }

      const insertData = {
        user_id: req.user.userId,
        title,
        description: description || null,
        mission_id: mission_id || null,
        before_image: beforeUrl,
        after_image: afterUrl,
        likes_count: 0,
        comments_count: 0
      };

      console.log('📤 Inserting story data');

      const { data, error } = await supabaseAdmin
        .from('eco_stories')
        .insert([insertData])
        .select(`
          *,
          users!user_id (
            id,
            name,
            email,
            is_verified
          )
        `)
        .single();

      if (error) {
        console.error('❌ Story insert error:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log('✅ Story created successfully:', data.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error('❌ Story creation error:', err);
      res.status(500).json({ error: 'Failed to create story: ' + err.message });
    }
  }
);

// POST /api/stories/:id/like — increment likes
router.post('/api/stories/:id/like', authenticateToken, async (req, res) => {
  try {
    const { data: story, error: fetchErr } = await supabaseAdmin
      .from('eco_stories')
      .select('likes_count')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    const newCount = (story.likes_count || 0) + 1;
    
    const { error } = await supabaseAdmin
      .from('eco_stories')
      .update({ likes_count: newCount })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, likes_count: newCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to like story' });
  }
});

/* ===============================
   2. SIGHTING REPORTS
================================ */

// GET /api/sightings — all sightings for map layer
router.get('/api/sightings', async (req, res) => {
  try {
    console.log('🦎 Fetching sightings...');
    
    const { data, error } = await supabaseAdmin
      .from('eco_sightings')
      .select(`
        *,
        users!user_id (
          id,
          name,
          email,
          is_verified
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching sightings:', error);
      return res.status(500).json({ 
        error: error.message,
        sightings: [] 
      });
    }

    console.log(`✅ Successfully fetched ${data?.length || 0} sightings`);
    res.json(data || []);
  } catch (err) {
    console.error('❌ Sightings fetch error:', err);
    res.status(500).json({ 
      error: err.message,
      sightings: [] 
    });
  }
});

// POST /api/sightings — submit sighting (auth required)
router.post(
  '/api/sightings',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      console.log('📝 Creating new sighting for user:', req.user?.userId);
      
      const { species_name, description, latitude, longitude, location } = req.body;

      if (!species_name) {
        return res.status(400).json({ error: 'Species name is required' });
      }
      
      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Location coordinates are required' });
      }

      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      let imageUrl = null;
      if (req.file) {
        imageUrl = await uploadToSupabase(req.file.buffer, 'sightings');
        console.log('✅ Sighting image uploaded');
      }

      const insertData = {
        user_id: req.user.userId,
        species_name,
        description: description || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        location: location || null,
        image_url: imageUrl,
        likes_count: 0,
        comments_count: 0
      };

      const { data, error } = await supabaseAdmin
        .from('eco_sightings')
        .insert([insertData])
        .select(`
          *,
          users!user_id (
            id,
            name,
            email,
            is_verified
          )
        `)
        .single();

      if (error) {
        console.error('❌ Sighting insert error:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log('✅ Sighting created successfully:', data.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error('❌ Sighting creation error:', err);
      res.status(500).json({ error: 'Failed to submit sighting: ' + err.message });
    }
  }
);

/* ===============================
   3. PROXIMITY ALERTS
================================ */

// GET /api/alerts/nearby — check critical reports near user
router.get('/api/alerts/nearby', async (req, res) => {
  try {
    const userLat = parseFloat(req.query.lat);
    const userLng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radius) || 5;

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ error: 'lat and lng query params required' });
    }

    // Haversine formula
    function haversineKm(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Fetch recent critical/high severity reports from last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: reports, error } = await supabaseAdmin
      .from('eco_reports')
      .select('id, location, latitude, longitude, description, severity, status, created_at')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .is('deleted_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Proximity query error:', error);
      return res.json({ alerts: [] });
    }

    // Filter by distance using Haversine
    const nearby = (reports || [])
      .map(r => ({
        ...r,
        distance_km: haversineKm(userLat, userLng, r.latitude, r.longitude)
      }))
      .filter(r => r.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km);

    console.log(`📍 Found ${nearby.length} nearby alerts within ${radiusKm}km`);
    res.json({ alerts: nearby });
  } catch (err) {
    console.error('❌ Proximity alert error:', err);
    res.json({ alerts: [] });
  }
});

module.exports = router;