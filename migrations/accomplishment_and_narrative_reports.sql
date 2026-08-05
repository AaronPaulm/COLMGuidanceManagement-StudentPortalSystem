-- ============================================================
-- The two report types E3 was still missing: Accomplishment Reports
-- (internal-use activity log, photos optional — see B2) and Narrative
-- Reports (free-form per-student write-up). Counselor-only, same
-- access pattern as cases. Accomplishment photos reuse the existing
-- private "case-attachments" storage bucket and its bucket-wide
-- counselor policies (see case_attachments.sql) — only new metadata
-- tables are needed. Safe to re-run.
-- ============================================================

create table if not exists public.accomplishment_reports (
  report_id bigint generated always as identity primary key,
  counselor_id bigint not null references public.counselors(counselor_id) on delete cascade,
  activity_title text not null,
  activity_date date not null default current_date,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists accomplishment_reports_counselor_idx on public.accomplishment_reports (counselor_id);

create table if not exists public.accomplishment_report_attachments (
  attachment_id bigint generated always as identity primary key,
  report_id bigint not null references public.accomplishment_reports(report_id) on delete cascade,
  file_path text not null,
  file_name text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists accomplishment_report_attachments_report_idx on public.accomplishment_report_attachments (report_id);

create table if not exists public.narrative_reports (
  report_id bigint generated always as identity primary key,
  counselor_id bigint not null references public.counselors(counselor_id) on delete cascade,
  student_id bigint not null references public.students(student_id) on delete cascade,
  narrative_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists narrative_reports_counselor_idx on public.narrative_reports (counselor_id);
create index if not exists narrative_reports_student_idx on public.narrative_reports (student_id);

alter table public.accomplishment_reports enable row level security;

drop policy if exists "counselor can view own accomplishment reports" on public.accomplishment_reports;
create policy "counselor can view own accomplishment reports"
  on public.accomplishment_reports for select
  using (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can create accomplishment reports" on public.accomplishment_reports;
create policy "counselor can create accomplishment reports"
  on public.accomplishment_reports for insert
  with check (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can update own accomplishment reports" on public.accomplishment_reports;
create policy "counselor can update own accomplishment reports"
  on public.accomplishment_reports for update
  using (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));

alter table public.accomplishment_report_attachments enable row level security;

drop policy if exists "counselor can view attachments of own accomplishment reports" on public.accomplishment_report_attachments;
create policy "counselor can view attachments of own accomplishment reports"
  on public.accomplishment_report_attachments for select
  using (
    report_id in (
      select r.report_id from public.accomplishment_reports r
      where r.counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
    )
  );

drop policy if exists "counselor can add attachments to own accomplishment reports" on public.accomplishment_report_attachments;
create policy "counselor can add attachments to own accomplishment reports"
  on public.accomplishment_report_attachments for insert
  with check (
    report_id in (
      select r.report_id from public.accomplishment_reports r
      where r.counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
    )
  );

alter table public.narrative_reports enable row level security;

drop policy if exists "counselor can view own narrative reports" on public.narrative_reports;
create policy "counselor can view own narrative reports"
  on public.narrative_reports for select
  using (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can create narrative reports" on public.narrative_reports;
create policy "counselor can create narrative reports"
  on public.narrative_reports for insert
  with check (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can update own narrative reports" on public.narrative_reports;
create policy "counselor can update own narrative reports"
  on public.narrative_reports for update
  using (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));
