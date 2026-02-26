# Implementation Plan: NewFeatures Module

Build 4 features in a self-contained `NewFeatures/` folder that plugs into the main project via a single `require()` call and a single `<script>` tag.

## Modular Architecture

```
NewFeatures/
├── newFeatures.css          # All styles, scoped with .nf- prefix
├── newFeatures.js           # Frontend logic for all 4 features
├── newFeaturesRoutes.js     # Express router (all API endpoints)
├── reminderCron.js          # Mission reminder cron job
├── schema.sql               # SQL to create the two new tables
└── README.md                # Integration/removal instructions
```

### Integration Points (2 changes to main project)

#### [MODIFY] [server.js](file:///c:/Users/Sarvesh/Documents/final_project/ANM%20goa%20eco-guard/server.js)
Add **one line** before server start (~line 1518):
```js
app.use(require('./NewFeatures/newFeaturesRoutes'));
```

#### [MODIFY] [index.html](file:///c:/Users/Sarvesh/Documents/final_project/ANM%20goa%20eco-guard/index.html)
Add **two tags** before `</body>` and **two new nav buttons**:
```html
<link rel="stylesheet" href="NewFeatures/newFeatures.css">
<script src="NewFeatures/newFeatures.js"></script>
```

> [!IMPORTANT]
> To remove: delete the `NewFeatures/` folder, remove those 2 lines from [server.js](file:///c:/Users/Sarvesh/Documents/final_project/ANM%20goa%20eco-guard/server.js) and the 2 tags + nav buttons from [index.html](file:///c:/Users/Sarvesh/Documents/final_project/ANM%20goa%20eco-guard/index.html). Zero side effects.

---

## Proposed Changes

### 1. Database Schema — [schema.sql](file:///c:/Users/Sarvesh/Documents/final_project/ANM%20goa%20eco-guard/NewFeatures/schema.sql)

Two new tables: `eco_stories` and `eco_sightings`. User must run this SQL in Supabase SQL Editor.

---

### 2. Backend Routes — [newFeaturesRoutes.js](file:///c:/Users/Sarvesh/Documents/final_project/ANM%20goa%20eco-guard/NewFeatures/newFeaturesRoutes.js)

An Express `Router` exporting all new endpoints:

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/stories` | No | Paginated story feed |
| `POST` | `/api/stories` | Yes | Create story (before/after images) |
| `POST` | `/api/stories/:id/like` | No | Increment like count |
| `GET` | `/api/sightings` | No | All sighting pins for map |
| `POST` | `/api/sightings` | Yes | Submit species sighting |
| `POST` | `/api/user/location` | Yes | Save user coords for proximity |
| `GET` | `/api/alerts/nearby` | Yes | Check critical reports within 5km |

---

### 3. Mission Reminder Cron — [reminderCron.js](file:///c:/Users/Sarvesh/Documents/final_project/ANM%20goa%20eco-guard/NewFeatures/reminderCron.js)

Uses `node-cron` to run daily at 8 AM. Queries missions happening in the next 3 days, sends reminder emails via existing `nodemailer` transporter.

---

### 4. Frontend — [newFeatures.js](file:///c:/Users/Sarvesh/Documents/final_project/ANM%20goa%20eco-guard/NewFeatures/newFeatures.js) + [newFeatures.css](file:///c:/Users/Sarvesh/Documents/final_project/ANM%20goa%20eco-guard/NewFeatures/newFeatures.css)

Four new HTML sections injected via JS into `<main>`:
- **Eco-Stories** — Card feed with Before/After image slider, like button
- **Sighting Reports** — Form + green pins on the existing Leaflet map
- **Proximity Alerts** — Floating banner when critical report is nearby
- **Mission Reminders** — Opt-in checkbox in join modal

All CSS classes prefixed with `.nf-` to avoid conflicts.

---

## Verification Plan

1. Run `schema.sql` in Supabase
2. Install `node-cron`: `npm install node-cron`
3. Add one `require()` line to [server.js](file:///c:/Users/Sarvesh/Documents/final_project/ANM%20goa%20eco-guard/server.js)
4. Add CSS/JS tags to [index.html](file:///c:/Users/Sarvesh/Documents/final_project/ANM%20goa%20eco-guard/index.html)
5. Test each endpoint with browser/curl
6. Submit a test story, sighting, and trigger the reminder cron manually
