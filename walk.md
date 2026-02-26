1. Eco-Stories (Impact Gallery)
A social-style feed where users share the results of their missions.

Database Schema [NEW TABLE]
sql
CREATE TABLE eco_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    mission_id UUID REFERENCES missions(id) NULL,
    title TEXT NOT NULL,
    description TEXT,
    before_image TEXT, -- URL from Supabase Storage
    after_image TEXT,  -- URL from Supabase Storage
    likes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
API Endpoints
POST /api/stories: Upload images to Supabase Storage, then insert row.
GET /api/stories: Fetch paginated stories with user/mission metadata.
POST /api/stories/:id/like: Increment likes.
Frontend Architecture
Component: StoryCard with image comparison slider (Before/After).
Navigation: New "Stories" tab in the navbar.

2. Proximity Alerts (Real-time Safety)
Notify users when a "Critical" report is filed within 5km of their location.
Backend Logic
Geographic Query: Use PostGIS (available in Supabase) 
-- Query example for reports within radius
SELECT * FROM eco_reports 
WHERE severity = 'critical' 
AND st_distance_sphere(location_coords, st_makePoint(user_lng, user_lat)) <= 5000;
Socket.io Integration: Emit a "critical_report" event to users whose coordinates match the proximity.
API Endpoints
POST /api/user/location: Update current user coordinates in sessionStorage or a temporary DB table for active sessions.
Frontend Architecture
Service Worker: Use the Web Push API to send notifications even if the tab is closed.
UI: A prominent floating alert/banner for "Critical Incident Nearby".

3. Mission Reminders (Engagement)
Automated reminders for users who joined missions.
Backend Infrastructure
Scheduler: Use node-cron or Supabase Edge Functions (cron jobs) to check daily for missions occurring in when mission left last 3 days  then send email to user remaining about mission for that 3 days.
Email Service: Use existing nodemailer helper.
Logic Flow
Cron job runs at 8:00 AM .
Query mission_registrations where mission_date = tomorrow.
Join with missions and users to get contact details.
Send "Don't Forget!" email with mission location link.
Frontend Architecture
Opt-in Toggle: "Remind me before missions" checkbox in the registration modal.

4. Sighting Reports (Biodiversity Tracker)
A new dedicated reporting category for positive environmental data.
Database Schema [UPDATES]
Modify ECO_REPORTS or create eco_sightings:
sql
CREATE TABLE eco_sightings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    species_name TEXT,
    description TEXT,
    latitude FLOAT,
    longitude FLOAT,
    image_url TEXT,
    status TEXT DEFAULT 'verified',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
API Endpoints
POST /api/sighting: Similar to /api/report but with species metadata.
GET /api/sightings: Fetch data for the biodiversity map layer.
Frontend Architecture
Map Layer: A toggleable Leaflet layer on the main heatmap (Green pins for sightings vs. Red pins for pollution).
Form UI: Updated reporting portal with a "Sighting" vs "Pollution" switch.

Verification Plan
Automated Tests
Unit Tests: Test proximity calculation helper function (Haversine).
Integration Tests: Mock a "Critical" report submission and verify the push notification payload is generated correctly.

create all this in NewFeatures folder and write all the code in that folder and make sure to test it aslo make it in a way that it can be used in the main project or i can remove it without damaging the main project adjust the css and layout in a way if i remove it should not effect the main project

