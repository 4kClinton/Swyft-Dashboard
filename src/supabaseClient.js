// // src/supabaseClient.js
// import { createClient } from '@supabase/supabase-js';

// const supabaseUrl =import.meta.env.VITE_SUPABASEURL;
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// export const supabase = createClient(supabaseUrl, supabaseAnonKey);


import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseUrl = "https://gtevlsbundbddlqqslbf.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0ZXZsc2J1bmRiZGRscXFzbGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4MDE3MTEsImV4cCI6MjA1MTM3NzcxMX0.K0j3QjXqb-WZ3bOf8jlSDcmjV68OMYKet4_xf52kNXM"
// const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase };