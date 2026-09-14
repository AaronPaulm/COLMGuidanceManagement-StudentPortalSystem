// ============================================================
// Supabase connection config
// ============================================================
// Get these two values from: Supabase Dashboard > Project Settings > API
// SUPABASE_URL looks like: https://xxxxx.supabase.co
// SUPABASE_ANON_KEY is the long "anon public" key (safe to expose in frontend)

const SUPABASE_URL = "https://oielonytnnfxbzpginmh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZWxvbnl0bm5meGJ6cGdpbm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjY0NDgsImV4cCI6MjA5OTYwMjQ0OH0.n6UypguUlnUFUQ6InUKvHpwCJq_xGhlsZuEpBnt7e3w";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// Global double-submit protection
// ============================================================
// Blocks a form from firing twice within a short window, so a slow
// connection or a double click can't queue up a duplicate request
// (e.g. two password-reset emails). This file is loaded on every
// page, so this guard applies to every form in the system without
// per-page wiring. A form can opt into a longer window with
// data-submit-cooldown="<milliseconds>".
document.addEventListener(
  "submit",
  (e) => {
    const form = e.target.closest("form");
    if (!form) return;
    const cooldown = Number(form.dataset.submitCooldown) || 3000;
    if (form.dataset.colmSubmitTs && Date.now() - Number(form.dataset.colmSubmitTs) < cooldown) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    } else {
      form.dataset.colmSubmitTs = String(Date.now());
    }
  },
  true
);
