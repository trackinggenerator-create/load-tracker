-- The carrier covering the load. Only the broker sees this: the customer tracking page never reads it.
-- Paste this into Supabase > SQL Editor and click Run.

alter table public.loads
  add column carrier_name text check (char_length(carrier_name) <= 80);
