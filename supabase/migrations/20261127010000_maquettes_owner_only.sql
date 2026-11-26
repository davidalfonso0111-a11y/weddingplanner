-- Atelier (maquettes): OWNER ONLY. Admin (and every department) has no access.
-- Self-contained and safe to run more than once: creates the table and bucket if
-- 20261127000000_maquettes.sql was never run, and replaces its owner+admin policies if it was.

create or replace function public.is_real_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'owner', false)
$$;
revoke execute on function public.is_real_owner() from public, anon;
grant execute on function public.is_real_owner() to authenticated;

create table if not exists public.maquettes (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Nieuwe maquette' check (char_length(title) <= 140),
  couple text not null default '' check (char_length(couple) <= 140),
  wedding_date date,
  place text not null default '' check (char_length(place) <= 140),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 4000000),
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maquettes enable row level security;
drop policy if exists maquettes_owner on public.maquettes;
create policy maquettes_owner on public.maquettes for all to authenticated
  using (public.is_real_owner()) with check (public.is_real_owner());

-- The project does not auto-expose new tables to the Data API, so grant explicitly.
revoke all on public.maquettes from public, anon;
grant select, insert, update, delete on public.maquettes to authenticated;
revoke truncate, trigger, references on public.maquettes from authenticated;

-- Private bucket for maquette photos and painted layers (max 15 MB per file, images only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('maquettes', 'maquettes', false, 15728640, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 15728640,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists maquettes_owner_read on storage.objects;
create policy maquettes_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'maquettes' and public.is_real_owner());
drop policy if exists maquettes_owner_insert on storage.objects;
create policy maquettes_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'maquettes' and public.is_real_owner());
drop policy if exists maquettes_owner_update on storage.objects;
create policy maquettes_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'maquettes' and public.is_real_owner());
drop policy if exists maquettes_owner_delete on storage.objects;
create policy maquettes_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'maquettes' and public.is_real_owner());
