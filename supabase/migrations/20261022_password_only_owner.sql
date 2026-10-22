-- Existing Auralis projects: run this in the Supabase SQL editor.
-- Keeps the configured owner, tables, private bucket and RLS policies intact.
-- Safe to rerun. No account or media is deleted.
begin;
create or replace function public.is_library_owner() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.app_owner where user_id = (select auth.uid()));
$$;
revoke all on function public.is_library_owner() from public;
grant execute on function public.is_library_owner() to anon, authenticated;
commit;
