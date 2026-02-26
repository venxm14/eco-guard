# Schema Compatibility Notes

Your Supabase schema has been verified and the code has been updated to match.

## Schema Differences Handled

### ✅ Fixed: `mission_registrations.registered_at`
- **Database:** Uses `registered_at` (timestamp without time zone)
- **Code:** Updated to use `registered_at` and map to `created_at` for frontend compatibility
- **Status:** ✅ Fixed in `server.js` and `admin.js`

### ✅ Verified: UUID vs BigInt
- **Database:** Uses UUID for `users.id`, `missions.id`, `mission_registrations.id`
- **Code:** Already compatible (Supabase handles UUID automatically)
- **Status:** ✅ No changes needed

### ✅ Verified: Table Structure
All tables match expected structure:
- ✅ `eco_reports` - Has `deleted_at` column
- ✅ `eco_spots` - All columns present
- ✅ `missions` - All columns present
- ✅ `mission_registrations` - Has foreign key to missions
- ✅ `users` - Has role column with check constraint

## Code Updates Made

1. **server.js** - Updated mission participants endpoint to use `registered_at`
2. **admin.js** - Updated to handle both `created_at` and `registered_at` for compatibility

## Testing Your Schema

Run this to verify everything matches:

```sql
-- Verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'eco_reports', 'missions', 'mission_registrations', 'eco_guides', 'eco_spots')
ORDER BY table_name;

-- Verify mission_registrations structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'mission_registrations'
ORDER BY ordinal_position;

-- Verify foreign key relationship
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'mission_registrations';
```

## All Good! ✅

Your schema is compatible and the code has been updated. You can now:
1. Start your server
2. Test the admin panel
3. Create eco spots
4. View mission participants

No further database changes needed!
