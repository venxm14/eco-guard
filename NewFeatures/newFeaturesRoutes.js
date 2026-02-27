// ============================================
// Goa Eco-Guard: NewFeatures Backend Routes
// A self-contained Express Router — plug in with:
//   app.use(require('./NewFeatures/newFeaturesRoutes'));
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

// ---------- Auth Middleware (mirrors main server.js) ----------
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

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

    if (error) { console.error('❌ NF Storage upload error:', error.message); return null; }

    const { data } = supabaseAdmin.storage.from('eco-images').getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err) {
    console.error('❌ NF uploadToSupabase error:', err.message);
    return null;
  }
}

// ---------- Haversine Distance (km) ----------
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ===============================
   1. ECO STORIES
================================ */

// GET /api/stories — paginated story feed
router.get('/api/stories', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('eco_stories')
      .select('*, users!user_id(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error fetching stories:', error);
      return res.json({ stories: [], total: 0 });
    }

    res.json({
      stories: data || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (err) {
    console.error('Stories fetch error:', err);
    res.json({ stories: [], total: 0 });
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
      const { title, description, mission_id } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      let beforeUrl = null;
      let afterUrl = null;

      if (req.files?.before_image?.[0]) {
        beforeUrl = await uploadToSupabase(req.files.before_image[0].buffer, 'stories');
      }
      if (req.files?.after_image?.[0]) {
        afterUrl = await uploadToSupabase(req.files.after_image[0].buffer, 'stories');
      }

      const insertData = {
        user_id: req.user.userId,
        title,
        description: description || null,
        mission_id: mission_id || null,
        before_image: beforeUrl,
        after_image: afterUrl
      };

      const { data, error } = await supabaseAdmin
        .from('eco_stories')
        .insert([insertData])
        .select('*, users!user_id(name)')
        .single();

      if (error) {
        console.error('❌ Story insert error:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log('✅ Story created:', data.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error('Story creation error:', err);
      res.status(500).json({ error: 'Failed to create story' });
    }
  }
);

// POST /api/stories/:id/like — increment likes
router.post('/api/stories/:id/like', async (req, res) => {
  try {
    // Fetch current count
    const { data: story, error: fetchErr } = await supabase
      .from('eco_stories')
      .select('likes_count')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    const { error } = await supabaseAdmin
      .from('eco_stories')
      .update({ likes_count: (story.likes_count || 0) + 1 })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, likes_count: (story.likes_count || 0) + 1 });
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
    const { data, error } = await supabase
      .from('eco_sightings')
      .select('*, users!user_id(name, is_verified)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching sightings:', error);
      return res.json([]);
    }
    res.json(data || []);
  } catch (err) {
    console.error('Sightings fetch error:', err);
    res.json([]);
  }
});

// POST /api/sightings — submit sighting (auth required)
router.post(
  '/api/sightings',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      const { species_name, description, latitude, longitude, location } = req.body;

      if (!species_name || !latitude || !longitude) {
        return res.status(400).json({ error: 'Species name and location are required' });
      }

      let imageUrl = null;
      if (req.file) {
        imageUrl = await uploadToSupabase(req.file.buffer, 'sightings');
      }

      const insertData = {
        user_id: req.user.userId,
        species_name,
        description: description || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        location: location || null,
        image_url: imageUrl
      };

      const { data, error } = await supabaseAdmin
        .from('eco_sightings')
        .insert([insertData])
        .select('*, users!user_id(name)')
        .single();

      if (error) {
        console.error('❌ Sighting insert error:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log('✅ Sighting created:', data.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error('Sighting creation error:', err);
      res.status(500).json({ error: 'Failed to submit sighting' });
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

    // Fetch recent critical/high severity reports from last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: reports, error } = await supabase
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

    res.json({ alerts: nearby });
  } catch (err) {
    console.error('Proximity alert error:', err);
    res.json({ alerts: [] });
  }
});

/* ===============================
   4. ADMIN MANAGEMENT
================================ */

// GET /api/admin/stories — all stories (admin)
router.get('/api/admin/stories', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { data, error } = await supabase
      .from('eco_stories')
      .select('*, users!user_id(name, email)')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/stories/:id — delete a story (admin)
router.delete('/api/admin/stories/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { error } = await supabaseAdmin.from('eco_stories').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/sightings — all sightings (admin)
router.get('/api/admin/sightings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { data, error } = await supabase
      .from('eco_sightings')
      .select('*, users!user_id(name, email)')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/sightings/:id — delete a sighting (admin)
router.delete('/api/admin/sightings/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { error } = await supabaseAdmin.from('eco_sightings').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
