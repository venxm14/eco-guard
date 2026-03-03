# 🌿 Goa Eco-Guard: Project Workflow & Features Guide

Welcome! This guide explains how the Goa Eco-Guard project works in simple terms. It's designed for beginners to understand how the frontend, backend, and database talk to each other to protect Goa's environment.

---

## 🏗️ 1. Project Architecture (How it Works)

This project follows a **Client-Server** model:

1.  **Frontend (The Face):** What you see in your browser (HTML, CSS, JS).
2.  **Backend (The Brain):** The server that processes data (Node.js & Express).
3.  **Database (The Memory):** Where all information is stored forever (Supabase).

**The Simple Path:**
When you report garbage on the map:

- **Frontend** asks for your location.
- **Backend** verifies the image using AI.
- **Database** saves the report so everyone can see it.

---

## 🚦 2. How Routes Work (The Traffic Control)

"Routes" are like specific addresses for different tasks. They are handled in `server.js` and `NewFeatures/newFeaturesRoutes.js`.

- **/api/auth/register**: Used to create a new account.
- **/api/auth/login**: Used to sign in.
- **/api/report**: Where reports are sent to be saved.
- **/api/stories**: Fetch or post environmental success stories (Before/After).
- **/api/sightings**: Report sightings of local flora and fauna.

---

## 💾 3. How the Database Works (The Library)

We use **Supabase** (based on PostgreSQL). Think of it as a collection of spreadsheets (Tables):

- **Users Table**: Names, emails, and encrypted passwords.
- **Eco_Reports Table**: Locations of garbage, status (pending/resolved), and images.
- **Eco_Stories Table**: Success stories with before/after photos.
- **Social_Notifications Table**: Tracks when someone likes or comments on your post.

---

## 📁 4. File-by-File Explanation

Here is a breakdown of every important file in the project:

### 🏠 Root Folder

- **index.html**: The main door to the website. It contains the structure of the homepage.
- **script.js**: The most important frontend file. It handles the map, loads reports, and manages how the page changes when you click buttons.
- **server.js**: The heart of the backend. It connects to the database, handles security, and serves the API.
- **styles.css**: The master stylesheet that makes the website look premium and modern.
- **socialStyles.css**: Specific styles for social features like comments and likes.
- **loading.html**: A beautiful animation shown while the main app is waking up.
- **create-admin.js**: A helper script used once to create the very first administrator account.
- **.env**: A secret file containing your database "keys" (passwords). **Never share this!**
- **package.json**: The "instruction manual" for Node.js, listing all the tools (libraries) needed.

### 🔐 login/ Folder

- **login.html / signup.html**: The specific pages for entering or creating accounts.
- **auth.js**: The logic for these pages; it talks to the server to check your password.
- **auth.css**: Styles specific to the login and signup visuals.

### 🛡️ admin/ Folder

- **admin.html**: The dashboard for managers.
- **admin.js**: Allows admins to delete reports, verify users, and manage the platform.
- **admin.css**: Clean, professional styles for the management interface.

### 🚀 NewFeatures/ Folder

- **newFeatures.js**: Adds Eco-Stories and Sighting reports to the main map.
- **newFeaturesRoutes.js**: The backend logic for these new specialized features.
- **socialRoutes.js**: Handles the "Social" side—likes, comments, and following.
- **reminderCron.js**: An "alarm clock" script that automatically sends email reminders for upcoming cleanup missions.
- **schema.sql**: The instructions used to create the tables in the database.

### 🗄️ database/ Folder

- **Various .sql files**: These are "Recipes" for the database. If you ever need to reset or move the project, these files tell the database exactly how to rebuild itself.

---

## ✨ 5. How Features Work

### 📍 Eco-Reporting

Users take a photo of pollution. The system uses **AI (OpenAI/Nvidia)** to check if the photo is appropriate before saving it. It then places a pin on the map.

### 📸 Eco-Stories

A "Before & After" gallery. Users can swipe between two images to see the impact of a cleanup mission.

### 📧 Mission Reminders

When you join a "Mission" (a cleanup event), the `reminderCron.js` script keeps track of the date and sends you an email 3 days before it starts.

### 🏆 Leaderboard

Users earn "Impact Points" for every report they submit. The leaderboard shows the top "Eco-Warriors" in Goa.

