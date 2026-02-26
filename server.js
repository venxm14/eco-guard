require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Email transporter — uses Gmail App Password from .env
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const app = express();

/* ===============================
   BASIC MIDDLEWARE
================================ */
// In your backend server.js
app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5502',
    'http://localhost:3000',
    'http://localhost:5501',  // Add if using different port
    'file://'                 // Add if opening HTML file directly
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/login', express.static(path.join(__dirname, 'login')));
app.use(express.static(path.join(__dirname)));

/* ===============================
   SUPABASE
================================ */
// Public client (for reads, subject to RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Service role client (for writes, bypasses RLS)
// Use SUPABASE_SERVICE_ROLE_KEY from .env if available, otherwise fall back to SUPABASE_KEY
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

/* ===============================
   MULTER (IMAGE UPLOAD - memory storage)
================================ */
const upload = multer({ storage: multer.memoryStorage() });

/* ===============================
   SUPABASE STORAGE HELPER
================================ */
/**
 * Resize an image buffer with Sharp and upload to Supabase Storage.
 * Returns the full public URL, or null if anything fails.
 */
async function uploadToSupabase(buffer, folder, width = 1200, height = 800) {
  try {
    const fileName = `${folder}/${Date.now()}.jpg`;

    // Resize + convert to JPEG
    const jpegBuffer = await sharp(buffer)
      .resize(width, height, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Upload to Supabase Storage bucket 'eco-images'
    const { error } = await supabaseAdmin.storage
      .from('eco-images')
      .upload(fileName, jpegBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (error) {
      console.error('❌ Supabase Storage upload error:', error.message);
      return null;
    }

    // Build the public URL
    const { data } = supabaseAdmin.storage
      .from('eco-images')
      .getPublicUrl(fileName);

    console.log('✅ Image uploaded to Supabase Storage:', data.publicUrl);
    return data.publicUrl;
  } catch (err) {
    console.error('❌ uploadToSupabase error:', err.message);
    return null;
  }
}

/* ===============================
   AUTH MIDDLEWARE
================================ */
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }
  next();
};

