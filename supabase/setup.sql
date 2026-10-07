-- Vítání prváků: INITIAL setup for a NEW, dedicated Supabase project.
-- Paste this file into the project's SQL Editor and run once.
-- Applied to project efezpjzltynkfrqpasju on 2026-10-07. Do not run again.
-- No anonymous reads/writes. Enabling Auth alone does not grant photo access.
-- Store only the finished monochrome portrait, never the full camera frame.

begin;

create table public.portrait_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  can_upload boolean not null default false
); 

create table public.portraits (
  id uuid primary key,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  object_path text not null unique,
  constraint portrait_filename check (object_path = id::text || '.png')
);

create index portraits_created_at_idx on public.portraits(created_at, id);

alter table public.portrait_access enable row level security;
alter table public.portraits enable row level security;

revoke all on public.portrait_access from public, anon, authenticated;
revoke all on public.portraits from public, anon, authenticated;
grant select on public.portrait_access to authenticated;
grant select, insert on public.portraits to authenticated;

create policy "See own portrait access"
  on public.portrait_access for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Event devices can read portraits"
  on public.portraits for select to authenticated
  using (exists (
    select 1 from public.portrait_access
    where user_id = (select auth.uid())
  ));

create policy "Capture device can publish uploaded portraits"
  on public.portraits for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.portrait_access
      where user_id = (select auth.uid()) and can_upload
    )
    and exists (
      select 1 from storage.objects
      where bucket_id = 'portraits' and name = object_path
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portraits', 'portraits', false, 2097152, array['image/png']);

create policy "Event devices can read portrait files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'portraits'
    and exists (
      select 1 from public.portrait_access
      where user_id = (select auth.uid())
    )
  );

create policy "Capture device can upload portrait files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'portraits'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]png$'
    and exists (
      select 1 from public.portrait_access
      where user_id = (select auth.uid()) and can_upload
    )
  );

alter publication supabase_realtime add table public.portraits;

commit;

-- NEXT: Authentication -> Users -> create two email/password users manually.
-- Do NOT use an invitation if no email notification is wanted.
-- Copy their user IDs, replace the placeholders below and run these two lines:
-- insert into public.portrait_access (user_id, can_upload)
-- values ('IPAD_USER_UUID'::uuid, true), ('GALLERY_USER_UUID'::uuid, false);

-- The application will:
-- 1. Authenticate the iPad and PC with their respective user accounts.
-- 2. Generate a UUID, upload <UUID>.png without upsert, then insert its row.
-- 3. Load ordered portrait rows and subscribe to INSERT events on portraits.
-- 4. Use authenticated downloads or short-lived signed URLs for private images.
-- 5. Deduplicate UUIDs and reconcile rows after reconnecting.
-- Browsers must use the publishable key, NEVER a secret/service_role key.
-- Delete files after the event using the Storage dashboard/API; deleting
-- storage.objects rows directly does NOT remove the underlying stored files.
