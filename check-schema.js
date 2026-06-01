import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("Missing credentials in env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Profile schema:", Object.keys(data[0] || {}));
  }
}
main();
