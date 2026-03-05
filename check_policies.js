require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function checkPolicies() {
  console.log('--- Fetching RLS Policies ---');
  
  // We can query pg_policies via RPC if one is set up, OR
  // Since we might not have direct SQL access through the JS client without an RPC,
  // Let's try to query a known secure table first to see if RLS blocks us.
  
  // Actually, Supabase REST API doesn't expose pg_policies directly by default.
  // We have a REST endpoint `/api/policies` in server.js from before!
  
  try {
    const response = await fetch('http://localhost:3000/api/policies');
    
    if (response.ok) {
       const data = await response.json();
       console.log('--- Policies from /api/policies ---');
       console.log(JSON.stringify(data, null, 2));
    } else {
       console.log('Failed to fetch from /api/policies. Status:', response.status);
    }
  } catch(e) {
      console.error("Error fetching policies:", e.message);
  }

}

checkPolicies();
