-- ============================================================
-- Intervention Library — a reusable catalog of intervention
-- documents (e.g. "Anger Management Worksheet") a counselor uploads
-- once and assigns to many cases afterward, the same way the Form
-- Library works for guidance forms. Assigning a template to a case
-- copies its file_path/file_name into a new public.interventions row
-- (see interventions.sql) rather than referencing the template
-- directly — so deleting a template from the library later never
-- affects an intervention already assigned to a student. Reuses the
-- existing private "case-attachments" storage bucket and its
-- bucket-wide counselor policies (see case_attachments.sql). Safe to
-- re-run.
-- ============================================================

create table if not exists public.intervention_templates (
  intervention_template_id bigint generated always as identity primary key,
  counselor_id bigint not null references public.counselors(counselor_id) on delete cascade,
  title text not null,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists intervention_templates_counselor_idx on public.intervention_templates (counselor_id);

alter table public.intervention_templates enable row level security;

drop policy if exists "counselor can view own intervention templates" on public.intervention_templates;
create policy "counselor can view own intervention templates"
  on public.intervention_templates for select
  using (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can create intervention templates" on public.intervention_templates;
create policy "counselor can create intervention templates"
  on public.intervention_templates for insert
  with check (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can delete own intervention templates" on public.intervention_templates;
create policy "counselor can delete own intervention templates"
  on public.intervention_templates for delete
  using (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));
