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

    <div class="modal-content profile-modal-new dark:text-slate-100">
            <div class="p-5 pb-32">
                <header class="flex items-center justify-between mb-8">
                    <h1 class="text-2xl font-bold tracking-tight">User Profile &amp; Impact</h1>
                    <button class="close-modal p-2 rounded-full bg-slate-200/50 dark:bg-emerald-900/40 text-slate-600 dark:text-emerald-400">
                        <span class="material-icons-round">close</span>
                    </button>
                </header>

                <div class="flex flex-col items-center mb-8">
                    <div class="relative">
                        <div class="w-24 h-24 rounded-full border-2 border-primary flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/50 mb-4 overflow-hidden">
                            <span id="dashboardInitial" class="text-4xl font-light text-primary">S</span>
                            <img id="dashboardAvatar" src="" alt="" class="w-full h-full object-cover hidden">
                        </div>
                        <div class="absolute bottom-4 right-0 w-6 h-6 bg-primary rounded-full border-2 border-background-light dark:border-background-dark flex items-center justify-center">
                            <span class="material-icons-round text-white text-[12px]">edit</span>
                        </div>
                    </div>
                    <h2 id="dashboardName" class="text-xl font-bold text-slate-900 dark:text-white">suraj </h2>
                    <p id="dashboardEmail" class="text-slate-500 dark:text-emerald-500/70 text-sm">gawassuraj@gmail.com</p>
                </div>

                <div class="bg-slate-200/50 dark:bg-emerald-950/40 p-1 rounded-xl flex mb-8">
                    <button id="tabAccount" class="profile-tab-dash flex-1 py-2 text-sm font-medium rounded-lg text-slate-500 dark:text-emerald-600/60 transition-all" onclick="window.app.switchDashboardTab('account')">Account</button>
                    <button id="tabImpact" class="profile-tab-dash active flex-1 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-primary shadow-sm text-slate-900 dark:text-white transition-all" onclick="window.app.switchDashboardTab('impact')">My Impact</button>
                    <button id="tabAlerts" class="profile-tab-dash flex-1 py-2 text-sm font-medium rounded-lg text-slate-500 dark:text-emerald-600/60 transition-all" onclick="window.app.switchDashboardTab('alerts')">Alerts</button>
                </div>

                <!-- Tab content: Account -->
                <div id="dashboardSection-account" class="dashboard-section hidden space-y-4">
                    <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 shadow-sm">
                        <label class="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-emerald-700/80">Full Name</label>
                        <p id="accountName" class="text-lg font-medium text-slate-900 dark:text-white mt-1">suraj </p>
                    </div>
                    <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 shadow-sm">
                        <label class="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-emerald-700/80">Email Address</label>
                        <p id="accountEmail" class="text-lg font-medium text-slate-900 dark:text-white mt-1">gawassuraj@gmail.com</p>
                    </div>
                    <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 shadow-sm">
                        <label class="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-emerald-700/80">Phone Number</label>
                        <p id="accountPhone" class="text-lg font-medium text-slate-900 dark:text-white mt-1">8767691729</p>
                    </div>
                </div>

                <!-- Tab content: Impact -->
                <div id="dashboardSection-impact" class="dashboard-section">
                    <div class="grid grid-cols-3 gap-3 mb-10">
                        <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 flex flex-col items-center justify-center shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-emerald-900/10 transition-colors" onclick="window.app.scrollToDashboardSection('reports')">
                            <span id="dashStatReports" class="text-2xl font-bold text-primary">4</span>
                            <span class="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-emerald-700/80">Reports</span>
                        </div>
                        <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 flex flex-col items-center justify-center shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-emerald-900/10 transition-colors" onclick="window.app.scrollToDashboardSection('sightings')">
                            <span id="dashStatSightings" class="text-2xl font-bold text-primary">1</span>
                            <span class="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-emerald-700/80">Sightings</span>
                        </div>
                        <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 flex flex-col items-center justify-center shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-emerald-900/10 transition-colors" onclick="window.app.scrollToDashboardSection('stories')">
                            <span id="dashStatStories" class="text-2xl font-bold text-primary">0</span>
                            <span class="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-emerald-700/80">Stories</span>
                        </div>
                        <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 flex flex-col items-center justify-center shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-emerald-900/10 transition-colors" onclick="window.app.scrollToDashboardSection('missions')">
                            <span id="dashStatMissions" class="text-2xl font-bold text-primary">0</span>
                            <span class="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-emerald-700/80">Missions</span>
                        </div>
                        <div class="col-span-2 bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 flex flex-col items-center justify-center shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-emerald-900/10 transition-colors" onclick="window.app.scrollToDashboardSection('comments')">
                            <span id="dashStatComments" class="text-2xl font-bold text-primary">1</span>
                            <span class="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-emerald-700/80">Interactions</span>
                        </div>
                    </div>

                    <div class="space-y-10">
                        <section id="dashListSection-reports">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-bold">Recent Reports</h3>
                                <button class="text-primary text-xs font-semibold" onclick="window.app.scrollToSection('reports'); window.app.closeModal();">View Map</button>
                            </div>
                            <div id="dashboardReportsList" class="space-y-3">
                <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 shadow-sm flex items-center justify-between">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
                            <span class="material-icons-round text-slate-400 dark:text-emerald-800 text-xl">assignment</span>
                        </div>
                        <div class="overflow-hidden">
                            <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">Aundh</h4>
                            <p class="text-xs text-slate-500 dark:text-emerald-700/70 truncate">aaaaaaaaaaaaaaaaaaaaaaaaaaa</p>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wider">pending</span>
                </div>
            
                <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 shadow-sm flex items-center justify-between">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
                            <span class="material-icons-round text-slate-400 dark:text-emerald-800 text-xl">assignment</span>
                        </div>
                        <div class="overflow-hidden">
                            <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">Aundh</h4>
                            <p class="text-xs text-slate-500 dark:text-emerald-700/70 truncate"> rgg s sge s</p>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wider">pending</span>
                </div>
            
                <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 shadow-sm flex items-center justify-between">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
                            <span class="material-icons-round text-slate-400 dark:text-emerald-800 text-xl">assignment</span>
                        </div>
                        <div class="overflow-hidden">
                            <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">Aundh</h4>
                            <p class="text-xs text-slate-500 dark:text-emerald-700/70 truncate"> sdfv s</p>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wider">pending</span>
                </div>
            </div>
                        </section>

                        <section id="dashListSection-sightings">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-bold">Recent Sightings</h3>
                                <button class="text-primary text-xs font-semibold" onclick="window.app.scrollToSection('nf-sightings'); window.app.closeModal();">View All</button>
                            </div>
                            <div id="dashboardSightingsList" class="space-y-3">
                <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 shadow-sm flex items-center justify-between">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
                            <span class="material-icons-round text-slate-400 dark:text-emerald-800 text-xl">visibility</span>
                        </div>
                        <div class="overflow-hidden">
                            <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">PONDA</h4>
                            <p class="text-xs text-slate-500 dark:text-emerald-700/70 truncate">TEST</p>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wider">verified</span>
                </div>
            </div>
                        </section>

                        <section id="dashListSection-stories">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-bold">My Stories</h3>
                                <button class="text-primary text-xs font-semibold" onclick="window.app.scrollToSection('nf-stories'); window.app.closeModal();">View All</button>
                            </div>
                            <div id="dashboardStoriesList" class="space-y-3">
                <div class="bg-card-light dark:bg-card-dark border border-dashed border-slate-300 dark:border-emerald-900/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                    <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-emerald-950/50 flex items-center justify-center mb-3">
                        <span class="material-icons-round text-slate-400 dark:text-emerald-800">auto_stories</span>
                    </div>
                    <p class="text-sm font-medium text-slate-500 dark:text-emerald-700/70">No stories shared.</p>
                    <button class="mt-3 text-xs font-bold text-primary px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40" onclick="window.app.scrollToSection('eco-reporting'); window.app.closeModal();">Tell a Story</button>
                </div>
            </div>
                        </section>

                        <section id="dashListSection-missions">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-bold">Active Missions</h3>
                                <button class="text-primary text-xs font-semibold" onclick="window.app.scrollToSection('volunteer'); window.app.closeModal();">Browse</button>
                            </div>
                            <div id="dashboardMissionsList" class="space-y-3">
                <div class="bg-card-light dark:bg-card-dark border border-dashed border-slate-300 dark:border-emerald-900/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                    <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-emerald-950/50 flex items-center justify-center mb-3">
                        <span class="material-icons-round text-slate-400 dark:text-emerald-800">groups</span>
                    </div>
                    <p class="text-sm font-medium text-slate-500 dark:text-emerald-700/70">No missions joined.</p>
                    <button class="mt-3 text-xs font-bold text-primary px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40" onclick="window.app.scrollToSection('volunteer'); window.app.closeModal();">Browse Missions</button>
                </div>
            </div>
                        </section>

                        <section id="dashListSection-comments">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-bold">Comments &amp; Mentions</h3>
                            </div>
                            <div id="dashboardCommentsList" class="space-y-3">
                            <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 shadow-sm">
                                <div class="flex items-start gap-3">
                                    <div class="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center flex-shrink-0">
                                        <span class="material-icons-round text-primary text-sm">chat_bubble_outline</span>
                                    </div>
                                    <div class="flex-1">
                                        <p class="text-xs font-bold text-slate-400 dark:text-emerald-700/80 uppercase tracking-wider">You commented</p>
                                        <p class="text-sm text-slate-700 dark:text-slate-200 mt-1 line-clamp-2">yoo</p>
                                        <p class="text-[10px] text-slate-400 mt-1">3/4/2026</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </section>
                    </div>
                </div>

                <!-- Tab content: Alerts -->
                <div id="dashboardSection-alerts" class="dashboard-section hidden space-y-4">
                    <div id="dashboardAlertsList" class="space-y-3">
                        <p class="text-center text-slate-500 py-10">No new alerts.</p>
                    </div>
                    <button id="dashboardMarkReadBtn" class="w-full py-3 text-sm font-semibold text-primary border border-primary/20 rounded-xl hover:bg-primary/5 transition-colors">Mark all as read</button>
                </div>

                <button id="dashboardLogoutBtn" class="w-full py-4 mt-12 bg-slate-200/50 dark:bg-emerald-950/30 text-red-500 dark:text-red-400 font-bold rounded-2xl transition-all active:scale-95">
                    Logout
                </button>
            </div>
        </div>