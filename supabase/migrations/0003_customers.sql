-- Customers: one permanent tracking page per customer that lists all their loads.
-- Paste this whole file into Supabase > SQL Editor and click Run.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- The customer's page: /c/<share_code>. Random, so nobody can guess another customer's page.
  share_code text not null unique default translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'),
  created_at timestamptz not null default now()
);

-- One customer per name per broker ("XYZ" and "xyz" are the same customer).
create unique index customers_owner_name_idx on public.customers (owner_id, lower(name));

alter table public.customers enable row level security;

create policy "Owners read their customers" on public.customers
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners add customers" on public.customers
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update their customers" on public.customers
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their customers" on public.customers
  for delete to authenticated using (owner_id = (select auth.uid()));

alter table public.loads
  add column customer_id uuid references public.customers (id) on delete set null,
  -- When the load was marked delivered: customer pages keep showing it for 24 hours.
  add column delivered_at timestamptz;

create index loads_customer_idx on public.loads (customer_id);

-- A load can only be filed under one of the broker's own customers.
drop policy "Owners add loads" on public.loads;
drop policy "Owners update their loads" on public.loads;
create policy "Owners add loads" on public.loads
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (customer_id is null or exists (select 1 from public.customers c where c.id = customer_id and c.owner_id = (select auth.uid())))
  );
create policy "Owners update their loads" on public.loads
  for update to authenticated using (owner_id = (select auth.uid())) with check (
    owner_id = (select auth.uid())
    and (customer_id is null or exists (select 1 from public.customers c where c.id = customer_id and c.owner_id = (select auth.uid())))
  );

-- Turn the customer names already typed on loads into customers, and link those loads.
insert into public.customers (owner_id, name)
select distinct on (owner_id, lower(trim(customer_name))) owner_id, trim(customer_name)
from public.loads
where customer_name is not null and trim(customer_name) <> ''
order by owner_id, lower(trim(customer_name)), created_at;

update public.loads l
set customer_id = c.id
from public.customers c
where c.owner_id = l.owner_id and lower(c.name) = lower(trim(l.customer_name));

-- Loads delivered before today don't suddenly reappear on customer pages.
update public.loads set delivered_at = now() - interval '1 day' where status = 'delivered' and delivered_at is null;
