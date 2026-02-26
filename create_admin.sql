-- ============================================
-- CREATE ADMIN USER FOR GOA ECO-GUARD
-- ============================================
-- Run this in Supabase SQL Editor
-- Replace the email and password with your desired admin credentials

-- First, hash your password using bcrypt
-- You can use an online bcrypt generator or Node.js:
-- const bcrypt = require('bcrypt');
-- const hash = await bcrypt.hash('your_password_here', 10);
-- console.log(hash);

-- Option 1: Insert a new admin user directly
-- Replace 'admin@example.com', 'Your Name', and the hashed password below
INSERT INTO users (name, email, password, phone, role, created_at)
VALUES (
  'Admin User',
  'admin@example.com',
  '$2b$10$YOUR_HASHED_PASSWORD_HERE', -- Replace with bcrypt hash of your password
  '1234567890',
  'admin',
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Option 2: Update an existing user to admin
-- Replace 'user@example.com' with the email of the user you want to make admin
UPDATE users 
SET role = 'admin' 
WHERE email = 'user@example.com';

-- Verify the admin user was created/updated
SELECT id, name, email, role, created_at 
FROM users 
WHERE role = 'admin';
