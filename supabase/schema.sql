-- Event System — Phase 2 schema
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Untitled event',
  description text not null default '' check (char_length(description) <= 200),
  state       jsonb not null,
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Migrating an existing database that predates this column:
-- alter table public.events add column if not exists description text not null default '';
-- alter table public.events add constraint events_description_check check (char_length(description) <= 200);

-- Keep updated_at fresh on every write (used for "load latest active" and archive ordering).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Row-Level Security — Phase 3: everyone can read, only the signed-in
-- organizer can write. Exactly one Supabase Auth user should ever exist
-- (create it manually in the dashboard and disable public sign-ups), so
-- "authenticated" and "the organizer" are equivalent — no admin table needed.
alter table public.events enable row level security;

-- Superseded by the read/write split below; drop it if it exists from Phase 2.
drop policy if exists "open_all" on public.events;

drop policy if exists "public_read" on public.events;
create policy "public_read" on public.events
  for select
  to anon, authenticated
  using (true);

drop policy if exists "admin_insert" on public.events;
create policy "admin_insert" on public.events
  for insert
  to authenticated
  with check (true);

drop policy if exists "admin_update" on public.events;
create policy "admin_update" on public.events
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "admin_delete" on public.events;
create policy "admin_delete" on public.events
  for delete
  to authenticated
  using (true);

create index if not exists events_status_updated_idx
  on public.events (status, updated_at desc);

-- ============================================================
-- Event photos — photo gallery for archived events
-- ============================================================

-- SQL Editor runs as the postgres owner role, bypassing storage.buckets RLS,
-- so this creates the bucket without a manual dashboard step. If it's ever
-- rejected by a given project's permissions, fall back to:
-- Dashboard → Storage → New bucket → name "event-photos" → Public bucket: ON.
insert into storage.buckets (id, name, public, file_size_limit)
values ('event-photos', 'event-photos', true, 10485760) -- 10MB/object safety cap
on conflict (id) do nothing;

drop policy if exists "event_photos_public_read" on storage.objects;
create policy "event_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'event-photos');

drop policy if exists "event_photos_admin_insert" on storage.objects;
create policy "event_photos_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-photos');

drop policy if exists "event_photos_admin_delete" on storage.objects;
create policy "event_photos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-photos');
-- No update policy: "replacing" a photo is delete + re-upload under a new path.

create table if not exists public.event_photos (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

alter table public.event_photos enable row level security;

drop policy if exists "public_read" on public.event_photos;
create policy "public_read" on public.event_photos
  for select to anon, authenticated
  using (true);

drop policy if exists "admin_insert" on public.event_photos;
create policy "admin_insert" on public.event_photos
  for insert to authenticated
  with check (true);

drop policy if exists "admin_delete" on public.event_photos;
create policy "admin_delete" on public.event_photos
  for delete to authenticated
  using (true);

create index if not exists event_photos_event_id_idx
  on public.event_photos (event_id, created_at);
