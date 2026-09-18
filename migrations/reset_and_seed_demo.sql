-- ============================================================
-- reset_and_seed_demo.sql
--
-- Destructive, presentation-ready reset: wipes every public table,
-- every auth account, and every stored file, then re-seeds the whole
-- system with dummy data so a demo looks alive from the first click.
--
-- Run from the Supabase Dashboard -> SQL Editor, AFTER all other
-- migrations have been applied. Re-running is safe: it self-resets
-- before seeding again.
--
-- Demo accounts (password for ALL: Demo1234!)
-- ------------------------------------------------------------
--   ROLE        LOGIN                     PASSWORD
--   Counselor   anna.reyes@colm.edu.ph    Demo1234!
--   Counselor   mark.villanueva@colm.edu.ph Demo1234!
--   Counselor   liza.santos@colm.edu.ph   Demo1234!  (deactivated, cannot log in)
--   Student     juan.delacruz@colm.edu.ph Demo1234!
--   Student     maria.santos@colm.edu.ph  Demo1234!
--   (12 more students: data rows only)
--
-- On the login page you can also type the USERNAME instead of the
-- email (username resolves to the auth email):
--   anna.reyes / mark.villanueva / juan.delacruz / maria.santos / ...
--
-- Deliberately NOT seeded (they are file-based and would render
-- broken in a presentation):
--   * visit_logs                 (signature image does not load)
--   * case_session_attachments   (PDF/image rows)
--   * case_signed_documents      (PDF/image rows)
--   * interventions              (NOT NULL file_path/file_name = PDF rows)
--   * intervention_templates     (NOT NULL file_path/file_name = PDF rows)
--
-- Storage buckets themselves are kept, just emptied.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. WIPE EVERYTHING
-- ------------------------------------------------------------

-- Truncate every public table in one dynamic pass. CASCADE handles
-- FK ordering; RESTART IDENTITY resets the identity/sequence counters
-- so dummy rows start at 1 again. RLS does not block TRUNCATE.
do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute format('truncate table public.%I restart identity cascade', t.tablename);
  end loop;
end $$;

-- Wipe all login accounts (identities + sessions cascade). Nobody who
-- was signed in stays signed in afterwards.
delete from auth.users;

-- Wipe uploaded files (case attachments, signed documents, etc.).
-- Buckets themselves are kept so the app still has somewhere to upload.
delete from storage.objects;

-- ------------------------------------------------------------
-- 2. AUTH ACCOUNTS (logins)
-- ------------------------------------------------------------
-- Deterministic UUIDs so re-runs never collide. Passwords are bcrypt-
-- hashed at insert time via pgcrypto (crypt / gen_salt), which GoTrue
-- verifies natively.
-- NOTE: if this project's auth.users schema has extra NOT NULL columns
-- beyond this standard set, add them to the column list below.

with demo_emails (id, email) as (
  values
    ('00000000-0000-0000-0000-000000000001', 'anna.reyes@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000002', 'mark.villanueva@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000003', 'liza.santos@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000101', 'juan.delacruz@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000102', 'maria.santos@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000103', 'paolo.mendoza@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000104', 'ana.bautista@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000105', 'carlo.reyes@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000106', 'sophia.tan@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000107', 'miguel.aquino@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000108', 'bea.navarro@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000109', 'lance.dizon@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000110', 'ela.ramos@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000111', 'nico.paredes@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000112', 'iris.lim@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000113', 'gabriel.torres@colm.edu.ph'),
    ('00000000-0000-0000-0000-000000000114', 'leila.cruz@colm.edu.ph')
)
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change,
   is_sso_user)