/* ===============================
   EMAIL HELPER
================================ */
async function sendMissionEmail({ name, email, missionTitle, missionDate, missionLocation, missionDescription }) {
  const formattedDate = new Date(missionDate).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const mailOptions = {
    from: `"Goa Eco-Guard" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Mission Confirmed: ${missionTitle} — Goa Eco-Guard 🌿`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mission Confirmed</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; background: #ecfdf5; margin: 0; padding: 24px 16px; }
    .wrapper { max-width: 620px; margin: 0 auto; }
    .header { background: linear-gradient(145deg, #14532d 0%, #166534 50%, #15803d 100%); border-radius: 16px 16px 0 0; padding: 44px 36px 36px; text-align: center; position: relative; overflow: hidden; }
    .header-pattern { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.07) 0%, transparent 40%); }
    .header-icon { font-size: 52px; margin-bottom: 14px; display: block; position: relative; }
    .header h1 { color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 6px; position: relative; }
    .header-tagline { color: #86efac; font-size: 13.5px; font-weight: 500; position: relative; }
    .confirmed-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); color: #ffffff; font-size: 12px; font-weight: 700; padding: 5px 14px; border-radius: 20px; letter-spacing: 0.8px; text-transform: uppercase; margin-top: 16px; position: relative; }
    .body { background: #ffffff; padding: 36px; border-left: 1px solid #d1fae5; border-right: 1px solid #d1fae5; }
    .greeting { font-size: 19px; color: #111827; font-weight: 700; margin-bottom: 6px; }
    .subtext { font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 28px; }
    .mission-box { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1.5px solid #86efac; border-radius: 12px; padding: 20px 22px; margin-bottom: 24px; }
    .mission-box-label { font-size: 10.5px; color: #16a34a; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 6px; }
    .mission-box h2 { font-size: 21px; color: #14532d; font-weight: 700; line-height: 1.3; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .info-chip { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
    .info-chip .chip-icon { font-size: 18px; margin-bottom: 6px; display: block; }
    .info-chip .chip-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.7px; font-weight: 700; margin-bottom: 3px; }
    .info-chip .chip-value { font-size: 13.5px; color: #111827; font-weight: 600; line-height: 1.4; }
    .section-divider { display: flex; align-items: center; gap: 12px; margin: 24px 0 18px; }
    .section-divider span { font-size: 11px; color: #9ca3af; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; white-space: nowrap; }
    .section-divider::before, .section-divider::after { content: ''; flex: 1; height: 1px; background: #e5e7eb; }
    .description-box { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px; }
    .description-box p { font-size: 14.5px; color: #374151; line-height: 1.75; }
    .checklist { margin-bottom: 24px; }
    .checklist-item { display: flex; align-items: flex-start; gap: 10px; padding: 9px 12px; border-radius: 8px; background: #f9fafb; margin-bottom: 6px; font-size: 13.5px; color: #374151; }
    .checklist-item .check { color: #16a34a; font-size: 15px; margin-top: 1px; flex-shrink: 0; }
    .notice { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 16px; display: flex; gap: 12px; align-items: flex-start; margin-bottom: 24px; }
    .notice-icon { font-size: 18px; flex-shrink: 0; }
    .notice-text { font-size: 13px; color: #92400e; line-height: 1.55; }
    .notice-text strong { display: block; margin-bottom: 3px; color: #78350f; }
    .steps { margin-bottom: 24px; }
    .step-row { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px; }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: #16a34a; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
    .step-content .step-title { font-size: 13.5px; font-weight: 600; color: #111827; margin-bottom: 2px; }
    .step-content .step-desc { font-size: 12.5px; color: #6b7280; }
    .impact-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 24px; }
    .impact-card { text-align: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 10px; }
    .impact-card .impact-num { font-size: 22px; }
    .impact-card .impact-label { font-size: 10.5px; color: #6b7280; margin-top: 3px; }
    .cta-section { text-align: center; margin-bottom: 28px; }
    .cta-btn { display: inline-block; background: linear-gradient(135deg, #16a34a, #15803d); color: #ffffff; font-size: 14px; font-weight: 700; padding: 13px 30px; border-radius: 8px; text-decoration: none; letter-spacing: 0.3px; }
    .cta-sub { font-size: 12px; color: #9ca3af; margin-top: 10px; }
    .divider-line { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .footer-note { font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.7; }
    .email-footer { background: #f0fdf4; border: 1px solid #d1fae5; border-top: none; border-radius: 0 0 16px 16px; text-align: center; padding: 18px; font-size: 11.5px; color: #6b7280; }
    .footer-links { margin-bottom: 6px; }
    .footer-links a { color: #16a34a; text-decoration: none; margin: 0 8px; }
  </style>
</head>
<body>
<div class="wrapper">

  <div class="header">
    <div class="header-pattern"></div>
    <span class="header-icon">🌿</span>
    <h1>Goa Eco-Guard</h1>
    <p class="header-tagline">Protecting Goa's environment, one mission at a time</p>
    <div class="confirmed-badge">✓ &nbsp; Registration Confirmed</div>
  </div>

  <div class="body">
    <p class="greeting">Hi ${name}! 👋</p>
    <p class="subtext">You're officially part of the mission. We're excited to have you join us in making a real difference for Goa's environment. Here's everything you need to know before the big day.</p>

    <div class="mission-box">
      <div class="mission-box-label">🎯 Your Registered Mission</div>
      <h2>${missionTitle}</h2>
    </div>

    <div class="info-grid">
      <div class="info-chip">
        <span class="chip-icon">📅</span>
        <div class="chip-label">Mission Date</div>
        <div class="chip-value">${formattedDate}</div>
      </div>
      <div class="info-chip">
        <span class="chip-icon">📍</span>
        <div class="chip-label">Location</div>
        <div class="chip-value">${missionLocation}</div>
      </div>
      <div class="info-chip">
        <span class="chip-icon">⏰</span>
        <div class="chip-label">Report Time</div>
        <div class="chip-value">8:00 AM (sharp)</div>
      </div>
      <div class="info-chip">
        <span class="chip-icon">✉️</span>
        <div class="chip-label">Registered Email</div>
        <div class="chip-value">${email}</div>
      </div>
    </div>

    ${missionDescription ? `
    <div class="section-divider"><span>About This Mission</span></div>
    <div class="description-box">
      <p>${missionDescription}</p>
    </div>
    ` : ''}

    <div class="section-divider"><span>What to Bring</span></div>
    <div class="checklist">
      <div class="checklist-item"><span class="check">✔</span> Comfortable clothes you don't mind getting dirty</div>
      <div class="checklist-item"><span class="check">✔</span> Closed-toe shoes / sturdy footwear</div>
      <div class="checklist-item"><span class="check">✔</span> Water bottle (stay hydrated!)</div>
      <div class="checklist-item"><span class="check">✔</span> Sunscreen and a cap/hat</div>
      <div class="checklist-item"><span class="check">✔</span> Gloves (we'll also have extras on-site)</div>
      <div class="checklist-item"><span class="check">✔</span> A positive attitude and team spirit 💪</div>
    </div>

    <div class="notice">
      <span class="notice-icon">⚠️</span>
      <div class="notice-text">
        <strong>Important Reminder</strong>
        Please arrive 10–15 minutes early to sign in, collect equipment, and get a quick briefing from the team lead. Latecomers may miss the group orientation.
      </div>
    </div>

    <div class="section-divider"><span>Day-of Steps</span></div>
    <div class="steps">
      <div class="step-row">
        <div class="step-num">1</div>
        <div class="step-content">
          <div class="step-title">Arrive at ${missionLocation}</div>
          <div class="step-desc">Show this email or give your name at the registration desk.</div>
        </div>
      </div>
      <div class="step-row">
        <div class="step-num">2</div>
        <div class="step-content">
          <div class="step-title">Team Briefing & Equipment</div>
          <div class="step-desc">Collect gloves, bags, and tools. Meet your team and group lead.</div>
        </div>
      </div>
      <div class="step-row">
        <div class="step-num">3</div>
        <div class="step-content">
          <div class="step-title">Mission Begins!</div>
          <div class="step-desc">Work together to clean up and document environmental issues.</div>
        </div>
      </div>
      <div class="step-row">
        <div class="step-num">4</div>
        <div class="step-content">
          <div class="step-title">Report & Wrap Up</div>
          <div class="step-desc">Submit findings to the Goa Eco-Guard app and earn your impact points!</div>
        </div>
      </div>
    </div>

    <div class="section-divider"><span>Your Impact Matters</span></div>
    <div class="impact-row">
      <div class="impact-card">
        <div class="impact-num">🌊</div>
        <div class="impact-label">Beaches & rivers cleaned</div>
      </div>
      <div class="impact-card">
        <div class="impact-num">🌱</div>
        <div class="impact-label">Trees & nature protected</div>
      </div>
      <div class="impact-card">
        <div class="impact-num">🤝</div>
        <div class="impact-label">Community built together</div>
      </div>
    </div>

    <div class="cta-section">
      <a href="https://goa-eco-guard.app" class="cta-btn">🌿 Visit Goa Eco-Guard App</a>
      <p class="cta-sub">Track missions, view hotspots, and earn points for every action</p>
    </div>

    <hr class="divider-line">
    <p class="footer-note">
      Questions? Reply to this email or visit our app.<br>
      If you did not register for this mission, you can safely ignore this email.<br><br>
      <strong style="color:#374151;">© ${new Date().getFullYear()} Goa Eco-Guard</strong> — Protecting Goa's environment, together.
    </p>
  </div>

  <div class="email-footer">
    <div class="footer-links">
      <a href="https://goa-eco-guard.app">Website</a>
      <a href="https://goa-eco-guard.app/missions">Missions</a>
      <a href="mailto:${process.env.EMAIL_USER}">Contact Us</a>
    </div>
    goa-eco-guard.app &bull; Panaji, Goa, India 🇮🇳
  </div>

</div>
</body>
</html>
    `
  };

  await emailTransporter.sendMail(mailOptions);
}

/* ===============================
   HEALTH
================================ */
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Test Supabase connection and table access
app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('🔍 Testing Supabase connection...');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
    console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'Set' : 'Missing');

    // Test 1: Check if we can access eco_reports table
    const { data: reportsData, error: reportsError, count: reportsCount } = await supabase
      .from('eco_reports')
      .select('*', { count: 'exact', head: true });

    // Test 2: Check if we can access eco_spots (which seems to work)
    const { data: spotsData, error: spotsError } = await supabase
      .from('eco_spots')
      .select('id')
      .limit(1);

    // Test 3: Try a simple query on eco_reports to see what columns exist
    const { data: testQuery, error: testError } = await supabase
      .from('eco_reports')
      .select('*')
      .limit(1);

    // Test 4: Try to get table structure by attempting different column names
    const columnTests = {};
    const possibleColumns = ['user_id', 'userId', 'created_by', 'reporter_id', 'user'];

    for (const col of possibleColumns) {
      try {
        const { error: colError } = await supabase
          .from('eco_reports')
          .select(col)
          .limit(0);
        columnTests[col] = !colError;
      } catch (e) {
        columnTests[col] = false;
      }
    }

    res.json({
      connection: 'OK',
      supabaseUrl: process.env.SUPABASE_URL ? 'Configured' : 'Missing',
      supabaseKey: process.env.SUPABASE_KEY ? 'Configured' : 'Missing',
      tables: {
        eco_reports: {
          accessible: !reportsError,
          error: reportsError?.message || null,
          totalCount: reportsCount || 0,
          sampleData: testQuery || [],
          testError: testError?.message || null,
          columnTests: columnTests
        },
        eco_spots: {
          accessible: !spotsError,
          error: spotsError?.message || null,
          hasData: spotsData && spotsData.length > 0
        }
      }
    });
  } catch (err) {
    res.json({
      connection: 'ERROR',
      error: err.message,
      stack: err.stack
    });
  }
});

/* ===============================
   AUTH (COMMON LOGIN)
================================ */
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert([{ name, email, password: hashed, phone, role: 'user' }])
    .select()
    .single();

  if (error) {
    console.error('Registration error:', error.message);
    if (error.message.includes('duplicate key') || error.code === '23505') {
      return res.status(400).json({ error: 'You are already registered with this email. Please login instead.' });
    }
    return res.status(400).json({ error: error.message });
  }

  const token = jwt.sign(
    { userId: data.id, role: data.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  delete data.password;
  res.json({ token, user: data });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  delete user.password;
  res.json({ token, user });
});

/* ===============================
   USER ROUTES
================================ */
app.post(
  '/api/report',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      console.log('📝 Report submission received');
      console.log('User:', req.user.userId, 'Role:', req.user.role);

      if (req.user.role !== 'user') {
        console.warn('⚠️ Non-user tried to submit report');
        return res.status(403).json({ error: 'Users only' });
      }

      const { location, description, latitude, longitude } = req.body;
      console.log('Report data:', { location, description, latitude, longitude, hasImage: !!req.file });

      if (!latitude || !longitude) {
        console.warn('⚠️ Missing location data');
        return res.status(400).json({ error: 'Location required' });
      }

      let imageUrl = null;

      // LLM/AI Verification + Supabase Storage Upload
      if (req.file) {
        const imageBuffer = req.file.buffer; // from memoryStorage — no disk read needed

        try {
          console.log('🤖 AI Verifying image content...');
          const { OpenAI } = require('openai');

          const client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL
          });

          // Convert to JPEG for AI
          let jpegBuffer;
          try {
            jpegBuffer = await sharp(imageBuffer)
              .resize(1024, 1024, { fit: 'inside' })
              .jpeg()
              .toBuffer();
          } catch (sharpError) {
            console.error('❌ Failed to convert image for AI:', sharpError);
            jpegBuffer = imageBuffer;
          }

          const base64Image = jpegBuffer.toString('base64');

          console.log('📤 Sending image to AI model...');
          const response = await client.chat.completions.create({
            model: "nvidia/nemotron-nano-12b-v2-vl:free",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "Look at this image. Is it safe for a public eco-cleaning report? Choose ONE category:\n\n1. NORMAL: Garbage, trash, plastic, waste, nature, outdoors. (SAFE)\n2. SENSITIVE: People, faces, selfies, children, nudity, violence. (UNSAFE)\n3. UNWANTED: Non-eco related, memes, screenshots. (UNSAFE)\n\nReply with ONLY the category word: NORMAL, SENSITIVE, or UNWANTED." },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                ]
              }
            ],
            extra_headers: {
              "HTTP-Referer": "http://localhost:3000",
              "X-Title": "Eco-Guard Classifier"
            }
          });

          if (!response.choices || response.choices.length === 0) {
            console.error('❌ AI returned no choices (likely filtered).');
            return res.status(400).json({
              error: 'AI could not verify image safety (content filtering).',
              type: 'ai_filtering'
            });
          }

          const aiResult = response.choices[0].message.content.toLowerCase();
          console.log('🤖 AI Result:', aiResult);

          if (aiResult.includes('sensitive') || aiResult.includes('unwanted') || aiResult.includes('remove') || aiResult.includes('unsafe') || aiResult.includes('people')) {
            console.warn('❌ AI detected sensitive content. Rejecting upload.');
            return res.status(400).json({
              error: 'Sensitive or inappropriate content detected by AI.',
              type: 'sensitive_content'
            });
          }

          console.log('✅ AI verified image as safe.');

        } catch (aiError) {
          console.error('⚠️ AI Verification failed (proceeding with upload):', aiError.message);
        }

        // Upload to Supabase Storage
        imageUrl = await uploadToSupabase(imageBuffer, 'reports');
        if (!imageUrl) {
          console.warn('⚠️ Image upload to Supabase failed — report will be saved without image.');
        }
      }

      // ✅ CHECK FOR DUPLICATE REPORTS
      // Check if a report already exists with same location (lat/lng) and description
      console.log('🔍 Checking for duplicate reports...');

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const descLower = description.toLowerCase().trim();

      console.log(`📍 Checking coordinates: lat=${lat}, lng=${lng}`);
      console.log(`📝 Description (normalized): "${descLower}"`);
      console.log(`🔎 Querying database for existing reports at this location...`);

      // Query for existing reports with same coordinates and similar description
      const { data: existingReports, error: checkError } = await supabaseAdmin
        .from('eco_reports')
        .select('id, description, latitude, longitude, created_at')
        .eq('latitude', lat)
        .eq('longitude', lng)
        .is('deleted_at', null); // Only check non-deleted reports

      if (checkError) {
        console.warn('⚠️ Error checking for duplicates:', checkError);
        // Continue even if check fails
      } else if (existingReports && existingReports.length > 0) {
        console.log(`📊 Found ${existingReports.length} report(s) at same coordinates`);

        // Check if description matches (case-insensitive)
        const duplicate = existingReports.find(report =>
          report.description.toLowerCase().trim() === descLower
        );

        if (duplicate) {
          console.warn('\n' + '='.repeat(60));
          console.warn('❌ DUPLICATE DETECTED!');
          console.warn('='.repeat(60));
          console.warn(`   Existing Report ID: ${duplicate.id}`);
          console.warn(`   Existing Description: "${duplicate.description}"`);
          console.warn(`   Created At: ${duplicate.created_at}`);
          console.warn(`   New Description: "${description}"`);
          console.warn(`   Coordinates: (${lat}, ${lng})`);
          console.warn('🚫 Rejecting duplicate submission');
          console.warn('='.repeat(60) + '\n');

          // Delete uploaded image if it exists
          if (imageName) {
            try {
              fs.unlinkSync(`uploads/${imageName}`);
              console.log('🗑️ Deleted duplicate image:', imageName);
            } catch (e) {
              console.error('⚠️ Failed to delete image:', e.message);
            }
          }

          return res.status(400).json({
            error: 'Duplicate report detected. A report with the same location and description already exists.',
            type: 'duplicate_report',
            existingReportId: duplicate.id
          });
        } else {
          console.log('✅ Same coordinates but different descriptions - not a duplicate');
        }
      } else {
        console.log('✅ No reports found at this location');
      }

      console.log('✅ No duplicate found, proceeding with insertion');

      // Try inserting with user_id first
      let reportData = {
        user_id: req.user.userId,
        location,
        description,
        latitude: lat,
        longitude: lng,
        image: imageUrl,  // full Supabase Storage public URL (or null)
        status: 'approved'  // auto-approved after AI verification
      };

      console.log('📤 Inserting report to database:', reportData);

      // Use admin client to bypass RLS for inserts
      let { data, error } = await supabaseAdmin
        .from('eco_reports')
        .insert([reportData])
        .select();

      // If user_id column doesn't exist, try without it (temporary workaround)
      if (error && error.message && error.message.includes('user_id')) {
        console.warn('⚠️ user_id column not found, inserting without it (temporary)');
        reportData = {
          location,
          description,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          image: imageUrl,
          status: 'approved'  // auto-approved after AI verification
        };

        const retryResult = await supabaseAdmin
          .from('eco_reports')
          .insert([reportData])
          .select();

        data = retryResult.data;
        error = retryResult.error;

        if (!error) {
          console.warn('⚠️ Report saved WITHOUT user_id. Please run fix_eco_reports_schema.sql to add the column.');
        }
      }

      if (error) {
        console.error('❌ Database insert error:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        // If user_id column is missing, provide helpful SQL fix
        if (error.message && error.message.includes('user_id')) {
          console.error('\n🔧 SQL FIX REQUIRED:');
          console.error('The user_id column is missing from eco_reports table.');
          console.error('See fix_eco_reports_schema.sql file for the SQL to run.');
          return res.status(500).json({
            error: 'Database schema issue: user_id column missing',
            message: error.message,
            hint: 'Run fix_eco_reports_schema.sql in Supabase SQL Editor to add the missing column'
          });
        }

        // If RLS policy violation, provide helpful fix
        if (error.code === '42501' || (error.message && error.message.includes('row-level security'))) {
          console.error('\n🔒 RLS POLICY ISSUE:');
          console.error('Row Level Security is blocking the insert.');
          console.error('Solutions:');
          console.error('1. Add SUPABASE_SERVICE_ROLE_KEY to your .env file (recommended)');
          console.error('   Get it from: Supabase Dashboard → Settings → API → service_role key');
          console.error('2. Or update RLS policies - see fix_rls_policies.sql');
          return res.status(500).json({
            error: 'Row Level Security policy violation',
            message: error.message,
            hint: 'Add SUPABASE_SERVICE_ROLE_KEY to .env file, or update RLS policies. See server console for details.'
          });
        }

        return res.status(500).json({
          error: error.message,
          details: error.details,
          hint: error.hint
        });
      }

      console.log('✅ Report inserted successfully:', data);
      res.json({ success: true, data });
    } catch (err) {
      console.error('❌ Exception in report submission:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message
      });
    }
  }
);

// Debug endpoint to check reports (including deleted)
app.get('/api/debug/reports', async (req, res) => {
  try {
    const { data: allReports } = await supabase
      .from('eco_reports')
      .select('id, location, deleted_at, created_at')
      .order('created_at', { ascending: false });

    const deleted = allReports?.filter(r => r.deleted_at) || [];
    const active = allReports?.filter(r => !r.deleted_at) || [];

    res.json({
      total: allReports?.length || 0,
      active: active.length,
      deleted: deleted.length,
      reports: allReports || []
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    console.log('📋 Fetching reports from database...');

    // First, check total count (including deleted) for debugging
    const { count: totalCount } = await supabase
      .from('eco_reports')
      .select('*', { count: 'exact', head: true });
    console.log(`📊 Total reports in database (including deleted): ${totalCount || 0}`);

    // Try without join first (more reliable)
    const { data, error } = await supabase
      .from('eco_reports')
      .select('*')
      .is('deleted_at', null) // Filter out soft-deleted reports
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching reports:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return res.json([]);
    }

    // Handle null response from Supabase
    if (data === null || data === undefined) {
      console.warn('⚠️ Supabase returned null/undefined, trying query without deleted_at filter...');
      // Try without deleted_at filter to see if that's the issue
      const { data: altData, error: altError } = await supabase
        .from('eco_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (altError) {
        console.error('❌ Alternative query also failed:', altError);
        return res.json([]);
      }

      const reports = Array.isArray(altData) ? altData : [];
      console.log(`✅ Returning ${reports.length} reports (without deleted_at filter)`);
      if (reports.length > 0 && reports[0].deleted_at) {
        console.warn('⚠️ Reports exist but are soft-deleted. Check deleted_at column.');
      }
      return res.json(reports);
    }

    // Ensure we always return an array
    const reports = Array.isArray(data) ? data : [];
    console.log(`✅ Returning ${reports.length} reports (non-deleted)`);

    if (reports.length === 0 && totalCount > 0) {
      console.warn(`⚠️ Found ${totalCount} total reports but all are soft-deleted (deleted_at is set)`);
      console.log('💡 Tip: Reports might be soft-deleted. Check the database or use admin panel to restore them.');
    }

    if (reports.length > 0) {
      console.log('📄 Sample report structure:', {
        id: reports[0].id,
        location: reports[0].location,
        hasImage: !!reports[0].image,
        hasDescription: !!reports[0].description,
        deleted_at: reports[0].deleted_at
      });
    }

    res.json(reports);
  } catch (err) {
    console.error('❌ Exception fetching reports:', err);
    res.json([]);
  }
});

/* ===============================
   MAP HOTSPOTS (IMPORTANT)
================================ */
// Hotspots route moved below to avoid duplication

/* ===============================
   MISSION JOIN
================================ */
app.post('/api/join', async (req, res) => {
  try {
    const { mission_id, name, email, phone } = req.body;

    // Validate required fields
    if (!mission_id) {
      return res.status(400).json({ error: 'Mission ID is required' });
    }
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // mission_id can be UUID or integer - Supabase handles both
    const missionId = mission_id.toString().trim();

    // Verify mission exists + fetch details for the email
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('id, title, date, location, description')
      .eq('id', missionId)
      .single();

    if (missionError || !mission) {
      console.error('Mission lookup error:', missionError);
      return res.status(400).json({ error: 'Mission not found' });
    }

    // Insert registration
    const { data, error } = await supabase
      .from('mission_registrations')
      .insert([{
        mission_id: missionId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null
      }])
      .select()
      .single();

    if (error) {
      console.error('Registration error:', error);
      // Check for duplicate entry
      if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
        return res.status(400).json({ error: 'You have already registered for this mission' });
      }
      // Check for foreign key constraint
      if (error.code === '23503' || error.message.includes('foreign key')) {
        return res.status(400).json({ error: 'Invalid mission ID' });
      }
      return res.status(400).json({ error: error.message || 'Failed to register for mission' });
    }

    // Send confirmation email — non-blocking (never breaks the join)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      sendMissionEmail({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        missionTitle: mission.title,
        missionDate: mission.date,
        missionLocation: mission.location,
        missionDescription: mission.description
      })
        .then(() => console.log(` Email sent to ${email.trim().toLowerCase()}`))
        .catch(err => console.warn(`⚠️ Email failed (non-blocking): ${err.message}`));
    } else {
      console.warn('EMAIL_USER or EMAIL_PASS not set in .env — email skipped');
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('Join mission error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

/* ===============================
   ADMIN ROUTES
================================ */
app.get('/api/admin/reports', authenticateToken, isAdmin, async (req, res) => {
  const includeDeleted = req.query.include_deleted === 'true';

  let query = supabaseAdmin
    .from('eco_reports')
    .select('*, users!user_id(name, email)')
    .order('created_at', { ascending: false });

  if (!includeDeleted) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching admin reports:', error);
    return res.status(500).json({ error: error.message });
  }

  res.json(data || []);
});

app.put('/api/admin/reports/:id', authenticateToken, isAdmin, async (req, res) => {
  const { status, severity, deleted_at, featured } = req.body;

  const updateData = {
    reviewed_by: req.user.userId,
    reviewed_at: new Date().toISOString()
  };

  if (status !== undefined) updateData.status = status;
  if (severity !== undefined) updateData.severity = severity;
  if (deleted_at !== undefined) updateData.deleted_at = deleted_at;
  if (featured !== undefined) updateData.featured = featured;

  const { error } = await supabaseAdmin
    .from('eco_reports')
    .update(updateData)
    .eq('id', req.params.id);

  if (error) {
    console.error('Error updating report:', error);
    return res.status(400).json({ error: error.message });
  }

  res.json({ success: true });
});

// Single hotspots endpoint (consolidated)
app.get('/api/hotspots', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('eco_reports')
      .select(`
        id,
        location,
        latitude,
        longitude,
        status,
        created_at
      `)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Convert to map-friendly format
    const hotspots = data.map(r => ({
      id: r.id,
      location: r.location,
      lat: r.latitude,
      lng: r.longitude,
      status: r.status || 'pending',
      time: r.created_at
    }));

    res.json(hotspots);

  } catch (err) {
    console.error('Hotspot error:', err);
    res.status(500).json({ error: 'Failed to load hotspots' });
  }
});

// Soft delete report
app.put('/api/admin/reports/:id/soft-delete', authenticateToken, isAdmin, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('eco_reports')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// Restore soft deleted report
app.put('/api/admin/reports/:id/restore', authenticateToken, isAdmin, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('eco_reports')
    .update({ deleted_at: null })
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// Permanent delete report
app.delete('/api/admin/reports/:id', authenticateToken, isAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.from('eco_reports').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// READ
app.get('/api/missions', async (req, res) => {
  const { data: missions, error } = await supabase
    .from('missions')
    .select('*')
    .order('date', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });

  // Get participant counts for each mission
  const missionsWithCounts = await Promise.all(
    (missions || []).map(async (mission) => {
      const { count } = await supabase
        .from('mission_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('mission_id', mission.id);

      return {
        ...mission,
        participant_count: count || 0
      };
    })
  );

  res.json(missionsWithCounts);
});

// UPDATE
app.put('/api/admin/missions/:id', authenticateToken, isAdmin, async (req, res) => {
  await supabase.from('missions').update(req.body).eq('id', req.params.id);
  res.json({ success: true });
});

// DELETE
app.delete('/api/admin/missions/:id', authenticateToken, isAdmin, async (req, res) => {
  const missionId = req.params.id;

  // Manual cascade delete: delete registrations first
  const { error: regError } = await supabase
    .from('mission_registrations')
    .delete()
    .eq('mission_id', missionId);

  if (regError) {
    console.error('Error deleting mission registrations:', regError);
    // Continue anyway to try deleting the mission, or return error?
    // Usually safe to proceed if the error is "no rows" (which wouldn't be an error),
    // but if it's a DB error, we might fail on the next step.
    // We'll proceed but log it.
  }

  const { error } = await supabase.from('missions').delete().eq('id', missionId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// Get mission participants
app.get('/api/admin/missions/:id/participants', authenticateToken, isAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('mission_registrations')
    .select('id, name, email, phone, registered_at')
    .eq('mission_id', req.params.id)
    .order('registered_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });

  // Map registered_at to created_at for frontend compatibility
  const participants = (data || []).map(p => ({
    ...p,
    created_at: p.registered_at
  }));

  res.json(participants);
});

// Delete mission participant
app.delete('/api/admin/missions/participants/:id', authenticateToken, isAdmin, async (req, res) => {
  const { error } = await supabase
    .from('mission_registrations')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone, password, role, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

app.post(
  '/api/admin/missions',
  authenticateToken,
  isAdmin,
  upload.single('image'),
  async (req, res) => {
    try {
      const { title, description, date, location } = req.body;

      // Validate required fields
      if (!title || !description || !date || !location) {
        return res.status(400).json({
          error: 'Missing required fields: title, description, date, and location are required'
        });
      }

      let imageUrl = null;

      if (req.file) {
        imageUrl = await uploadToSupabase(req.file.buffer, 'missions');
        if (!imageUrl) console.warn('⚠️ Mission image upload failed — saving without image.');
      }

      const { data, error } = await supabase.from('missions').insert([{
        title,
        description,
        date,
        location,
        image: imageUrl
      }]).select().single();

      if (error) {
        console.error('Database error:', error);
        return res.status(400).json({ error: error.message });
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error('Mission creation error:', err);
      res.status(500).json({ error: 'Failed to create mission: ' + err.message });
    }
  }
);


// CREATE
app.post('/api/admin/eco-guide', authenticateToken, isAdmin, async (req, res) => {
  const { name, description, location, category } = req.body;
  const { error } = await supabase.from('eco_guides')
    .insert([{ name, description, location, category }]);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// READ (Public)
app.get('/api/eco-guide', async (req, res) => {
  const { data } = await supabase.from('eco_guides').select('*');
  res.json(data);
});

// UPDATE
app.put('/api/admin/eco-guide/:id', authenticateToken, isAdmin, async (req, res) => {
  await supabase.from('eco_guides').update(req.body).eq('id', req.params.id);
  res.json({ success: true });
});

// DELETE
app.delete('/api/admin/eco-guide/:id', authenticateToken, isAdmin, async (req, res) => {
  await supabase.from('eco_guides').delete().eq('id', req.params.id);
  res.json({ success: true });
});

app.post(
  '/api/admin/eco-guide',
  authenticateToken,
  isAdmin,
  upload.single('image'),
  async (req, res) => {

    const { title, description, category } = req.body;

    let imageUrl = null;

    if (req.file) {
      imageUrl = await uploadToSupabase(req.file.buffer, 'eco-guide');
      if (!imageUrl) console.warn('⚠️ Eco guide image upload failed — saving without image.');
    }

    const { error } = await supabase.from('eco_guide').insert([{
      title,
      description,
      category,
      image: imageUrl
    }]);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ success: true });
  }
);

/* ===============================
   ECO SPOTS ROUTES
================================ */
// Create eco spot
app.post(
  '/api/admin/eco-spots',
  authenticateToken,
  isAdmin,
  upload.single('image'),
  async (req, res) => {
    const { name, rating, location, description, category, price, features, details } = req.body;

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadToSupabase(req.file.buffer, 'eco-spots');
      if (!imageUrl) console.warn('⚠️ Eco spot image upload failed — saving without image.');
    }

    const { data, error } = await supabase.from('eco_spots').insert([{
      name,
      rating: parseFloat(rating),
      location,
      description,
      category,
      price: price || null,
      features: features || null,
      details: details || null,
      image: imageUrl
    }]).select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  }
);

// Get all eco spots (public)
app.get('/api/eco-spots', async (req, res) => {
  const { data, error } = await supabase
    .from('eco_spots')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

// Get single eco spot
app.get('/api/eco-spots/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('eco_spots')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Update eco spot
app.put(
  '/api/admin/eco-spots/:id',
  authenticateToken,
  isAdmin,
  upload.single('image'),
  async (req, res) => {
    const { name, rating, location, description, category, price, features, details } = req.body;

    const updateData = {
      name,
      rating: rating ? parseFloat(rating) : undefined,
      location,
      description,
      category,
      price: price || null,
      features: features || null,
      details: details || null
    };

    if (req.file) {
      const newUrl = await uploadToSupabase(req.file.buffer, 'eco-spots');
      if (newUrl) {
        updateData.image = newUrl;
      } else {
        console.warn('⚠️ Eco spot image update upload failed — keeping existing image.');
      }
    }

    // Remove undefined fields
    Object.keys(updateData).forEach(key =>
      updateData[key] === undefined && delete updateData[key]
    );

    const { data, error } = await supabase
      .from('eco_spots')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  }
);

// Delete eco spot
app.delete('/api/admin/eco-spots/:id', authenticateToken, isAdmin, async (req, res) => {
  const { error } = await supabase.from('eco_spots').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// Hotspots endpoint already defined above


/* ===============================
   ADDITIONAL API ENDPOINTS
================================ */
// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    // 1) Reports count per user (non-deleted only)
    const { data: reports } = await supabase
      .from('eco_reports')
      .select('user_id, users(name)')
      .is('deleted_at', null)
      .not('user_id', 'is', null);

    // 2) Total non-deleted reports for the stat counter
    const { count: totalReportCount } = await supabase
      .from('eco_reports')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // 3) Missions whose date has passed = completed
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const { data: completedMissions } = await supabase
      .from('missions')
      .select('id')
      .lt('date', today);

    const completedCount = completedMissions?.length || 0;

    // 4) Trees planted estimate (5 trees per completed mission)
    const treesPlanted = completedCount * 5;

    // Calculate user scores (simplified)
    const userScores = {};
    reports?.forEach(r => {
      const userId = r.user_id;
      if (!userScores[userId]) {
        userScores[userId] = { name: r.users?.name || 'Anonymous', score: 0 };
      }
      userScores[userId].score += 10; // 10 points per report
    });

    const leaderboard = Object.values(userScores)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    res.json({
      top3: leaderboard.slice(0, 3),
      list: leaderboard.slice(3),
      totalReports: totalReportCount || 0,
      totalMissions: completedCount,
      totalTrees: treesPlanted
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.json({ top3: [], list: [], totalReports: 0, totalMissions: 0, totalTrees: 0 });
  }
});

// Report Statistics (for policy tracker)
app.get('/api/report-stats', async (req, res) => {
  try {
    const { data: reports } = await supabaseAdmin
      .from('eco_reports')
      .select('status')
      .is('deleted_at', null);

    const stats = {
      total: reports?.length || 0,
      pending: reports?.filter(r => r.status === 'pending' || !r.status).length || 0,
      approved: reports?.filter(r => r.status === 'approved').length || 0,
      rejected: reports?.filter(r => r.status === 'rejected').length || 0
    };

    res.json(stats);
  } catch (err) {
    console.error('Report stats error:', err);
    res.json({ total: 0, pending: 0, approved: 0, rejected: 0 });
  }
});

app.get('/api/public-stats', async (req, res) => {
  try {
    // 1) Warriors (Total Users)
    const { count: userCount, error: userError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (userError) throw userError;

    // 2) Reports (Non-deleted)
    const { count: reportCount, error: reportError } = await supabaseAdmin
      .from('eco_reports')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    if (reportError) throw reportError;

    // 3) Missions (Total)
    const { count: missionCount, error: missionError } = await supabaseAdmin
      .from('missions')
      .select('*', { count: 'exact', head: true });
    
    if (missionError) throw missionError;

    res.json({
      warriors: userCount || 0,
      reports: reportCount || 0,
      missions: missionCount || 0
    });
  } catch (err) {
    console.error('❌ Public stats error:', err.message || err);
    res.status(500).json({ warriors: 0, reports: 0, missions: 0 });
  }
});

// Policies
app.get('/api/policies', async (req, res) => {
  try {
    const { data } = await supabase
      .from('policies')
      .select('*')
      .order('created_at', { ascending: false });

    res.json(data || []);
  } catch (err) {
    console.error('Policies error:', err);
    res.json([]);
  }
});

// Experiences (Eco Guide)
app.get('/api/experiences', async (req, res) => {
  try {
    const { data } = await supabase
      .from('eco_guides')
      .select('*')
      .order('created_at', { ascending: false });

    res.json(data || []);
  } catch (err) {
    console.error('Experiences error:', err);
    res.json([]);
  }
});

/* ===============================
   NEW FEATURES MODULE (uncomment to activate)
================================ */
app.use(require('./NewFeatures/newFeaturesRoutes'));
require('./NewFeatures/reminderCron');

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Goa Eco-Guard backend running on port ${PORT}`);
});
