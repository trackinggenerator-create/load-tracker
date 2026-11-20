-- The day the load is due to deliver (optional). A calendar day, no time.
-- Paste this into Supabase > SQL Editor and click Run.

alter table public.loads
  add column delivery_date date;
