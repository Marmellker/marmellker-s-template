create table if not exists public.feedback_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email text,
  nickname text,
  body text not null check (char_length(body) between 1 and 700),
  created_at timestamptz not null default now()
);

create index if not exists feedback_reviews_user_created_idx
  on public.feedback_reviews (user_id, created_at desc);

create index if not exists feedback_reviews_created_idx
  on public.feedback_reviews (created_at desc);

alter table public.feedback_reviews enable row level security;

create policy "read own feedback reviews or admin"
  on public.feedback_reviews for select
  using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'boldinar2@gmail.com'
  );

create policy "insert own feedback reviews"
  on public.feedback_reviews for insert
  with check (auth.uid() = user_id);
