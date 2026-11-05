-- Run only after the Storage API has copied and verified the original PNGs.
begin;
set local lock_timeout = '5s';
lock table public.portraits in access exclusive mode;
lock table storage.objects in share row exclusive mode;

do $$
begin
  if not exists (
    select 1 from storage.buckets where id = 'portraits-working' and not public
  ) then
    raise exception 'The private working bucket is missing';
  end if;
  if exists (
    select 1 from public.portraits p
    where not exists (
      select 1 from storage.objects o where o.bucket_id = 'portraits' and o.name = p.object_path
    ) or not exists (
      select 1 from storage.objects o where o.bucket_id = 'portraits-working' and o.name = p.object_path
    )
  ) then
    raise exception 'One or more original portraits are missing a source or working PNG';
  end if;
end
$$;

create table public.portraits_working (like public.portraits including all);
alter table public.portraits_working enable row level security;
revoke all on public.portraits_working from public, anon, authenticated;
grant select, insert, delete on public.portraits_working to authenticated;

insert into public.portraits_working (id, created_at, created_by, object_path)
select id, created_at, created_by, object_path from public.portraits;

create policy "Event devices can read working portraits"
  on public.portraits_working for select to authenticated
  using (exists (
    select 1 from public.portrait_access where user_id = (select auth.uid())
  ));

create policy "Capture devices can publish working portraits"
  on public.portraits_working for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.portrait_access where user_id = (select auth.uid()) and can_upload
    )
    and exists (
      select 1 from storage.objects where bucket_id = 'portraits-working' and name = object_path
    )
  );

create policy "Capture devices can delete working portraits"
  on public.portraits_working for delete to authenticated
  using (exists (
    select 1 from public.portrait_access where user_id = (select auth.uid()) and can_upload
  ));

create policy "Event devices can read working portrait files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'portraits-working'
    and exists (select 1 from public.portrait_access where user_id = (select auth.uid()))
  );

create policy "Capture devices can upload working portrait files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'portraits-working'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]png$'
    and exists (select 1 from public.portrait_access where user_id = (select auth.uid()) and can_upload)
  );

create policy "Capture devices can delete working portrait files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'portraits-working'
    and exists (select 1 from public.portrait_access where user_id = (select auth.uid()) and can_upload)
  );

alter publication supabase_realtime add table public.portraits_working;

drop policy "Capture device can publish uploaded portraits" on public.portraits;
drop policy "Capture devices can delete portraits" on public.portraits;
drop policy "Capture device can upload portrait files" on storage.objects;
drop policy "Capture devices can delete portrait files" on storage.objects;
revoke insert, update, delete, truncate on public.portraits from public, anon, authenticated;
comment on table public.portraits is 'Original Bublej portrait archive. Read only for event devices.';

commit;
