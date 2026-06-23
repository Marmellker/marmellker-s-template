create table if not exists public.rank_leaderboard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 1 and 24),
  points integer not null check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists rank_leaderboard_points_idx
  on public.rank_leaderboard (points desc, updated_at asc);

alter table public.rank_leaderboard enable row level security;

create policy "read rank leaderboard"
  on public.rank_leaderboard for select
  using (true);

create policy "insert own rank leaderboard score"
  on public.rank_leaderboard for insert
  with check (auth.uid() = user_id);

create policy "update own rank leaderboard score"
  on public.rank_leaderboard for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
