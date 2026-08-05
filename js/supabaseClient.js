// ============================================================
// Supabase connection config
// ============================================================
// Get these two values from: Supabase Dashboard > Project Settings > API
// SUPABASE_URL looks like: https://xxxxx.supabase.co
// SUPABASE_ANON_KEY is the long "anon public" key (safe to expose in frontend)

const SUPABASE_URL = "https://oielonytnnfxbzpginmh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZWxvbnl0bm5meGJ6cGdpbm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjY0NDgsImV4cCI6MjA5OTYwMjQ0OH0.n6UypguUlnUFUQ6InUKvHpwCJq_xGhlsZuEpBnt7e3w";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