---

## 🔍 6. How Core Functions Work (The Small Steps)

Inside the code, specific "Functions" do the heavy lifting. Here are the most important ones:

### ⚙️ Backend Functions (`server.js`)

- **`uploadToSupabase()`**:
  - _What it does:_ Takes a raw photo from a user, shrinks it (so it's not too big), converts it to JPEG, and uploads it to our storage "bucket".
  - _Why:_ To keep the website fast and ensure images are saved securely.
- **`authenticateToken()`**:
  - _What it does:_ This is a "Guard". Every time a user tries to do something private (like report garbage), it checks if they have a valid security token (JWT).
  - _Why:_ To make sure only logged-in users can post or change data.
- **`app.post('/api/report')`**:
  - _What it does:_ The most complex part! It receives the report details, sends the image to an **AI model** to check for safety (no faces/inappropriate content), and then saves the final report to the database.

### 🌐 Frontend Functions (`script.js`)

- **`init()`**:
  - _What it does:_ The "Power Switch". As soon as you open the page, this function wakes up the map, fetches the latest reports from the server, and turns on all the buttons so they respond to clicks.
- **`showToast()`**:
  - _What it does:_ Creates those smooth "success" or "error" popups you see.
  - _Why:_ To give users instant feedback (e.g., "Report Submitted!" or "Login Failed").
- **`renderMarkers()`**:
  - _What it does:_ Takes the list of reports from the database and draws them as pins on the Leaflet map. It uses different colors (Orange for pending, Green for resolved).
- **`AuthManager.login()`**:
  - _What it does:_ Collects your email/password, sends them to the server, and then saves your "Session" in the browser's memory (`localStorage`) so you don't have to log in every time you refresh.

---

### 💡 Tips for Beginners

- **CSS** = Visuals (Colors, Fonts).
- **JS** = Action (Clicking, Fetching).
- **SQL** = Storage (Saving, Searching).
- **Express** = Communication (Connecting Frontend to Database).

---

## 🛠️ 7. Expert-Level Technical Deep Dive

If an expert asks you "How is this built for the real world?", here is your technical arsenal:

### 🔒 Security & Data Integrity

- **Password Security:** We use **Bcrypt with 10 salt rounds**. We never store plain passwords. Even if the database is leaked, the passwords are "salted" and mathematically impossible to reverse-engineer.
- **Stateless Auth:** We use **JWT (JSON Web Tokens)**. Instead of the server remembering every user, the user carries a signed token. The server only needs to verify the "Signature" to know the user is legitimate.
- **RLS (Row Level Security):** Our database (Postgres) uses RLS policies. This means even if someone steals our public database key, they can only see what we explicitly allow them to see via policy rules.

### ⚡ Performance & Scalability

- **Image Optimization:** We don't just upload huge files. We use **Sharp** on the backend to resize images and compress them to 80% quality JPEG. This saves storage space and makes the map load 10x faster for mobile users.
- **AI Governance:** We integrated a **Vision Language Model (Nvidia Nemotron)**. It classifies images in real-time as `NORMAL`, `SENSITIVE`, or `UNWANTED`. This prevents the platform from being used for spam or inappropriate content without manual moderation.

### 🧩 System Architecture

- **Middleware Design:** Our Express server uses a "Pipeline" approach. Every request passes through a security check before touching the database.
- **Asset Management:** Images are stored in **Supabase Storage Buckets**, not on the server disk. This allows the project to scale to millions of users without running out of hard drive space.

---

## 💬 8. Common "Expert" Questions & Answers

**Q: How do you handle high traffic on the Leaflet map?**
_A: We use marker grouping and server-side limiters to ensure the browser doesn't crash when displaying thousands of pins._

**Q: What happens if the AI server is down?**
_A: The code has a `try-catch` safety net. If the AI fails, the system defaults to a "manual review" flag so the report is not lost, but still protected._

**Q: Why use Supabase instead of a local database?**
_A: It provides built-in API security, real-time data sync, and handles the infrastructure (backups/storage) so we can focus on building features._

**Q: Is the site mobile-responsive?**
_A: Yes, we use a custom-built Vanilla CSS grid and flexbox system (no bulky frameworks) to ensure it works perfectly on everything from an iPhone to a 4K monitor._
