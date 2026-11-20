-- Loads a broker is tracking, each with a private customer tracking link.
-- Paste this whole file into Supabase > SQL Editor and click Run.

create table public.loads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- What the broker types in
  load_number text not null check (char_length(load_number) between 1 and 40),
  trailer_number text check (char_length(trailer_number) <= 40),
  customer_name text check (char_length(customer_name) <= 80),
  pickup text check (char_length(pickup) <= 120),
  delivery text check (char_length(delivery) <= 120),
  samsara_url text not null check (
    samsara_url ~ '^https://cloud(\.[a-z0-9-]+)?\.samsara\.com/o/[0-9]+/fleet/viewer/[A-Za-z0-9_-]+$'
  ),

  -- The customer's link: /t/<share_code>. Random, so nobody can guess another load's link.
  share_code text not null unique default translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'),
  status text not null default 'active' check (status in ('active', 'delivered')),
  expires_at timestamptz not null default now() + interval '14 days',

  -- Last position read from Samsara. Carrier and driver names are never stored.
  last_lat double precision,
  last_lng double precision,
  last_heading integer,
  last_speed_mph real,
  last_address text,
  last_position_at timestamptz,
  dest_name text,
  dest_address text,
  dest_lat double precision,
  dest_lng double precision,
  last_checked_at timestamptz,
  last_error text,

  created_at timestamptz not null default now()
);

create index loads_owner_idx on public.loads (owner_id, created_at desc);

alter table public.loads enable row level security;

-- Brokers see and change only their own loads. Customers never read this table directly:
-- the tracking page goes through the server, which returns only safe fields.
create policy "Owners read their loads" on public.loads
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners add loads" on public.loads
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update their loads" on public.loads
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their loads" on public.loads
  for delete to authenticated using (owner_id = (select auth.uid()));
