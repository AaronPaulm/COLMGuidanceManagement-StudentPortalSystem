-- ============================================================
-- Notifications table + Realtime for the bell icon in the
-- student/counselor sidebars. Run once in the Supabase SQL editor.
-- ============================================================

create table public.notifications (
  notification_id bigint generated always as identity primary key,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,               -- 'appointment' | 'announcement' | 'form'
  title text not null,
  message text,
  link text,                        -- relative page to open on click, e.g. 'student-appointments.html'
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy "users can view own notifications"
  on public.notifications for select
  using (recipient_user_id = auth.uid());

-- Any logged-in user can create a notification addressed to someone else
-- (a counselor notifying a student, or a student notifying a counselor) —
-- mirrors the trust level this app already has elsewhere (e.g. students
-- can freely insert into appointments).
create policy "authenticated users can create notifications"
  on public.notifications for insert
  with check (auth.uid() is not null);

create policy "users can update own notifications"
  on public.notifications for update
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

-- Required for Realtime to broadcast changes on this table
alter publication supabase_realtime add table public.notifications;
