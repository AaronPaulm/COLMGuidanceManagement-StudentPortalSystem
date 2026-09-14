// Supabase Edge Function: create-student-accounts
//
// Called from counselor-account.html after parsing an uploaded .xlsx roster
// (fname, mname, lname, level, contact number — no email/student number
// column, since the school's sheet doesn't have one). Education level and
// section apply to the whole batch, set once in the import UI rather than
// per row. To let each
// imported student actually log in, this function generates a student
// number + a placeholder login email per row, creates the auth account via
// the Admin API (needs the service-role key, so this can't run client-side),
// and returns the generated credentials for the counselor to hand out —
// same manual-relay pattern as create-staff-account.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy create-student-accounts
//
// No new secrets needed — SUPABASE_URL, SUPABASE_ANON_KEY, and
// SUPABASE_SERVICE_ROLE_KEY are provided automatically to every function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS origin allowlist (same pattern as notify-student-email).
// 1. Built-in defaults: localhost, 127.0.0.1, private LAN ranges, "null".
// 2. Extra origins via ALLOWED_ORIGINS secret (comma-separated, supports "*"
//    wildcard, e.g. "https://*.vercel.app,https://colmguidance.org").
const DEFAULT_ALLOWED_ORIGIN_PATTERN =
  /^https?:\/\/(?:(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?)$/;

function isOriginAllowed(origin: string): boolean {
  if (origin === "null") return true;
  if (DEFAULT_ALLOWED_ORIGIN_PATTERN.test(origin)) return true;
  const extra = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  return extra.some((pattern: string) => {
    const re = new RegExp(
      "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"
    );
    return re.test(origin);
  });
}

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
  if (isOriginAllowed(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
  
// Every bulk-imported student gets the same standard first-login password
// rather than a random one per row — the school's preference, so students
// can be told this password verbally/in a group instead of relying on the
// printed per-student slip.
const STUDENT_TEMP_PASSWORD = "colmstudent";

function slugify(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining accents after NFD split
    .replace(/[^a-z0-9]+/g, "");
}

// The batch-level "Education Level" dropdown assumes every row in the
// sheet is the same level, which breaks the moment a roster mixes grades
// (e.g. Grade 10 alongside Grade 11 in one file) \u2014 the wrong students
// would get labeled with whatever the counselor picked for the whole
// batch. Read it straight off each row's own Level text instead, when it
// matches a known value; the dropdown only kicks in as a fallback for
// rows where Level doesn't match anything recognized.
function inferEducationLevel(levelText: string | undefined): string | null {
  const normalized = (levelText || "").trim().toLowerCase();
  if (["grade 7", "grade 8", "grade 9", "grade 10"].includes(normalized)) return "junior_high";
  if (["grade 11", "grade 12"].includes(normalized)) return "senior_high";
  if (["1st year", "2nd year", "3rd year", "4th year"].includes(normalized)) return "college";
  return null;
}

interface StudentRow {
  firstName: string;
  middleName?: string;
  lastName?: string;
  level?: string;
  contactNumber?: string;
}

interface StudentResult {
  firstName: string;
  lastName: string;
  studentNumber: string;
  username: string;
  email: string;
  tempPassword: string;
  success: boolean;
  error: string | null;
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: "Not authenticated" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerCounselor } = await adminClient
      .from("counselors")
      .select("counselor_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!callerCounselor) return json({ error: "Only counselors can import student accounts" }, 403);

    const { students, educationLevel, section } = (await req.json()) as {
      students: StudentRow[];
      educationLevel?: string;
      section?: string;
    };
    if (!Array.isArray(students) || students.length === 0) {
      return json({ error: "No student rows provided" }, 400);
    }
    if (students.length > 300) {
      return json({ error: "Import is limited to 300 rows at a time — split the file and retry." }, 400);
    }

    // Student numbers look like "2026-0001" — year, then a sequential
    // count that continues across every import/creation done that year
    // (not just within one batch), resetting back to 0001 when the year
    // changes. Since each function call is stateless, find where the
    // count currently stands by checking existing numbers for this year.
    const currentYear = new Date().getFullYear();
    const { data: existingForYear } = await adminClient
      .from("students")
      .select("student_number")
      .like("student_number", `${currentYear}-%`);

    let nextSeq = 1;
    const seqPattern = new RegExp(`^${currentYear}-(\\d+)$`);
    for (const row of existingForYear || []) {
      const match = row.student_number?.match(seqPattern);
      if (match) nextSeq = Math.max(nextSeq, parseInt(match[1], 10) + 1);
    }

    const results: StudentResult[] = [];

    // ── Username generation ──────────────────────────────────────────────
    // Each student gets a human-readable username (e.g. juan.delacruz) for
    // login instead of the fake internal email. When a name collides with
    // an existing student or an earlier entry in this batch, the student
    // number's last 4 digits are appended (e.g. juan.delacruz0001).
    const usedUsernames = new Set<string>();
    const { data: existingUsernameRows } = await adminClient
      .from("students")
      .select("username")
      .not("username", "is", null);
    for (const row of existingUsernameRows || []) {
      if (row.username) usedUsernames.add(row.username);
    }

    // Safety net: if the computed email still clashes in auth (extremely
    // unlikely given the username-guarantee above), bump a numeric suffix.
    const MAX_EMAIL_ATTEMPTS = 20;

    function isEmailTakenError(error: { code?: string; message?: string } | null): boolean {
      if (!error) return false;
      if (error.code === "email_exists") return true;
      return /already\s+(registered|exists|been registered)/i.test(error.message || "");
    }

    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      const firstName = (row.firstName || "").trim();
      const lastName = (row.lastName || "").trim();
      const studentNumber = `${currentYear}-${String(nextSeq).padStart(4, "0")}`;
      nextSeq++;

      const baseSlug = `${slugify(firstName)}.${slugify(lastName) || "student"}`;
      const studentNumSuffix = studentNumber.split("-")[1] || "0001";
      let username = baseSlug;
      if (usedUsernames.has(username)) {
        username = `${baseSlug}${studentNumSuffix}`;
      }
      let emailSlug = username;
      let suffix = 2;

      const tempPassword = STUDENT_TEMP_PASSWORD;

      if (!firstName) {
        results.push({
          firstName,
          lastName,
          studentNumber,
          username,
          email: `${emailSlug}@colm.edu.ph`,
          tempPassword: "",
          success: false,
          error: "Missing first name",
        });
        continue;
      }

      let email = `${emailSlug}@colm.edu.ph`;
      let created: { user?: { id: string } } | null = null;
      let createError: { code?: string; message?: string } | null = null;

      for (let attempt = 0; attempt < MAX_EMAIL_ATTEMPTS; attempt++) {
        const result = await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
        });
        created = result.data;
        createError = result.error;

        if (!createError || !isEmailTakenError(createError)) break;

        emailSlug = `${username}${suffix}`;
        suffix++;
        email = `${emailSlug}@colm.edu.ph`;
      }

      if (createError || !created?.user) {
        results.push({
          firstName,
          lastName,
          studentNumber,
          username,
          email,
          tempPassword: "",
          success: false,
          error: createError?.message || "Couldn't create auth user",
        });
        continue;
      }

      // The email that actually landed is the authoritative username —
      // keeps the two in lockstep if the retry loop above had to fire.
      username = emailSlug;
      usedUsernames.add(username);
      const newUserId = created.user.id;

      const { error: usersError } = await adminClient.from("users").insert({
        user_id: newUserId,
        role: "student",
      });

      if (usersError) {
        await adminClient.auth.admin.deleteUser(newUserId);
        results.push({
          firstName,
          lastName,
          studentNumber,
          username,
          email,
          tempPassword: "",
          success: false,
          error: "Couldn't create user record: " + usersError.message,
        });
        continue;
      }

      const { error: studentError } = await adminClient.from("students").insert({
        user_id: newUserId,
        student_number: studentNumber,
        username,
        first_name: firstName,
        middle_name: row.middleName?.trim() || null,
        last_name: lastName || null,
        year_level: row.level?.trim() || null,
        section: row.section?.trim() || section || null,
        contact_number: row.contactNumber?.trim() || null,
        education_level: inferEducationLevel(row.level) || educationLevel || null,
        email_verified: false,
        auth_email: email,
      });

      if (studentError) {
        await adminClient.auth.admin.deleteUser(newUserId);
        results.push({
          firstName,
          lastName,
          studentNumber,
          username,
          email,
          tempPassword: "",
          success: false,
          error: "Couldn't create student record: " + studentError.message,
        });
        continue;
      }

      results.push({ firstName, lastName, studentNumber, username, email, tempPassword, success: true, error: null });
    }

    return json({ success: true, results });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
