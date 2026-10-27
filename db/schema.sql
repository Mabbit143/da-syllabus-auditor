-- DA Syllabus Auditor: run once in the Supabase SQL editor.
-- Every table is private to its owner through row-level security.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.opp_status (
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  status text not null check (status in ('new', 'saved', 'rejected')),
  opp jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, url)
);

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  report jsonb not null,
  pages jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.opp_status enable row level security;
alter table public.audits enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own opp status" on public.opp_status
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own audits" on public.audits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
