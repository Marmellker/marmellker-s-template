create table if not exists public.infinite_leaderboard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('wave', 'flipWave', 'laser', 'orbit', 'ship', 'ufo')),
  nickname text not null check (char_length(trim(nickname)) between 1 and 24),
  seconds integer not null check (seconds > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mode)
);

create index if not exists infinite_leaderboard_mode_seconds_idx
  on public.infinite_leaderboard (mode, seconds desc, updated_at asc);

alter table public.infinite_leaderboard enable row level security;

create policy "read infinite leaderboard"
  on public.infinite_leaderboard for select
  using (true);

create policy "insert own infinite leaderboard score"
  on public.infinite_leaderboard for insert
  with check (auth.uid() = user_id);

create policy "update own infinite leaderboard score"
  on public.infinite_leaderboard for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
