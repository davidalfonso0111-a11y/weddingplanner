-- Admin role: full access like the owner (documents, team, finance), for David.
-- The owner (Belle) stays a separate account; everyone keeps their own login.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner','admin','planner','stylist','decoration','catering'));

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('owner','admin'), false)
$$;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;
-- Assign: update public.profiles set role = 'admin' where email = '<admin e-mail>';
