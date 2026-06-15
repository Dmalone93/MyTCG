-- =============================================================
-- TCG Collection Tracker — Initial Schema
-- Run this in Supabase SQL Editor or via supabase db push
-- =============================================================

-- ----- PROFILES -----
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----- COLLECTIONS -----
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table public.collections enable row level security;

create policy "Users can view own collections"
  on public.collections for select
  using (user_id = auth.uid());

create policy "Users can create own collections"
  on public.collections for insert
  with check (user_id = auth.uid());

create policy "Users can update own collections"
  on public.collections for update
  using (user_id = auth.uid());

create policy "Users can delete own collections"
  on public.collections for delete
  using (user_id = auth.uid());

-- ----- COLLECTION CARDS -----
create table public.collection_cards (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  card_code text not null,
  card_name text not null,
  quantity int default 1,
  condition text,
  is_graded boolean default false,
  grade text,
  graded_company text,
  acquired_price numeric,
  notes text,
  image_url text,
  created_at timestamptz default now()
);

alter table public.collection_cards enable row level security;

create policy "Users can view own cards"
  on public.collection_cards for select
  using (user_id = auth.uid());

create policy "Users can insert own cards"
  on public.collection_cards for insert
  with check (user_id = auth.uid());

create policy "Users can update own cards"
  on public.collection_cards for update
  using (user_id = auth.uid());

create policy "Users can delete own cards"
  on public.collection_cards for delete
  using (user_id = auth.uid());

-- ----- CARD PRICES (world-readable, service-role writable) -----
create table public.card_prices (
  card_code text primary key,
  raw_market numeric,
  graded_prices jsonb,
  currency text default 'EUR',
  fetched_at timestamptz default now()
);

alter table public.card_prices enable row level security;

create policy "Authenticated users can read prices"
  on public.card_prices for select
  to authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated.
-- Only the service_role (used server-side) bypasses RLS to write.

-- ----- INTEL ITEMS (world-readable, service-role writable) -----
create table public.intel_items (
  id uuid primary key default gen_random_uuid(),
  category text,
  title text unique,
  summary text,
  source text,
  published text,
  urgent boolean default false,
  jp_only boolean default false,
  card_names text[] default '{}',
  fetched_at timestamptz default now()
);

alter table public.intel_items enable row level security;

create policy "Authenticated users can read intel"
  on public.intel_items for select
  to authenticated
  using (true);

-- ----- INDEXES -----
create index idx_collections_user on public.collections (user_id);
create index idx_collection_cards_user on public.collection_cards (user_id);
create index idx_collection_cards_collection on public.collection_cards (collection_id);
create index idx_card_prices_fetched on public.card_prices (fetched_at);
create index idx_intel_items_fetched on public.intel_items (fetched_at desc);
