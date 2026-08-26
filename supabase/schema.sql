-- Event System — Phase 2 schema
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Untitled event',
  description text not null default '' check (char_length(description) <= 200),
  location    text not null default '' check (char_length(location) <= 200),
  state       jsonb not null,
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Columns added after the table first shipped. `create table if not exists`
-- above is a no-op on an existing database, so these run every time to catch
-- one up — idempotent, hence dropping each constraint before re-adding it.
alter table public.events add column if not exists description text not null default '';
alter table public.events drop constraint if exists events_description_check;
alter table public.events add constraint events_description_check check (char_length(description) <= 200);

alter table public.events add column if not exists location text not null default '';
alter table public.events drop constraint if exists events_location_check;
alter table public.events add constraint events_location_check check (char_length(location) <= 200);

-- Human-readable event URLs (/event/mini-league-event-september). Stored rather
-- than derived from `name`: the name is a live-editable field, and a URL that
-- followed it would break every link a participant already has the moment the
-- organizer fixes a typo.
alter table public.events add column if not exists slug text;

-- Backfill rows that predate the column. Names are neither unique nor always
-- present in real data, so equal names get a numeric suffix (oldest keeps the
-- bare slug) and blank names fall back to their creation date.
with slugged as (
  select
    id,
    coalesce(
      nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''),
      'event-' || to_char(created_at, 'YYYY-MM-DD')
    ) as base,
    row_number() over (
      partition by coalesce(
        nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''),
        'event-' || to_char(created_at, 'YYYY-MM-DD')
      )
      order by created_at
    ) as n
  from public.events
  where slug is null
)
update public.events e
set slug = case when s.n = 1 then s.base else s.base || '-' || s.n end
from slugged s
where e.id = s.id;

alter table public.events alter column slug set not null;

-- The app mirrors this shape when it generates a slug; the constraint is what
-- actually guarantees it, since the slug editor is untrusted input.
alter table public.events drop constraint if exists events_slug_check;
alter table public.events add constraint events_slug_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80);

-- Lookups go through the slug, and it's what keeps two events from claiming
-- the same URL — the app relies on this raising 23505 rather than checking first.
create unique index if not exists events_slug_idx on public.events (slug);

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

-- ============================================================
-- Registrations — participant self-sign-up for the active event
-- ============================================================
--
-- Why a table instead of appending into events.state: that column is written
-- by full-blob replacement (see saveEvent + the debounced autosave), so
-- concurrent writers silently overwrite each other, and no RLS policy can
-- express "you may only append to state.players" — granting anon update on
-- that row would let any participant wipe a running event's results. Row
-- granularity fixes both: anon gets insert here and no write on events at all.
--
-- Emails live only in this table, which anon cannot read. They are
-- deliberately NOT copied into events.state, because that column is
-- world-readable (see "public_read" above).

create table if not exists public.registrations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 60),
  email          text check (email is null or char_length(email) <= 120),
  -- National dex ids. Five digits, not four: alternate/mega/regional forms live
  -- in the 10001-10326 range (see src/data/pokemon.json), and DECK_ID_PATTERN in
  -- src/lib/eventStore.ts mirrors this.
  deck_pokemon_1 text check (deck_pokemon_1 is null or deck_pokemon_1 ~ '^[0-9]{1,5}$'),
  deck_pokemon_2 text check (deck_pokemon_2 is null or deck_pokemon_2 ~ '^[0-9]{1,5}$'),
  -- 'rejected' rows are kept rather than deleted so the unique email index
  -- below keeps blocking a dismissed address from signing up again.
  status         text not null default 'pending'
                 check (status in ('pending', 'admitted', 'rejected')),
  created_at     timestamptz not null default now()
);

-- The submit form is untrusted input, so the length/format checks above are the
-- real validation layer, not the client-side ones that mirror them.

-- Repair databases created while the deck checks only allowed four digits, which
-- rejected every mega/alternate form (e.g. 10033, Mega Venusaur). `create table
-- if not exists` above leaves an existing table alone, so this has to run.
alter table public.registrations
  drop constraint if exists registrations_deck_pokemon_1_check,
  drop constraint if exists registrations_deck_pokemon_2_check;
alter table public.registrations
  add constraint registrations_deck_pokemon_1_check
    check (deck_pokemon_1 is null or deck_pokemon_1 ~ '^[0-9]{1,5}$'),
  add constraint registrations_deck_pokemon_2_check
    check (deck_pokemon_2 is null or deck_pokemon_2 ~ '^[0-9]{1,5}$');

-- Partial, so any number of registrations without an email can coexist.
create unique index if not exists registrations_event_email_idx
  on public.registrations (event_id, lower(email)) where email is not null;

create index if not exists registrations_event_status_idx
  on public.registrations (event_id, status, created_at);

alter table public.registrations enable row level security;

-- anon may only insert, only as 'pending' (so nobody admits themselves), and
-- only while the target event's registration window is genuinely open. That
-- window is enforced here rather than only in the UI — keep this condition in
-- step with `registrationOpen` in src/hooks/useEventState.ts.
drop policy if exists "public_register" on public.registrations;
create policy "public_register" on public.registrations
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status = 'active'
        and coalesce((e.state ->> 'round')::int, 0) = 0
        and coalesce((e.state -> 'eventFinished')::boolean, false) = false
    )
  );

-- Note the absence of an anon select policy: participant emails are visible to
-- the organizer only. A participant's own "you're registered" state is tracked
-- in localStorage instead of being read back from here.
drop policy if exists "admin_read" on public.registrations;
create policy "admin_read" on public.registrations
  for select to authenticated
  using (true);

drop policy if exists "admin_update" on public.registrations;
create policy "admin_update" on public.registrations
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists "admin_delete" on public.registrations;
create policy "admin_delete" on public.registrations
  for delete to authenticated
  using (true);
