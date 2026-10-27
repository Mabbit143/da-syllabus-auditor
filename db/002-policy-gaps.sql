-- DA Syllabus Auditor, part 2: run once in the Supabase SQL editor after schema.sql.

-- School policies: the official rules found for each school. Public information, but every row is
-- re-checked against its web page before use, so a tampered row is ignored.
create table if not exists public.school_policies (
  school_key text primary key,
  policies jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.school_policies enable row level security;
create policy "read school policies" on public.school_policies for select to authenticated using (true);
create policy "add school policies" on public.school_policies for insert to authenticated with check (true);
create policy "update school policies" on public.school_policies for update to authenticated using (true) with check (true);

-- Master list of places where a syllabus differs from its school's written policy.
-- No user id is stored. Signed-in users can add rows but there is no select policy, so nobody can read them back.
create table if not exists public.policy_gaps (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  topic text not null,
  kind text not null check (kind in ('conflicts', 'adds_requirement', 'silent')),
  instructor text,
  syllabus_quote text,
  syllabus_page int,
  school_quote text not null,
  school_url text not null,
  syllabus_hash text not null,
  created_at timestamptz not null default now(),
  unique (school, topic, syllabus_hash)
);
alter table public.policy_gaps enable row level security;
create policy "add policy gaps" on public.policy_gaps for insert to authenticated with check (true);

-- Only people listed here can read the master list. Add yourself once in the SQL editor:
--   insert into public.app_owners (user_id) select id from auth.users where email = 'YOUR EMAIL';
create table if not exists public.app_owners (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.app_owners enable row level security;

create or replace function public.gap_report(threshold int default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.app_owners where user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  select coalesce(jsonb_agg(g order by (g->>'syllabi')::int desc, g->>'school'), '[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'school', school, 'topic', topic, 'kind', kind,
      'syllabi', count(distinct syllabus_hash),
      'flagged', count(distinct syllabus_hash) >= threshold,
      'entries', jsonb_agg(jsonb_build_object(
        'instructor', instructor, 'syllabusQuote', syllabus_quote, 'syllabusPage', syllabus_page,
        'schoolQuote', school_quote, 'schoolUrl', school_url, 'at', created_at) order by created_at desc)
    ) as g
    from public.policy_gaps
    group by school, topic, kind
  ) t;
  return result;
end;
$$;
revoke all on function public.gap_report(int) from public, anon;
grant execute on function public.gap_report(int) to authenticated;
