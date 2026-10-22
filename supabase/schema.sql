-- Run once in the Supabase SQL editor. No service-role key belongs in the app.
begin;
create table public.app_owner (
 singleton boolean primary key default true check (singleton),
 user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table public.app_owner enable row level security;
revoke all on public.app_owner from anon, authenticated;
grant select on public.app_owner to authenticated;
create policy owner_identity on public.app_owner for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_library_owner() returns boolean
language sql stable security definer set search_path = '' as $$
 select (select auth.jwt()->>'aal') = 'aal2'
 and exists (select 1 from public.app_owner where user_id = (select auth.uid()));
$$;
revoke all on function public.is_library_owner() from public;
grant execute on function public.is_library_owner() to anon, authenticated;

create table public.tracks (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 title text not null check (length(title) between 1 and 150),
 artist text not null default 'Personal upload' check (length(artist) between 1 and 150),
 kind text not null check (kind in ('audio','video')),
 object_path text not null unique check (object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp3|m4a|aac|wav|mp4)$' and split_part(object_path,'/',1) = owner_id::text),
 size bigint not null check (size > 0 and size <= 52428800),
 favorite boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.tracks enable row level security;
revoke all on public.tracks from anon, authenticated;
grant select, insert, update, delete on public.tracks to authenticated;
create policy owner_tracks on public.tracks for all to authenticated
 using ((select public.is_library_owner()) and owner_id = (select auth.uid()))
 with check ((select public.is_library_owner()) and owner_id = (select auth.uid()));

create table public.playlists (
 owner_id uuid primary key references auth.users(id),
 name text not null check (length(name) between 1 and 80),
 track_ids uuid[] not null default '{}' check (cardinality(track_ids) <= 10000)
);
alter table public.playlists enable row level security;
revoke all on public.playlists from anon, authenticated;
grant select, insert, update, delete on public.playlists to authenticated;
create policy owner_playlists on public.playlists for all to authenticated
 using ((select public.is_library_owner()) and owner_id = (select auth.uid()))
 with check ((select public.is_library_owner()) and owner_id = (select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('media','media',false,52428800,array['audio/mpeg','audio/mp4','audio/x-m4a','audio/aac','audio/wav','audio/x-wav','video/mp4']);
create policy media_read on storage.objects for select to authenticated using (
 bucket_id='media' and (select public.is_library_owner()) and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy media_upload on storage.objects for insert to authenticated with check (
 bucket_id='media' and (select public.is_library_owner()) and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp3|m4a|aac|wav|mp4)$'
);
create policy media_delete on storage.objects for delete to authenticated using (
 bucket_id='media' and (select public.is_library_owner()) and (storage.foldername(name))[1]=(select auth.uid())::text
);
-- Deliberately no UPDATE policy for objects: uploads cannot overwrite existing files.
commit;

-- After creating YOUR user in Authentication > Users, run separately:
-- insert into public.app_owner (user_id) values ('YOUR-USER-UUID');
-- Disable public signups in Authentication settings before making the app public.
