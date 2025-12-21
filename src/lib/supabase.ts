import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zujluhkocphqqnljouiv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1amx1aGtvY3BocXFubGpvdWl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzU4MjEsImV4cCI6MjA3OTMxMTgyMX0.iMS5_ta2SPdoOpvBFcY9lzC8raBYnDjg06_ySTPwG_w";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
