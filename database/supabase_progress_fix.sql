-- PSM Prep cloud progress compatibility fix
-- Run once in Supabase Dashboard > SQL Editor.

begin;

-- Keep the existing tables and add only the fields required by the website.
alter table public.exam_attempts
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists visitor_id uuid,
  add column if not exists session_id uuid,
  add column if not exists exam_code text,
  add column if not exists total_questions integer not null default 0,
  add column if not exists correct_answers integer not null default 0,
  add column if not exists wrong_answers integer not null default 0,
  add column if not exists percentage numeric not null default 0,
  add column if not exists duration_seconds integer not null default 0,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz not null default now();

alter table public.practice_sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists visitor_id uuid,
  add column if not exists session_id uuid,
  add column if not exists practice_mode text,
  add column if not exists element_number integer,
  add column if not exists total_questions integer not null default 0,
  add column if not exists correct_answers integer not null default 0,
  add column if not exists wrong_answers integer not null default 0,
  add column if not exists duration_seconds integer not null default 0,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz not null default now();

alter table public.question_attempts
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists visitor_id uuid,
  add column if not exists session_id uuid,
  add column if not exists question_id text,
  add column if not exists element_number integer,
  add column if not exists selected_answer text,
  add column if not exists is_correct boolean,
  add column if not exists answer_time_seconds integer not null default 0,
  add column if not exists attempted_at timestamptz not null default now();

alter table public.exam_attempts enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.question_attempts enable row level security;

-- Recreate predictable authenticated-user policies.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['exam_attempts','practice_sessions','question_attempts']
  loop
    execute format('drop policy if exists "users insert own" on public.%I', table_name);
    execute format('create policy "users insert own" on public.%I for insert to authenticated with check (auth.uid() = user_id)', table_name);

    execute format('drop policy if exists "users select own" on public.%I', table_name);
    execute format('create policy "users select own" on public.%I for select to authenticated using (auth.uid() = user_id)', table_name);

    execute format('drop policy if exists "users update own" on public.%I', table_name);
    execute format('create policy "users update own" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name);

    execute format('drop policy if exists "users delete own" on public.%I', table_name);
    execute format('create policy "users delete own" on public.%I for delete to authenticated using (auth.uid() = user_id)', table_name);
  end loop;
end $$;

create index if not exists exam_attempts_user_id_idx on public.exam_attempts(user_id);
create index if not exists practice_sessions_user_id_idx on public.practice_sessions(user_id);
create index if not exists question_attempts_user_id_idx on public.question_attempts(user_id);
create index if not exists question_attempts_attempt_id_idx on public.question_attempts(attempt_id);

commit;
