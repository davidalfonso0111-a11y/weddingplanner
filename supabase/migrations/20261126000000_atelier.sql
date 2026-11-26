-- Belles Creators · Atelier backend (Supabase)
-- Accounts per department, PIN app-lock, shared atelier data and owner-only documents.
-- Public sign-up must be DISABLED in Auth settings: users are created by the owner
-- (invite-staff edge function) or in the Supabase dashboard.

create extension if not exists pgcrypto with schema extensions;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role text not null check (role in ('owner','planner','stylist','decoration','catering')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'owner', false)
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null
$$;

-- New auth user -> profile. Role comes from the invite metadata; the very first user becomes owner.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := coalesce(new.raw_app_meta_data->>'bc_role', '');
  if not exists (select 1 from public.profiles where role = 'owner') then
    r := 'owner';
  end if;
  if r not in ('owner','planner','stylist','decoration','catering') then
    r := 'planner';
  end if;
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), coalesce(new.email, ''), r)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Staff see the team list (names/roles); only the owner changes roles or active state.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (public.is_staff() or id = auth.uid());
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Keep at least one active owner and never let the owner demote themselves by accident.
create or replace function public.protect_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and (new.role <> 'owner' or not new.active)
     and not exists (select 1 from public.profiles where role = 'owner' and active and id <> old.id) then
    raise exception 'Er moet minstens één actieve owner blijven';
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_owner on public.profiles;
create trigger profiles_protect_owner before update on public.profiles
  for each row execute function public.protect_owner();

-- ---------- PIN app-lock (hash only, never readable by clients) ----------
create table if not exists public.pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  failed int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.pins enable row level security;  -- no policies: only the functions below touch it

create or replace function public.has_pin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pins where user_id = auth.uid())
$$;

create or replace function public.set_pin(p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'not allowed'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN moet 4 cijfers zijn'; end if;
  insert into public.pins (user_id, pin_hash, failed, updated_at)
  values (auth.uid(), crypt(p_pin, gen_salt('bf')), 0, now())
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, failed = 0, updated_at = now();
end $$;

-- Returns 'ok', 'wrong', 'locked' (5 wrong tries: PIN removed, e-mail + wachtwoord needed) or 'none'.
create or replace function public.verify_pin(p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare rec public.pins%rowtype;
begin
  if auth.uid() is null or not public.is_staff() then return 'none'; end if;
  select * into rec from public.pins where user_id = auth.uid();
  if not found then return 'none'; end if;
  if rec.pin_hash = crypt(coalesce(p_pin, ''), rec.pin_hash) then
    update public.pins set failed = 0 where user_id = auth.uid();
    return 'ok';
  end if;
  if rec.failed + 1 >= 5 then
    delete from public.pins where user_id = auth.uid();
    return 'locked';
  end if;
  update public.pins set failed = failed + 1 where user_id = auth.uid();
  return 'wrong';
end $$;

create or replace function public.reset_pin(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  delete from public.pins where user_id = p_user;
end $$;

revoke all on function public.set_pin(text), public.verify_pin(text), public.reset_pin(uuid), public.has_pin() from public, anon;
grant execute on function public.set_pin(text), public.verify_pin(text), public.reset_pin(uuid), public.has_pin() to authenticated;

-- ---------- shared atelier data (weddings, tasks, planning, catering, ...) ----------
create table if not exists public.atelier_state (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.atelier_state enable row level security;
drop policy if exists state_select on public.atelier_state;
create policy state_select on public.atelier_state for select to authenticated using (public.is_staff());
drop policy if exists state_insert on public.atelier_state;
create policy state_insert on public.atelier_state for insert to authenticated with check (public.is_staff());
drop policy if exists state_update on public.atelier_state;
create policy state_update on public.atelier_state for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- owner-only documents ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('werk','nda','wedding','policy')),
  title text not null,
  person text not null default '',
  wedding text not null default '',
  signed boolean not null default false,
  signed_on date,
  file_path text not null,
  file_name text not null,
  mime text not null default 'application/octet-stream',
  size bigint not null default 0,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
drop policy if exists documents_owner on public.documents;
create policy documents_owner on public.documents for all to authenticated using (public.is_owner()) with check (public.is_owner());

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists documents_owner_read on storage.objects;
create policy documents_owner_read on storage.objects for select to authenticated using (bucket_id = 'documents' and public.is_owner());
drop policy if exists documents_owner_insert on storage.objects;
create policy documents_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'documents' and public.is_owner());
drop policy if exists documents_owner_update on storage.objects;
create policy documents_owner_update on storage.objects for update to authenticated using (bucket_id = 'documents' and public.is_owner());
drop policy if exists documents_owner_delete on storage.objects;
create policy documents_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'documents' and public.is_owner());

-- Hardening: trigger functions are not callable through the API; role helpers only for signed-in users.
revoke execute on function public.handle_new_user(), public.protect_owner() from public, anon, authenticated;
revoke execute on function public.my_role(), public.is_owner(), public.is_staff() from public, anon;
grant execute on function public.my_role(), public.is_owner(), public.is_staff() to authenticated;
