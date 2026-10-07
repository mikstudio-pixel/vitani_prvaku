-- Apply once after setup.sql in the dedicated event project.
begin;
grant delete on public.portraits to authenticated;
create policy "Capture devices can delete portraits"
  on public.portraits for delete to authenticated
  using (exists (
    select 1 from public.portrait_access
    where user_id = (select auth.uid()) and can_upload
  ));
create policy "Capture devices can delete portrait files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'portraits'
    and exists (
      select 1 from public.portrait_access
      where user_id = (select auth.uid()) and can_upload
    )
  );
commit;
