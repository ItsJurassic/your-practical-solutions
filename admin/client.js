import { CONFIG } from "../config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
export { CONFIG };
