# NewFeatures Module — Goa Eco-Guard

A self-contained feature pack adding **4 new capabilities** to the Eco-Guard platform.

## Features

| Feature                  | Description                                        |
| ------------------------ | -------------------------------------------------- |
| **Eco-Stories**          | Social feed with Before/After image slider, likes  |
| **Biodiversity Tracker** | Species sighting reports + green pins on heatmap   |
| **Proximity Alerts**     | Floating banner when a critical report is near you |
| **Mission Reminders**    | Daily 8 AM email for missions in the next 3 days   |

## Setup

### Step 1: Database

Run `schema.sql` inside **Supabase SQL Editor** to create the `eco_stories` and `eco_sightings` tables.

### Step 2: Install dependency

```bash
npm install node-cron
```

### Step 3: Activate in server.js

Uncomment these lines near the bottom:

```js
app.use(require("./NewFeatures/newFeaturesRoutes"));
require("./NewFeatures/reminderCron");
```

### Step 4: Activate in index.html

Uncomment these lines near `</body>`:

```html
<link rel="stylesheet" href="NewFeatures/newFeatures.css" />
<script src="NewFeatures/newFeatures.js"></script>
```

### Step 5: Restart

```bash
npm run dev
```

## Removal

1. Delete the `NewFeatures/` folder
2. Re-comment or delete the 4 lines added above
3. (Optional) Drop tables: `DROP TABLE eco_stories; DROP TABLE eco_sightings;`

**Zero side effects on the main project.**

## File Structure

```
NewFeatures/
├── schema.sql              # Database tables SQL
├── newFeaturesRoutes.js     # Express router (7 API endpoints)
├── reminderCron.js          # Daily email reminder cron
├── newFeatures.css          # Scoped styles (.nf- prefix)
├── newFeatures.js           # Frontend logic (self-injecting)
└── README.md                # This file
```
