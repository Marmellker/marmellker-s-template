-- Создаёт таблицу аккаунтов BeatShift.
-- Применить: npm run db:push

create table if not exists public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  provider text,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "read own account"
  on public.accounts for select
  using (auth.uid() = id);

create policy "insert own account"
  on public.accounts for insert
  with check (auth.uid() = id);

create policy "update own account"
  on public.accounts for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
