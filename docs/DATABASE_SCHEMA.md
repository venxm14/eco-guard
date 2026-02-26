# Database Schema Requirements

This document outlines the database tables needed for the Goa Eco-Guard application.

## Required Tables

### 1. `eco_spots` Table
This table stores eco-friendly spots (hotels, restaurants, places) that admins can create.

```sql
CREATE TABLE eco_spots (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rating DECIMAL(3,1) DEFAULT 0.0,
  location VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL, -- e.g., 'Hotel', 'Restaurant', 'Place'
  price VARCHAR(100), -- e.g., 'From ₹8,000/night'
  features TEXT, -- Comma-separated features like 'Solar Energy, Organic Gardens'
  details TEXT, -- Additional details
  image VARCHAR(255), -- Image filename
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. `eco_reports` Table (Update)
Add a `deleted_at` column for soft delete functionality:

```sql
ALTER TABLE eco_reports 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
```

### 3. Existing Tables
The following tables should already exist:
- `users` - User accounts
- `eco_reports` - Environmental reports
- `missions` - Volunteer missions
- `mission_registrations` - Mission participants
- `eco_guides` - Eco guide entries

## Supabase Setup

**📖 For detailed Supabase setup instructions, see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**

Quick steps:
1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL scripts provided in `SUPABASE_SETUP.md`
3. Or use the Table Editor GUI (instructions in the guide)

The setup guide includes:
- Step-by-step SQL commands
- GUI-based setup instructions
- Row Level Security (RLS) policies
- Testing queries
- Troubleshooting tips

## Notes

- The `deleted_at` column in `eco_reports` allows for soft deletes (reports are marked as deleted but not removed from database)
- The `features` column stores comma-separated values that are split in the frontend
- Images are stored in the `uploads/` directory and referenced by filename
