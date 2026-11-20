-- Each broker's settings. For now: the company name shown on their dashboard and customer pages.
-- Paste this into Supabase > SQL Editor and click Run.

create table public.broker_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  company_name text not null check (char_length(company_name) between 1 and 80),
  updated_at timestamptz not null default now()
);

alter table public.broker_settings enable row level security;

-- Brokers read and change only their own settings. Customer pages read the name through the server.
create policy "Owners read their settings" on public.broker_settings
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners add their settings" on public.broker_settings
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update their settings" on public.broker_settings
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