select
  '00000000-0000-0000-0000-000000000000',
  e.id,
  'authenticated',
  'authenticated',
  e.email,
  crypt('Demo1234!', gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '', '', '', '',
  false
from demo_emails e;

-- ------------------------------------------------------------
-- 3. USERS (app role rows, trusted by requireCounselorAuth etc.)
-- ------------------------------------------------------------

insert into public.users (user_id, role)
values
  ('00000000-0000-0000-0000-000000000001', 'counselor'),
  ('00000000-0000-0000-0000-000000000002', 'counselor'),
  ('00000000-0000-0000-0000-000000000003', 'counselor'),
  ('00000000-0000-0000-0000-000000000101', 'student'),
  ('00000000-0000-0000-0000-000000000102', 'student'),
  ('00000000-0000-0000-0000-000000000103', 'student'),
  ('00000000-0000-0000-0000-000000000104', 'student'),
  ('00000000-0000-0000-0000-000000000105', 'student'),
  ('00000000-0000-0000-0000-000000000106', 'student'),
  ('00000000-0000-0000-0000-000000000107', 'student'),
  ('00000000-0000-0000-0000-000000000108', 'student'),
  ('00000000-0000-0000-0000-000000000109', 'student'),
  ('00000000-0000-0000-0000-000000000110', 'student'),
  ('00000000-0000-0000-0000-000000000111', 'student'),
  ('00000000-0000-0000-0000-000000000112', 'student'),
  ('00000000-0000-0000-0000-000000000113', 'student'),
  ('00000000-0000-0000-0000-000000000114', 'student');

-- ------------------------------------------------------------
-- 4. COUNSELORS
-- (triggers autofill username + auth_email when omitted and audit-log
--  a "created" row per account automatically)
-- ------------------------------------------------------------

insert into public.counselors
  (user_id, first_name, middle_name, last_name, username, auth_email,
   work_days, availability_status, is_active)
values
  ('00000000-0000-0000-0000-000000000001', 'Ana', 'R.', 'Reyes',
   'anna.reyes', 'anna.reyes@colm.edu.ph', 'Mon, Tue, Wed, Thu', 'available', true),
  ('00000000-0000-0000-0000-000000000002', 'Mark', 'D.', 'Villanueva',
   'mark.villanueva', 'mark.villanueva@colm.edu.ph', 'Mon, Tue, Fri', 'available', true);

-- Liza was created by Ana, then deactivated by Ana 10 days ago —
-- the Account Activity feed shows both "created" and "deactivated".
insert into public.counselors
  (user_id, first_name, middle_name, last_name, username, auth_email,
   work_days, availability_status, is_active, created_by, deactivated_at, deactivated_by)
select
  '00000000-0000-0000-0000-000000000003', 'Liza', 'B.', 'Santos',
  'liza.santos', 'liza.santos@colm.edu.ph', 'Mon, Wed', 'unavailable', false,
  (select counselor_id from public.counselors where username = 'anna.reyes'),
  now() - interval '10 days',
  (select counselor_id from public.counselors where username = 'anna.reyes');

-- Manual audit entry for the deactivation (the "created" entries were
-- written by the trigger on insert).
insert into public.counselor_audit_log (counselor_id, actor_id, action)
select l.counselor_id, a.counselor_id, 'deactivated'
from public.counselors l
join public.counselors a on a.username = 'anna.reyes'
where l.username = 'liza.santos';

-- ------------------------------------------------------------
-- 5. STUDENTS (14 across JHS / SHS / College)
-- ------------------------------------------------------------

insert into public.students
  (user_id, student_number, username, first_name, middle_name, last_name,
   year_level, education_level, section, contact_number, parent_guardian,
   student_email, auth_email, email_verified)
values
  ('00000000-0000-0000-0000-000000000101', '2025-0001', 'juan.delacruz', 'Juan', 'P.', 'Dela Cruz',
   'Grade 10', 'junior_high', 'Section A', '0917 302 1121', 'Rosario Dela Cruz',
   null, 'juan.delacruz@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000102', '2025-0002', 'maria.santos', 'Maria', 'L.', 'Santos',
   'Grade 9', 'junior_high', 'Section B', '0918 445 9087', 'Eduardo Santos',
   null, 'maria.santos@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000103', '2025-0003', 'paolo.mendoza', 'Paolo', 'V.', 'Mendoza',
   'Grade 12', 'senior_high', 'STEM-1', '0917 555 2210', 'Lourdes Mendoza',
   null, 'paolo.mendoza@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000104', '2025-0004', 'ana.bautista', 'Ana', 'C.', 'Bautista',
   '2nd Year', 'college', 'BSIT-B', '0928 766 3344', 'Ramon Bautista',
   null, 'ana.bautista@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000105', '2025-0005', 'carlo.reyes', 'Carlo', 'S.', 'Reyes',
   'Grade 11', 'senior_high', 'ABM-1', '0917 812 0099', 'Mila Reyes',
   null, 'carlo.reyes@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000106', '2025-0006', 'sophia.tan', 'Sophia', 'K.', 'Tan',
   'Grade 10', 'junior_high', 'Section A', '0915 990 1123', 'Henry Tan',
   null, 'sophia.tan@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000107', '2025-0007', 'miguel.aquino', 'Miguel', 'T.', 'Aquino',
   'Grade 8', 'junior_high', 'Section B', '0919 204 5566', 'Norma Aquino',
   null, 'miguel.aquino@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000108', '2025-0008', 'bea.navarro', 'Bea', 'M.', 'Navarro',
   'Grade 7', 'junior_high', 'Section A', '0935 814 2201', 'Jose Navarro',
   null, 'bea.navarro@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000109', '2025-0009', 'lance.dizon', 'Lance', 'A.', 'Dizon',
   '3rd Year', 'college', 'BSED-A', '0917 603 8890', 'Cecilia Dizon',
   null, 'lance.dizon@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000110', '2025-0010', 'ela.ramos', 'Ela', 'J.', 'Ramos',
   'Grade 12', 'senior_high', 'HUMSS-2', '0916 771 5504', 'Benjamin Ramos',
   null, 'ela.ramos@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000111', '2025-0011', 'nico.paredes', 'Nico', 'R.', 'Paredes',
   'Grade 9', 'junior_high', 'Section B', '0920 314 7788', 'Divina Paredes',
   null, 'nico.paredes@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000112', '2025-0012', 'iris.lim', 'Iris', 'W.', 'Lim',
   '1st Year', 'college', 'BSBA-A', '0918 655 4433', 'Charles Lim',
   null, 'iris.lim@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000113', '2025-0013', 'gabriel.torres', 'Gabriel', 'N.', 'Torres',
   'Grade 11', 'senior_high', 'STEM-2', '0917 480 3321', 'Esther Torres',
   null, 'gabriel.torres@colm.edu.ph', true),
  ('00000000-0000-0000-0000-000000000114', '2025-0014', 'leila.cruz', 'Leila', 'O.', 'Cruz',
   'Grade 10', 'junior_high', 'Section B', '0915 224 9081', 'Fernando Cruz',
   null, 'leila.cruz@colm.edu.ph', true);

-- ------------------------------------------------------------
-- 6. ANNOUNCEMENTS
-- ------------------------------------------------------------

insert into public.announcements (title, announcement_content, announcement_date, category, counselor_id)
select v.title, v.content, v.adate, v.category, c.counselor_id
from (values
  ('Guidance Office Operating Hours',
   'The Guidance Office (Room 203) is open Monday to Thursday, 8:00 AM to 5:00 PM. Walk-ins are welcome for urgent concerns.',
   '2026-09-14', 'announcement', 'anna.reyes'),
  ('Anti-Bullying Awareness Month',
   'September is Anti-Bullying Awareness Month. The guidance team will be holding classroom talks on respect and safe reporting. You may message us anonymously through the office.',
   '2026-09-18', 'announcement', 'anna.reyes'),
  ('Midterm Stress Management Workshop',
   'A hands-on workshop on managing midterm stress: breathing exercises, study planning, and one-on-one peer support. Registration closes September 20.',
   '2026-09-22', 'event', 'mark.villanueva'),
  ('SY 2026-2027 Career Fair',
   'Save the date! The Career Fair brings in alumni and local industry partners for talk sessions and booth consultations on college and career pathways.',
   '2026-10-05', 'event', 'anna.reyes'),
  ('Guidance Talks Schedule for October',
   'October guidance talks: Bullying Prevention (Grades 7-8), Career Pathing (Grades 11-12), and Personal Finance for College students.',
   '2026-09-25', 'announcement', 'mark.villanueva')
) v(title, content, adate, category, username)
join public.counselors c on c.username = v.username;

-- ------------------------------------------------------------
-- 7. APPOINTMENTS
-- (distinct counselor + student slots so the no-double-booking unique
--  indexes hold; declined rows are exempt by the partial index)
-- ------------------------------------------------------------

insert into public.appointments
  (student_id, counselor_id, appointment_date, appointment_time, concern,
   concern_category, school_year, status, was_rescheduled)
select s.student_id, c.counselor_id, v.appointment_date, v.appointment_time,
       v.concern, v.category, '2026-2027', v.status, v.was_rescheduled
from (values
  ('juan.delacruz',  'anna.reyes',       '2026-09-21', '09:00',
   'I have been struggling with my deadlines and I want help planning my study schedule.', 'Academic', 'pending', false),
  ('maria.santos',   'anna.reyes',       '2026-09-22', '14:00',
   'A few classmates have been teasing me and it is getting harder to focus in class.', 'Bullying & Peer Relations', 'pending', false),
  ('paolo.mendoza',  'mark.villanueva',  '2026-09-23', '10:00',
   'I need help deciding between two college courses and picking a final strand.', 'Career Guidance', 'approved', false),
  ('sophia.tan',     'anna.reyes',       '2026-09-24', '11:00',
   'I have been feeling anxious about tests and I wanted to talk to someone about it.', 'Emotional & Mental Health', 'approved', true),
  ('carlo.reyes',    'mark.villanueva',  '2026-09-24', '09:00',
   'My grades dropped this quarter and I want to know how to manage my time better.', 'Academic', 'approved', false),
  ('juan.delacruz',  'anna.reyes',       '2026-09-08', '13:00',
   'I was involved in a classroom incident and my adviser asked me to see the guidance office.', 'Academic', 'conducted', false),
  ('maria.santos',   'anna.reyes',       '2026-09-09', '10:00',
   'Follow-up session about the teasing incident reported to my class adviser.', 'Bullying & Peer Relations', 'conducted', false),
  ('paolo.mendoza',  'mark.villanueva',  '2026-09-10', '15:00',
   'First counseling session for career planning and course selection.', 'Career Guidance', 'conducted', false),
  ('ela.ramos',      'mark.villanueva',  '2026-09-15', '08:00',
   'I argued with a classmate during group work and I want to handle it maturely.', 'Bullying & Peer Relations', 'declined', false),
  ('ana.bautista',   'anna.reyes',       '2026-09-28', '16:00',
   'I would like to talk about my career direction before enrolment next semester.', 'Career Guidance', 'pending', false)
) v(student_username, counselor_username, appointment_date, appointment_time,
     concern, category, status, was_rescheduled)
join public.students s on s.username = v.student_username
join public.counselors c on c.username = v.counselor_username;

-- ------------------------------------------------------------
-- 8. CASES  (file_number auto-generated by trigger; school_year set)
-- ------------------------------------------------------------

insert into public.cases (student_id, counselor_id, nature_of_incident, status, school_year, updated_by)
select s.student_id, c.counselor_id, v.nature, v.status, '2026-2027', c.counselor_id
from (values
  ('juan.delacruz',  'anna.reyes',       'Physical altercation with a classmate during lunch break', 'open'),
  ('maria.santos',   'anna.reyes',       'Reported bullying from classmates during assembly', 'open'),
  ('paolo.mendoza',  'mark.villanueva',  'Career and college-course decision counseling', 'resolved'),
  ('ana.bautista',   'anna.reyes',       'Family conflict affecting class participation', 'open'),
  ('sophia.tan',     'anna.reyes',       'Academic underperformance related to anxiety', 'monitoring'),
  ('miguel.aquino',  'mark.villanueva',  'Recurring classroom disruptions', 'monitoring'),
  ('nico.paredes',   'anna.reyes',       'Test anxiety and stress management', 'resolved'),
  ('ela.ramos',      'mark.villanueva',  'Peer conflict with a sectionmate', 'open')
) v(student_username, counselor_username, nature, status)
join public.students s on s.username = v.student_username
join public.counselors c on c.username = v.counselor_username;

-- ------------------------------------------------------------
-- 9. CASE SESSIONS
-- (conducted appointments link to the first session of the same
--  student on the same date; action_taken / recommendation are
--  newline-joined numbered entries, matching the new entry-table UI)
-- ------------------------------------------------------------

insert into public.case_sessions
  (case_id, appointment_id, session_date, details, action_taken, session_note, recommendation, updated_by)
select cs.case_id, a.appointment_id, v.session_date, v.details, v.action_taken,
       v.session_note, v.recommendation, u.counselor_id
from (values
  ('juan.delacruz', '2026-09-08',
   'Initial intake after a classroom altercation. Referred by the class adviser; student was cooperative and remorseful.',
   '1) Established rapport and let the student narrate the incident' || chr(10) ||
   '2) Contacted both sets of parents by phone',
   'Student admitted losing his temper but showed willingness to change. Parents agreed to support a behavior contract.',
   '1) Issue a written behavior contract' || chr(10) ||
   '2) Schedule weekly check-ins for four weeks', 'anna.reyes'),

  ('juan.delacruz', '2026-09-15',
   'First weekly follow-up. Behavior contract reviewed with the student.',
   '1) Reviewed the behavior contract together' || chr(10) ||
   '2) Practiced simple anger-management and breathing exercises',
   'No new incidents reported. Student reported difficulty when provoked by the same classmate.',
   '1) Continue weekly check-ins' || chr(10) ||
   '2) Set up peer mediation with the other student', 'anna.reyes'),

  ('juan.delacruz', '2026-09-22',
   'Second follow-up. Class adviser confirmed visible improvement in classroom behavior.',
   '1) Recognized positive progress in class' || chr(10) ||
   '2) Coordinated with class adviser about seat arrangement',
   'Student now avoids the provoking situation and uses the office as a neutral space.',
   '1) Monitor for two more weeks' || chr(10) ||
   '2) Explore downgrading the case to monitoring status', 'anna.reyes'),

  ('maria.santos', '2026-09-09',
   'First interview after repeated teasing incidents reported by the class adviser.',
   '1) Gathered the student''s account of the incidents' || chr(10) ||
   '2) Interviewed witnesses together with the class adviser',
   'The teasing happens mostly during assembly and group activities.',
   '1) Recommend a class talk on respect' || chr(10) ||
   '2) Individual follow-up next week', 'anna.reyes'),

  ('maria.santos', '2026-09-16',
   'Follow-up after the class talk. Shared a classmate support plan.',
   '1) Met with the students involved separately' || chr(10) ||
   '2) Drafted a classmate support plan with the adviser',
   'Peers acknowledged their behavior. Maria feels safer reporting now.',
   '1) Continue weekly observations' || chr(10) ||
   '2) Reassess status at the end of the month', 'anna.reyes'),

  ('paolo.mendoza', '2026-09-10',
   'First career counseling session. Administered the Career Interest Survey.',
   '1) Administered the career interest survey' || chr(10) ||
   '2) Discussed strand vs. college pathway trade-offs',
   'Student is torn between ABM and a technical-vocational route.',
   '1) Attend the Career Fair on October 5' || chr(10) ||
   '2) Draft a course shortlist with parents', 'mark.villanueva'),

  ('paolo.mendoza', '2026-09-17',
   'Follow-up after reviewing survey results with parents.',
   '1) Reviewed survey results with both parents' || chr(10) ||
   '2) Finalized the course shortlist',
   'Family aligned on an ABM-track college program.',
   '1) Continue with academic advising' || chr(10) ||
   '2) Close the case', 'mark.villanueva'),

  ('ana.bautista', '2026-09-11',
   'Initial session. Student shared recent family conflict affecting her schoolwork.',
   '1) Provided a safe space to talk through the family situation' || chr(10) ||
   '2) Agreed on a study support routine with the professor',
   'Student missed two quizzes. Emotional toll is visible but she wants to stay in class.',
   '1) Weekly sessions while the situation settles' || chr(10) ||
   '2) Coordinate with the registrar on grace-period options', 'anna.reyes'),

  ('ana.bautista', '2026-09-18',
   'Check-in. Household situation has stabilized somewhat.',
   '1) Reinforced coping and study routine' || chr(10) ||
   '2) Monitored quiz recovery progress',
   'Student has caught up on missed quizzes and is participating again.',
   '1) Continue monitoring through the midterms', 'anna.reyes'),

  ('sophia.tan', '2026-09-12',
   'Referral from the math teacher about declining performance and anxious behavior.',
   '1) Administered a brief anxiety self-check' || chr(10) ||
   '2) Taught a simple grounding technique',
   'Anxiety spikes are test-related. Performance in other subjects is fine.',
   '1) Direct to the Stress Management Workshop' || chr(10) ||
   '2) Revisit grades at quarter end', 'anna.reyes'),

  ('sophia.tan', '2026-09-19',
   'Follow-up. Student reports using the grounding exercise during a quiz.',
   '1) Reviewed the grounding technique practice' || chr(10) ||
   '2) Encouraged sleep routine adjustments',
   'One quiz improved noticeably. Student asked if the office can notify teachers.',
   '1) Consider adjusted test invitations' || chr(10) ||
   '2) Weekly check-ins until quarter end', 'anna.reyes'),

  ('miguel.aquino', '2026-09-14',
   'Behavioral referral after repeated classroom disruptions.',
   '1) Identified triggers with the student' || chr(10) ||
   '2) Agreed on a signal system with the teacher',
   'Disruptions peak during long seatwork. Student wants to improve grades.',
   '1) Try the signal system for three weeks' || chr(10) ||
   '2) Involve the student''s mother in a progress call', 'mark.villanueva'),

  ('nico.paredes', '2026-09-09',
   'Self-referral for exam anxiety and difficulty sleeping before tests.',
   '1) Taught breathing and progressive muscle relaxation' || chr(10) ||
   '2) Built a light pre-exam routine',
   'Student felt relieved after the first session and asked for a checklist.',
   '1) Follow-up after the quarterly exam' || chr(10) ||
   '2) Close the case once exam week passes', 'anna.reyes'),

  ('ela.ramos', '2026-09-16',
   'Peer conflict during group work escalated to a public argument.',
   '1) Interviewed both students separately' || chr(10) ||
   '2) Set communication guidelines for the group',
   'Misunderstanding over task division. Both expressed willingness to move on.',
   '1) Arrange one joint resolution session' || chr(10) ||
   '2) Monitor group dynamics through the adviser', 'mark.villanueva')
) v(student_username, session_date, details, action_taken, session_note, recommendation, updater_username)
join public.cases cs
  on cs.student_id = (select student_id from public.students where username = v.student_username)
left join public.appointments a
  on a.student_id = (select student_id from public.students where username = v.student_username)
 and a.appointment_date = v.session_date
 and a.status = 'conducted'
join public.counselors u on u.username = v.updater_username;

-- ------------------------------------------------------------
-- 10. FORMS LIBRARY + SECTIONS + QUESTIONS
-- ------------------------------------------------------------

insert into public.forms (form_name, description, counselor_id)
select v.form_name, v.description, c.counselor_id
from (values
  ('Student Intake Assessment',
   'Multi-section intake used for new counseling cases and referrals.', 'anna.reyes'),
  ('Career Interest Survey',
   'Guidance survey for career direction and course decision-making.', 'mark.villanueva'),
  ('Mental Health Self-Check',
   'Short self-report check on stress, sleep, and overall well-being.', 'mark.villanueva')
) v(form_name, description, username)
join public.counselors c on c.username = v.username;

insert into public.form_sections (form_id, section_title, section_description, order_no)
select f.form_id, v.section_title, v.section_description, v.order_no
from (values
  ('Student Intake Assessment', 'Personal Background', 'Basic information about how you came to the guidance office.', 1),
  ('Student Intake Assessment', 'Academic and Social Adjustment', 'Your current concern in your own words.', 2),
  ('Career Interest Survey', 'Career Interests', 'How you see your future after graduation.', 1),
  ('Career Interest Survey', 'Skills and Preferences', 'What you are good at and what you enjoy.', 2),
  ('Mental Health Self-Check', 'Well-Being Check', 'A quick private check on how you are feeling.', 1)
) v(form_name, section_title, section_description, order_no)
join public.forms f on f.form_name = v.form_name;

insert into public.form_questions
  (form_id, section_id, question_text, question_type, options, is_required, order_no)
select f.form_id, sec.section_id, q.question_text, q.question_type, q.options, q.is_required, q.order_no
from (values
  -- Student Intake Assessment -> Personal Background
  ('Student Intake Assessment', 'Personal Background', 1,
   'How did you learn about our office?', 'select',
   'Class adviser,Posters,Friends,School website', false),
  ('Student Intake Assessment', 'Personal Background', 2,
   'Are you a transferee this school year?', 'radio', 'Yes,No', true),
  ('Student Intake Assessment', 'Personal Background', 3,
   'Which parent or guardian should we contact first?', 'text', null, false),
  -- Student Intake Assessment -> Academic and Social Adjustment
  ('Student Intake Assessment', 'Academic and Social Adjustment', 1,
   'In your own words, describe your concern.', 'textarea', null, true),
  ('Student Intake Assessment', 'Academic and Social Adjustment', 2,
   'How comfortable are you seeking support?', 'radio',
   'Very comfortable,Somewhat comfortable,Not comfortable', false),
  ('Student Intake Assessment', 'Academic and Social Adjustment', 3,
   'Which areas would you like guidance on?', 'checkbox',
   'Academics,Career,Family,Peer relationships,Emotional well-being', false),
  -- Career Interest Survey -> Career Interests
  ('Career Interest Survey', 'Career Interests', 1,
   'Which academic track interests you most?', 'radio', 'STEM,ABM,HUMSS,GAS', true),
  ('Career Interest Survey', 'Career Interests', 2,
   'Preferred career field', 'select',
   'Engineering,Business,Education,Health,Arts and Design,Information Technology', false),
  ('Career Interest Survey', 'Career Interests', 3,
   'How confident are you in your career direction?', 'radio',
   'Confident,Somewhat confident,Unsure', true),
  -- Career Interest Survey -> Skills and Preferences
  ('Career Interest Survey', 'Skills and Preferences', 1,
   'Which skills best describe you?', 'checkbox',
   'Leadership,Writing,Mathematics,Public speaking,Organizing', false),
  ('Career Interest Survey', 'Skills and Preferences', 2,
   'Describe your dream profession.', 'text', null, false),
  -- Mental Health Self-Check -> Well-Being Check
  ('Mental Health Self-Check', 'Well-Being Check', 1,
   'How has your stress level been this term?', 'radio', 'Low,Mild,Moderate,High', true),
  ('Mental Health Self-Check', 'Well-Being Check', 2,
   'Have you had trouble sleeping recently?', 'radio',
   'Never,Seldom,Often,Nearly every night', true),
  ('Mental Health Self-Check', 'Well-Being Check', 3,
   'Is there anything you would like to share privately?', 'textarea', null, false),
  ('Mental Health Self-Check', 'Well-Being Check', 4,
   'Preferred follow-up', 'select', 'In-person meeting,Email,No follow-up needed', false)
) q(form_name, section_title, order_no, question_text, question_type, options, is_required)
join public.forms f on f.form_name = q.form_name
join public.form_sections sec
  on sec.form_id = f.form_id and sec.section_title = q.section_title;

-- ------------------------------------------------------------
-- 11. FORM ASSIGNMENTS + SUBMISSIONS + ANSWERS
-- ------------------------------------------------------------

insert into public.form_assignments (form_id, student_id, counselor_id, school_year, status, submitted_at)
select f.form_id, s.student_id, c.counselor_id, '2026-2027', v.status, v.submitted_at
from (values
  ('Student Intake Assessment', 'juan.delacruz', 'anna.reyes', 'submitted', '2026-09-05 14:00:00+08'),
  ('Mental Health Self-Check', 'juan.delacruz', 'anna.reyes', 'assigned', null),
  ('Career Interest Survey', 'paolo.mendoza', 'mark.villanueva', 'submitted', '2026-09-02 10:30:00+08'),
  ('Career Interest Survey', 'maria.santos', 'mark.villanueva', 'assigned', null),
  ('Student Intake Assessment', 'ana.bautista', 'anna.reyes', 'assigned', null),
  ('Mental Health Self-Check', 'sophia.tan', 'mark.villanueva', 'submitted', '2026-09-06 09:15:00+08')
) v(form_name, student_username, counselor_username, status, submitted_at)
join public.forms f on f.form_name = v.form_name
join public.students s on s.username = v.student_username
join public.counselors c on c.username = v.counselor_username;

insert into public.form_submissions (assignment_id)
select a.assignment_id
from public.form_assignments a
join public.forms f on f.form_id = a.form_id
join public.students s on s.student_id = a.student_id
where a.status = 'submitted';

insert into public.form_answers (submission_id, question_id, answer_value)
select sub.submission_id, q.question_id, v.answer_value
from (values
  ('Student Intake Assessment', 'juan.delacruz', 'How did you learn about our office?', 'Class adviser'),
  ('Student Intake Assessment', 'juan.delacruz', 'Are you a transferee this school year?', 'No'),
  ('Student Intake Assessment', 'juan.delacruz', 'Which parent or guardian should we contact first?', 'My mother'),
  ('Student Intake Assessment', 'juan.delacruz', 'In your own words, describe your concern.', 'I get overwhelmed with deadlines and a few classmates tease me.'),
  ('Student Intake Assessment', 'juan.delacruz', 'How comfortable are you seeking support?', 'Somewhat comfortable'),
  ('Student Intake Assessment', 'juan.delacruz', 'Which areas would you like guidance on?', 'Academics,Peer relationships'),
  ('Career Interest Survey', 'paolo.mendoza', 'Which academic track interests you most?', 'ABM'),
  ('Career Interest Survey', 'paolo.mendoza', 'Preferred career field', 'Business'),
  ('Career Interest Survey', 'paolo.mendoza', 'How confident are you in your career direction?', 'Somewhat confident'),
  ('Career Interest Survey', 'paolo.mendoza', 'Which skills best describe you?', 'Leadership,Writing,Organizing'),
  ('Career Interest Survey', 'paolo.mendoza', 'Describe your dream profession.', 'I want to run a small business someday.'),
  ('Mental Health Self-Check', 'sophia.tan', 'How has your stress level been this term?', 'Moderate'),
  ('Mental Health Self-Check', 'sophia.tan', 'Have you had trouble sleeping recently?', 'Often'),
  ('Mental Health Self-Check', 'sophia.tan', 'Is there anything you would like to share privately?', 'I have a hard time focusing during exams.'),
  ('Mental Health Self-Check', 'sophia.tan', 'Preferred follow-up', 'Email')
) v(form_name, student_username, question_text, answer_value)
join public.forms f on f.form_name = v.form_name
join public.students s on s.username = v.student_username
join public.form_assignments a
  on a.form_id = f.form_id and a.student_id = s.student_id and a.status = 'submitted'
join public.form_submissions sub on sub.assignment_id = a.assignment_id
join public.form_questions q on q.form_id = f.form_id and q.question_text = v.question_text;

-- ------------------------------------------------------------
-- 12. NOTIFICATIONS (bell icons)
-- ------------------------------------------------------------

insert into public.notifications (recipient_user_id, type, title, message, link, is_read)
values
  ('00000000-0000-0000-0000-000000000101', 'appointment', 'Appointment request received',
   'Your appointment request for September 21 is now pending review.', 'student-appointments.html', true),
  ('00000000-0000-0000-0000-000000000101', 'appointment', 'Appointment approved',
   'Good news - your session with Ms. Ana Reyes was approved.', 'student-appointments.html', false),
  ('00000000-0000-0000-0000-000000000101', 'form', 'New form assigned',
   'Ms. Ana Reyes assigned you the Mental Health Self-Check form.', 'student-forms.html', false),
  ('00000000-0000-0000-0000-000000000001', 'appointment', 'New appointment request',
   'Juan Dela Cruz booked a session for September 21.', 'counselor-appointments.html', true),
  ('00000000-0000-0000-0000-000000000001', 'form', 'Form submitted',
   'Juan Dela Cruz submitted the Student Intake Assessment.', 'counselor-forms.html', false),
  ('00000000-0000-0000-0000-000000000102', 'announcement', 'Anti-Bullying Awareness Month',
   'Read the latest announcement from the Guidance Office.', 'student-announcements.html', false);

-- ------------------------------------------------------------
-- 13. STUDENT INFO SHEETS (submitted; no signature image)
-- ------------------------------------------------------------
-- answers is keyed by section id from js/student-info-schema.js.
-- Only verified keys are used; signature is left NULL (no image).

insert into public.student_info_sheets (student_id, school_year, answers, status, submitted_at)
select s.student_id, '2026-2027', v.answers::jsonb, 'submitted', v.submitted_at
from (values
  ('juan.delacruz',
   '{"personal":{"civil_status":"Single"},"education":{"schooling_nature":"Continuous"},"family":{"father_living":"Living","mother_living":"Living","marital_status":"Married","sibling_support":["Your studies"],"financing":"Parents","income_bracket":"P20001 to P40000"},"health":{"psych_consultations":[]},"interests":{"organizations":[{"name":"Basketball Varsity","position":"Player"}]},"tests":{"test_results":[]}}',
   '2026-09-06 08:40:00+08'),
  ('maria.santos',
   '{"personal":{"civil_status":"Single"},"education":{"schooling_nature":"Continuous"},"family":{"father_living":"Deceased","mother_living":"Living","marital_status":"Widowed","sibling_support":["Family"],"financing":"Parents","income_bracket":"Below P10000"},"health":{"psych_consultations":[]},"interests":{"organizations":[]},"tests":{"test_results":[]}}',
   '2026-09-05 09:20:00+08')
) v(student_username, answers, submitted_at)
join public.students s on s.username = v.student_username;

commit;