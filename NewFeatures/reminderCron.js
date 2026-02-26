// ============================================
// Goa Eco-Guard: Mission Reminder Cron
// Sends "Don't Forget!" emails for missions
// happening in the next 3 days.
//
// Usage (in server.js):
//   require('./NewFeatures/reminderCron');
// ============================================

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Email transporter (reuses same .env vars as main server)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Build the reminder email HTML
 */
function buildReminderEmail({ name, missionTitle, missionDate, missionLocation, daysLeft }) {
  const formattedDate = new Date(missionDate).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const urgency = daysLeft === 0 ? '🔴 TODAY!' :
                   daysLeft === 1 ? '🟡 Tomorrow!' :
                   `📅 In ${daysLeft} days`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', Arial, sans-serif; background: #ecfdf5; padding: 24px 16px; }
    .wrapper { max-width: 580px; margin: 0 auto; }
    .header { background: linear-gradient(145deg, #14532d, #15803d); border-radius: 16px 16px 0 0; padding: 36px; text-align: center; color: #fff; }
    .header h1 { font-size: 22px; margin-bottom: 6px; }
    .header .tagline { font-size: 13px; color: #86efac; }
    .body { background: #fff; padding: 32px; border: 1px solid #d1fae5; }
    .urgency-badge { display: inline-block; background: ${daysLeft === 0 ? '#fee2e2' : daysLeft === 1 ? '#fef9c3' : '#dcfce7'}; color: ${daysLeft === 0 ? '#991b1b' : daysLeft === 1 ? '#854d0e' : '#166534'}; font-weight: 700; font-size: 14px; padding: 8px 18px; border-radius: 20px; margin-bottom: 20px; }
    .greeting { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 8px; }
    .subtext { font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 24px; }
    .mission-card { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .mission-card h2 { font-size: 18px; color: #14532d; margin-bottom: 12px; }
    .detail { display: flex; gap: 8px; margin-bottom: 8px; font-size: 14px; color: #374151; }
    .detail-icon { font-size: 16px; }
    .cta { display: block; text-align: center; background: linear-gradient(135deg, #16a34a, #15803d); color: #fff; font-weight: 700; font-size: 14px; padding: 14px; border-radius: 8px; text-decoration: none; margin: 20px 0; }
    .footer { background: #f0fdf4; border-radius: 0 0 16px 16px; border: 1px solid #d1fae5; border-top: none; padding: 16px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <span style="font-size:40px;">⏰</span>
    <h1>Mission Reminder</h1>
    <p class="tagline">Goa Eco-Guard • Don't forget!</p>
  </div>
  <div class="body">
    <div style="text-align:center;">
      <span class="urgency-badge">${urgency}</span>
    </div>
    <p class="greeting">Hey ${name}! 👋</p>
    <p class="subtext">Just a friendly reminder about the mission you signed up for. We're counting on you!</p>
    <div class="mission-card">
      <h2>🌿 ${missionTitle}</h2>
      <div class="detail"><span class="detail-icon">📅</span> <strong>Date:</strong>&nbsp;${formattedDate}</div>
      <div class="detail"><span class="detail-icon">📍</span> <strong>Location:</strong>&nbsp;${missionLocation}</div>
      <div class="detail"><span class="detail-icon">⏰</span> <strong>Report Time:</strong>&nbsp;8:00 AM (arrive 15 min early)</div>
    </div>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px;">
      <strong style="color:#78350f;">📝 Quick Checklist</strong>
      <ul style="margin-top:8px;padding-left:18px;font-size:13px;color:#92400e;">
        <li>Comfortable clothes & closed-toe shoes</li>
        <li>Water bottle & sunscreen</li>
        <li>Gloves (extras provided on-site)</li>
      </ul>
    </div>
    <a href="#" class="cta">🌿 Open Goa Eco-Guard</a>
    <p style="text-align:center;font-size:12px;color:#9ca3af;">See you there! Every action counts. 💪</p>
  </div>
  <div class="footer">
    © ${new Date().getFullYear()} Goa Eco-Guard — Protecting Goa's environment, together.
  </div>
</div>
</body>
</html>`;
}

/**
 * The main reminder logic — find missions in next 3 days, email participants.
 */
async function sendMissionReminders() {
  console.log('⏰ [Reminder Cron] Running mission reminder check...');

  try {
    // Get today and 3 days from now
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const todayStr = today.toISOString().split('T')[0];
    const futureStr = threeDaysLater.toISOString().split('T')[0];

    console.log(`📅 Checking missions between ${todayStr} and ${futureStr}`);

    // Fetch missions in the next 3 days
    const { data: upcomingMissions, error: missionErr } = await supabase
      .from('missions')
      .select('id, title, date, location, description')
      .gte('date', todayStr)
      .lte('date', futureStr);

    if (missionErr) {
      console.error('❌ Error fetching upcoming missions:', missionErr);
      return;
    }

    if (!upcomingMissions || upcomingMissions.length === 0) {
      console.log('✅ No missions in the next 3 days. Nothing to send.');
      return;
    }

    console.log(`📋 Found ${upcomingMissions.length} upcoming mission(s)`);

    for (const mission of upcomingMissions) {
      // Fetch participants for this mission
      const { data: participants, error: partErr } = await supabase
        .from('mission_registrations')
        .select('name, email')
        .eq('mission_id', mission.id);

      if (partErr) {
        console.error(`❌ Error fetching participants for ${mission.title}:`, partErr);
        continue;
      }

      if (!participants || participants.length === 0) {
        console.log(`   ⏭️ No participants for "${mission.title}"`);
        continue;
      }

      // Calculate days left
      const missionDate = new Date(mission.date);
      missionDate.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((missionDate - today) / (1000 * 60 * 60 * 24));

      console.log(`   📧 Sending ${participants.length} reminders for "${mission.title}" (${daysLeft} day(s) left)`);

      for (const participant of participants) {
        try {
          await transporter.sendMail({
            from: `"Goa Eco-Guard" <${process.env.EMAIL_USER}>`,
            to: participant.email,
            subject: `⏰ Mission Reminder: ${mission.title} — ${daysLeft === 0 ? 'TODAY!' : daysLeft === 1 ? 'Tomorrow!' : `In ${daysLeft} days`}`,
            html: buildReminderEmail({
              name: participant.name,
              missionTitle: mission.title,
              missionDate: mission.date,
              missionLocation: mission.location,
              daysLeft
            })
          });
          console.log(`      ✅ Sent to ${participant.email}`);
        } catch (emailErr) {
          console.warn(`      ⚠️ Failed to send to ${participant.email}: ${emailErr.message}`);
        }
      }
    }

    console.log('✅ [Reminder Cron] Reminder cycle complete.');
  } catch (err) {
    console.error('❌ [Reminder Cron] Fatal error:', err);
  }
}

// Schedule: every day at 8:00 AM IST (2:30 AM UTC)
cron.schedule('30 2 * * *', () => {
  sendMissionReminders();
}, {
  timezone: 'Asia/Kolkata'
});

console.log('✅ [Reminder Cron] Scheduled — runs daily at 8:00 AM IST');

// Export for manual triggering / testing
module.exports = { sendMissionReminders };
