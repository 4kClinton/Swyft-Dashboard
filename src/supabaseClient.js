// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =import.meta.env.VITE_SUPABASEURL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
