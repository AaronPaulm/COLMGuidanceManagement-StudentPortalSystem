ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'announcement'
  CHECK (category IN ('announcement', 'event'));