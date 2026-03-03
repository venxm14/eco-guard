# User Profile & Notification System Plan

This plan outlines the expansion of the Settings menu into a full-featured User Profile, including contribution statistics, joined missions, and a social notification system.

## Proposed Changes

### Database Schema

#### [NEW] [profile_system.sql](file:///c:/Users/Sarvesh/Documents/final_project/Goa%20Eco-Guard/database/profile_system.sql)
- Create `social_notifications` table: [id](file:///c:/Users/Sarvesh/Documents/final_project/Goa%20Eco-Guard/NewFeatures/newFeatures.js#263-270), `user_id` (recipient), `actor_id` (who liked/commented), `item_id`, `item_type`, `action_type` (like/comment), `is_read`, `created_at`.
- Add `notifications_count` to `users` table for real-time badge updates.
- Ensure `phone` column exists in `users` table (migration if needed).

### Backend Implementation

#### [MODIFY] [server.js](file:///c:/Users/Sarvesh/Documents/final_project/Goa%20Eco-Guard/server.js)
- Add `/api/profile/stats` endpoint: Aggregate counts for Reports, Sightings, Stories, and Missions for the logged-in user.
- Add `/api/profile/update` endpoint: Allow updating `name` and `phone`. `email` remains protected.
- Add `/api/notifications` (GET) and `/api/notifications/read` (POST) endpoints.

#### [MODIFY] [NewFeatures/socialRoutes.js](file:///c:/Users/Sarvesh/Documents/final_project/Goa%20Eco-Guard/NewFeatures/socialRoutes.js)
- Hook into `POST /api/social/like` and `POST /api/social/comment` to trigger a notification record creation for the item owner.

### Frontend Implementation

#### [MODIFY] [index.html](file:///c:/Users/Sarvesh/Documents/final_project/Goa%20Eco-Guard/index.html)
- Redesign `settingsModal` into a "User Profile" modal.
- Sections:
  - **Account Details**: Profile Picture, Name (Editable), Phone (Editable), Email (Locked).
  - **Your Impact (Stats)**: 4 cards with counts (Reports, Sightings, Stories, Missions).
  - **Notifications**: A list showing recent likes/comments on user's posts.
  - **Mission History**: List of details for joined missions.

#### [MODIFY] [script.js](file:///c:/Users/Sarvesh/Documents/final_project/Goa%20Eco-Guard/script.js)
- Add logic to fetch profile stats and notifications on modal open.
- Implement the "Notification Red Dot" on the settings icon via `setInterval` or after actions.
- Add `updateProfile()` logic to handle the new form submission.

### Styling

#### [MODIFY] [socialStyles.css](file:///c:/Users/Sarvesh/Documents/final_project/Goa%20Eco-Guard/socialStyles.css)
- Add styles for the Profile Modal (Stats cards, Notification list, Red dot badge).

## Verification Plan

### Automated Tests
- `curl -H "Authorization: Bearer ..." /api/profile/stats` -> Verify correct counts.
- `curl -X POST -H "Authorization: Bearer ..." /api/social/like` -> Verify notification entry in DB.

### Manual Verification
- **Profile Edit**: Update name/phone, refresh, verify persists. Try to edit email (should be impossible).
- **Notifications**: Like a report from a different account, verify the red dot appears on the target user's settings icon.
- **Mission History**: Join a mission, verify it appears in the "Missions" count and list in the profile.


script.js:1406 Uncaught TypeError: this.switchFeed is not a function
    at GoaEcoGuard.switchTab (script.js:1406:18)
    at HTMLAnchorElement.<anonymous> (script.js:1229:22)

there some error even i cant press mission and setting option 

also add that setting option in w3ebsite too 

go through and check for error for buds 