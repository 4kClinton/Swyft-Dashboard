import { createClient } from '@supabase/supabase-js';

// Credentials come from the environment (.env -> VITE_* vars), never hardcoded.
// Note: VITE_ vars are inlined into the client bundle at build time, so the
// anon key is still visible to end users by design — data is protected by RLS,
// not by hiding this key. Keeping it in env just keeps it out of source/history.
const supabaseUrl = import.meta.env.VITE_SUPABASEURL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase config: set VITE_SUPABASEURL and VITE_SUPABASE_ANON_KEY in your .env'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase, supabaseUrl };
