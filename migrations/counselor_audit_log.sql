-- ============================================================
-- Personnel account audit log (append-only).
--
-- The counselors row tracks only the CURRENT lifecycle state:
--   created_by / created_at, and deactivated_by / deactivated_at
-- (which are CLEARED on reactivation). Anything historical —
-- repeated toggles, who reactivated, when — is lost.
--
-- This table records the full lifecycle forever:
--   * created      the account was created
--   * activated    the account was reactivated
--   * deactivated  the account was taken offline
--
-- Rerun-safe: guarded with IF NOT EXISTS.
-- ============================================================

create table if not exists public.counselor_audit_log (
  id bigint generated always as identity primary key,
  counselor_id bigint references public.counselors (counselor_id) on delete set null,
  actor_id     bigint references public.counselors (counselor_id) on delete set null,
  action       text not null check (action in ('created', 'activated', 'deactivated')),
  created_at   timestamptz not null default now()
);

create index if not exists counselor_audit_log_counselor_created_idx
  on public.counselor_audit_log (counselor_id, created_at desc);

-- Counselors (and only counselors) can read the log; writes happen
-- through the edge functions with the service-role key, which
-- bypasses RLS.
alter table public.counselor_audit_log enable row level security;

create policy "counselors can view audit log"
  on public.counselor_audit_log
  for select
  using (exists (
    select 1 from public.counselors where user_id = auth.uid()
  ));

-- Safety net: any INSERT into counselors is logged as "created",
-- regardless of write path (edge function, Studio, seeds). The
-- actor is the creator's counselor_id (NULL = system).
create or replace function public.log_counselor_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.counselor_audit_log (counselor_id, actor_id, action)
  values (new.counselor_id, new.created_by, 'created');
  return new;
end;
$$;

drop trigger if exists trg_counselors_audit_created on public.counselors;
create trigger trg_counselors_audit_created
  after insert on public.counselors
  for each row execute function public.log_counselor_created();