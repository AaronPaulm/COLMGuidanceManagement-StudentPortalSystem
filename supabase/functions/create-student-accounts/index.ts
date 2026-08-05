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

// Dev-only allowlist — widen this to the real deployed origin(s)
// once the site is hosted somewhere other than localhost.
const ALLOWED_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
  if (origin === "null" || ALLOWED_ORIGIN_PATTERN.test(origin)) headers["Access-Control-Allow-Origin"] = origin;
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

    // firstname.lastname@colm.edu.ph is a lot friendlier than the old
    // firstname.lastname.stu-yymmdd-001@guidance.local, but it's no longer
    // unique on its own — two same-named students would collide. The old
    // format leaned on the student number to sidestep that entirely; this
    // just handles the collision directly by appending 2, 3, etc. for
    // repeats within this same import (a cross-batch collision, i.e. a new
    // student sharing a name with someone already imported earlier, still
    // fails at createUser() below and shows up as a normal failed row).
    const usedEmailSlugs = new Set<string>();

    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      const firstName = (row.firstName || "").trim();
      const lastName = (row.lastName || "").trim();
      const studentNumber = `${currentYear}-${String(nextSeq).padStart(4, "0")}`;
      nextSeq++;

      const baseSlug = `${slugify(firstName)}.${slugify(lastName) || "student"}`;
      let emailSlug = baseSlug;
      let suffix = 2;
      while (usedEmailSlugs.has(emailSlug)) {
        emailSlug = `${baseSlug}${suffix}`;
        suffix++;
      }
      usedEmailSlugs.add(emailSlug);

      const email = `${emailSlug}@colm.edu.ph`;
      const tempPassword = STUDENT_TEMP_PASSWORD;

      if (!firstName) {
        results.push({
          firstName,
          lastName,
          studentNumber,
          email,
          tempPassword: "",
          success: false,
          error: "Missing first name",
        });
        continue;
      }

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

      if (createError || !created?.user) {
        results.push({
          firstName,
          lastName,
          studentNumber,
          email,
          tempPassword: "",
          success: false,
          error: createError?.message || "Couldn't create auth user",
        });
        continue;
      }

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
        first_name: firstName,
        middle_name: row.middleName?.trim() || null,
        last_name: lastName || null,
        year_level: row.level?.trim() || null,
        section: section || null,
        contact_number: row.contactNumber?.trim() || null,
        education_level: inferEducationLevel(row.level) || educationLevel || null,
      });

      if (studentError) {
        await adminClient.auth.admin.deleteUser(newUserId);
        results.push({
          firstName,
          lastName,
          studentNumber,
          email,
          tempPassword: "",
          success: false,
          error: "Couldn't create student record: " + studentError.message,
        });
        continue;
      }

      results.push({ firstName, lastName, studentNumber, email, tempPassword, success: true, error: null });
    }

    return json({ success: true, results });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
