create or replace function public.enforce_feedback_review_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.feedback_reviews
    where user_id = new.user_id
      and created_at > now() - interval '5 hours'
  ) then
    raise exception 'review cooldown active'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists feedback_review_cooldown_before_insert on public.feedback_reviews;

create trigger feedback_review_cooldown_before_insert
  before insert on public.feedback_reviews
  for each row
  execute function public.enforce_feedback_review_cooldown();
