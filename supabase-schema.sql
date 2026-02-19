-- =========================================================================
-- Kite Credit — Supabase Schema
-- =========================================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =========================================================================

-- 1. Profiles (extends auth.users with display name)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 2. User connections (wallet, GitHub, Plaid tokens)
create table if not exists public.user_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null, -- 'solana_wallet' | 'github' | 'plaid'
  provider_user_id text, -- wallet address, github username, etc.
  access_token_encrypted text, -- AES-256-GCM encrypted token (null for wallets)
  metadata jsonb default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

alter table public.user_connections enable row level security;

create policy "Users can read own connections"
  on public.user_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own connections"
  on public.user_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own connections"
  on public.user_connections for update
  using (auth.uid() = user_id);

create policy "Users can delete own connections"
  on public.user_connections for delete
  using (auth.uid() = user_id);

-- 3. User scores (history of calculated scores)
create table if not exists public.user_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  total_score integer not null,
  tier text not null,
  breakdown jsonb not null default '{}',
  github_bonus integer not null default 0,
  explanation text not null default '',
  attestation jsonb,
  sources text[] not null default '{}',
  calculated_at timestamptz not null default now()
);

alter table public.user_scores enable row level security;

create policy "Users can read own scores"
  on public.user_scores for select
  using (auth.uid() = user_id);

create policy "Users can insert own scores"
  on public.user_scores for insert
  with check (auth.uid() = user_id);

-- Index for fast latest-score lookup
create index if not exists idx_user_scores_user_latest
  on public.user_scores(user_id, calculated_at desc);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid duplicates on re-run
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Shared scores (short-URL share links)
create table if not exists public.shared_scores (
  id text primary key,
  data jsonb not null,
  data_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.shared_scores enable row level security;

create policy "Anyone can read shared scores"
  on public.shared_scores for select
  using (true);

create unique index if not exists idx_shared_scores_data_hash
  on public.shared_scores(data_hash);

create index if not exists idx_shared_scores_created_at
  on public.shared_scores(created_at);
