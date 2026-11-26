-- Emergency rollback for the role-based access change in schema.sql.
--
-- Puts every write policy back to "any signed-in user may write", the setup
-- from before roles existed. Only safe while the single legacy organizer
-- account is the ONLY Supabase Auth user able to sign in, so first:
--
--   1. Authentication → Sign In / Providers → Google: turn it OFF.
--   2. Authentication → Users: delete any accounts other than the organizer's
--      (or accept that each of them can now edit everything).
--
-- Then run this in the SQL Editor. The user_roles table and its functions are
-- left in place, unused, so re-running schema.sql later picks up where it was.

drop policy if exists "admin_insert" on public.events;
create policy "admin_insert" on public.events
  for insert to authenticated with check (true);

drop policy if exists "admin_update" on public.events;
create policy "admin_update" on public.events
  for update to authenticated using (true) with check (true);

drop policy if exists "admin_delete" on public.events;
create policy "admin_delete" on public.events
  for delete to authenticated using (true);

drop policy if exists "event_photos_admin_insert" on storage.objects;
create policy "event_photos_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'event-photos');

drop policy if exists "event_photos_admin_delete" on storage.objects;
create policy "event_photos_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'event-photos');

drop policy if exists "admin_insert" on public.event_photos;
create policy "admin_insert" on public.event_photos
  for insert to authenticated with check (true);

drop policy if exists "admin_delete" on public.event_photos;
create policy "admin_delete" on public.event_photos
  for delete to authenticated using (true);

drop policy if exists "admin_read" on public.registrations;
create policy "admin_read" on public.registrations
  for select to authenticated using (true);

drop policy if exists "admin_update" on public.registrations;
create policy "admin_update" on public.registrations
  for update to authenticated using (true) with check (true);

drop policy if exists "admin_delete" on public.registrations;
create policy "admin_delete" on public.registrations
  for delete to authenticated using (true);
