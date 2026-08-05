-- ============================================================
-- Purpose-built signed-document attachment for appointments (B3) —
-- distinct from case_session_attachments' generic "Proof/Evidence"
-- upload, this is specifically for attaching the scanned, signed copy
-- of an invitation letter (see the openInvitationLetter() generator
-- in js/counselor-common.js) back onto the appointment it belongs to.
-- Reuses the existing private "case-attachments" storage bucket and
-- its bucket-wide counselor policies (see case_attachments.sql) —
-- only a new metadata table is needed, scoped by appointments.counselor_id
-- the same way case_session_attachments is scoped by cases.counselor_id.
-- Safe to re-run.
-- ============================================================

create table if not exists public.appointment_attachments (
  attachment_id bigint generated always as identity primary key,
  appointment_id bigint not null references public.appointments(appointment_id) on delete cascade,
  file_path text not null,
  file_name text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists appointment_attachments_appointment_idx on public.appointment_attachments (appointment_id);

alter table public.appointment_attachments enable row level security;

drop policy if exists "counselor can view attachments of own appointments" on public.appointment_attachments;
create policy "counselor can view attachments of own appointments"
  on public.appointment_attachments for select
  using (
    appointment_id in (
      select a.appointment_id from public.appointments a
      where a.counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
    )
  );

drop policy if exists "counselor can add attachments to own appointments" on public.appointment_attachments;
create policy "counselor can add attachments to own appointments"
  on public.appointment_attachments for insert
  with check (
    appointment_id in (
      select a.appointment_id from public.appointments a
      where a.counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
    )
  );

drop policy if exists "counselor can delete attachments of own appointments" on public.appointment_attachments;
create policy "counselor can delete attachments of own appointments"
  on public.appointment_attachments for delete
  using (
    appointment_id in (
      select a.appointment_id from public.appointments a
      where a.counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
    )
  );
