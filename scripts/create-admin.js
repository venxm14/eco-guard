// ============================================
// CREATE ADMIN USER SCRIPT
// ============================================
// Run this script to create an admin user
// Usage: node create-admin.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const readline = require('readline');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
  try {
    console.log('\n=== Create Admin User for Goa Eco-Guard ===\n');
    
    const name = await question('Enter admin name: ');
    const email = await question('Enter admin email: ');
    const password = await question('Enter admin password: ');
    const phone = await question('Enter admin phone (optional, press Enter to skip): ') || null;
    
    // Hash the password
    console.log('\nHashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      console.log('\n⚠️  User with this email already exists.');
      const update = await question('Do you want to update this user to admin? (y/n): ');
      
      if (update.toLowerCase() === 'y') {
        const { data, error } = await supabase
          .from('users')
          .update({ 
            role: 'admin',
            password: hashedPassword,
            name: name
          })
          .eq('email', email)
          .select()
          .single();
        
        if (error) throw error;
        console.log('\n✅ User updated to admin successfully!');
        console.log(`\nAdmin Details:`);
        console.log(`  Email: ${data.email}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  Role: ${data.role}`);
      } else {
        console.log('Operation cancelled.');
      }
    } else {
      // Create new admin user
      const { data, error } = await supabase
        .from('users')
        .insert([{
          name,
          email,
          password: hashedPassword,
          phone,
          role: 'admin'
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('\n✅ Admin user created successfully!');
      console.log(`\nAdmin Details:`);
      console.log(`  Email: ${data.email}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Role: ${data.role}`);
      console.log(`\nYou can now login with:`);
      console.log(`  Email: ${email}`);
      console.log(`  Password: [the password you entered]`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

createAdmin();
