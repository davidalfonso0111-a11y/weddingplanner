-- New Supabase projects no longer expose public tables to the Data API automatically.
-- Grant only what the atelier needs; Row Level Security still decides which rows.
grant usage on schema public to authenticated, service_role;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.atelier_state to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
-- pins: no direct access, only through the PIN functions.
grant all on public.profiles, public.atelier_state, public.documents, public.pins to service_role;
revoke truncate, trigger, references on public.profiles, public.atelier_state, public.documents, public.pins from anon, authenticated;
