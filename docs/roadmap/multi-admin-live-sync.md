# Multi-admin live sync for running events

**Status:** Planned · Phase 6 · supersedes the Phase 2 follow-up
"last-write-wins only; no multi-device conflict handling"

## Why

Multiple organizers now monitor the same event at once. Today they have to
manually refresh before every edit, because `saveEvent`
([src/lib/eventStore.ts](../../src/lib/eventStore.ts)) replaces the **entire**
`events.state` JSON blob with `.update({...}).eq('id', id)` — no version
precondition, no `.select()` read-back. Whichever admin's 600ms autosave
([src/hooks/useEventState.ts](../../src/hooks/useEventState.ts)) fires last
silently wins the whole event; the other's round of results vanishes with no
error, because the UPDATE succeeds.

This is the case PLAN.md's Phase 2 follow-up parked as "revisit if Phase 3 adds
concurrent editors". Phase 3 did.

**TanStack Query was considered and rejected.** The problem isn't caching or
refetch scheduling — it's last-write-wins on a whole-row write. React Query would
give admins fresher reads while still letting a stale blob clobber a result, and
its optimistic-update helpers assume the server merges, which ours doesn't. It
would mean rewriting `useEventState` around `useQuery`/`useMutation` and *still*
hand-writing the version guard and the merge. Supabase Realtime is already in the
stack and covers the push side with no new dependency.

**Outcome:** two admins report results on different tables at the same moment and
both results survive; each sees the other's within a second; nobody refreshes.
Participants get an explicit Refresh button above the standings table (Phase 4's
reasoning still holds for them — see the note at the end).

## Approach

Four layers, each independently useful, in this order.

### 1. Stable match IDs (prerequisite for merging)

`SwissMatch` ([src/engine/tournament.ts](../../src/engine/tournament.ts)) has no
`id`, and `reportSwiss` matches by JS **object reference** (`m === targetMatch`).
A reference captured from a stale array can never be found in a freshly-loaded
one, so merging is impossible without IDs.

- Add required `id: string` to `SwissMatch`.
- Assign at construction — `startRound` for Swiss pairings and byes,
  `generateRoundRobinSchedule` for league — using the deterministic form
  `` `r${round}-${indexWithinRound}` ``.
- Backfill old blobs in `normalizeState` (`eventStore.ts`): any match missing
  `id` gets `` `r${m.round}-${n}` `` by its position among that round's matches
  in array order. Deterministic, so every client derives identical IDs from the
  same blob before anyone writes.
- Change signatures to take IDs: `reportSwiss(matchId, patch)`,
  `reportLeagueGame(matchId, winner)`, `reportLeagueDraw(matchId)`,
  `swapSwissPlayers(matchAId, sideA, matchBId, sideB)`. Brackets already use
  `matchId` ([BracketView.tsx](../../src/components/BracketView.tsx)) — follow
  that precedent.
- Call sites: prop types and handlers in
  [SwissPanel.tsx](../../src/components/SwissPanel.tsx),
  [LeaguePanel.tsx](../../src/components/LeaguePanel.tsx), and
  [CurrentEventPage.tsx](../../src/pages/CurrentEventPage.tsx).
  `PairingTicket` / `LeaguePairingTicket` are unchanged — they emit patches, the
  panel supplies the ID.
- The `SwissMatch[]` fixture blocks in
  [tournament.test.ts](../../src/engine/tournament.test.ts) need IDs. Add a
  `mkMatch(partial)` helper rather than hand-editing every literal.

### 2. Optimistic concurrency in Postgres

Append to [supabase/schema.sql](../../supabase/schema.sql), idempotent in the
same style as the existing `alter table ... if not exists` blocks:

```sql
alter table public.events add column if not exists version bigint not null default 1;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' then new.version = old.version + 1; end if;
  return new;
end;
$$;

-- Realtime push for the events row (wrap in a DO block guarded on
-- pg_publication_tables so re-running the file is a no-op).
alter publication supabase_realtime add table public.events;
```

`set_updated_at` is used only by the `events_set_updated_at` trigger, so
extending it is safe. No RLS change needed: `public_read` is already
`to anon, authenticated`, which is what both `.select()`-after-update and
Realtime's RLS check require.

In `eventStore.ts`:

- Add `version: number` to `ArchivedEventSummary` / `EventDetail`, and `version`
  to every `select(...)` column list.
- Replace `saveEvent` with two functions:
  - `saveEventMeta(id, {name, description, location}): Promise<number>` —
    per-column update, returns the new version. Text fields are separate columns,
    so they never need to carry the `state` blob.
  - `saveEventState(id, state, expectedVersion): Promise<number | null>` —
    `.update({state}).eq('id', id).eq('version', expectedVersion).select('version').maybeSingle()`.
    `null` means another writer got there first.
- Point [ArchivedEventDetail.tsx](../../src/components/ArchivedEventDetail.tsx)
  at `saveEventMeta`. It currently rewrites the whole state blob just to save a
  description.

### 3. Rebase-on-conflict commit queue

New pure module `src/lib/eventCommit.ts` (no React, so it's directly
unit-testable), wrapped by `useEventState`.

Local state is always `fold(pending, serverState)`:

```
serverState   : EventState   // last state confirmed by the server
serverVersion : number
pending       : { key?: string; fn: (s: EventState) => EventState; settle }[]
```

Flush cycle:

1. Snapshot `inFlight = pending`, clear `pending`.
2. `candidate = fold(inFlight, serverState)`;
   `v = await saveEventState(id, candidate, serverVersion)`.
3. On success: `serverState = candidate`, `serverVersion = v`, settle those
   entries.
4. On `null` (conflict): reload via `loadEventById`, set
   `serverState`/`serverVersion` from it, push `inFlight` back to the **front**
   of `pending`, retry (max 5 attempts, then `saveStatus = 'error'`).
5. After every step re-emit `fold(pending, serverState)` to React, so a rebase
   shows the other admin's result *and* your own.

Two rules the actions must obey, both enforceable by construction:

- **Actions must be deterministic.** `generateSwissPairings` and
  `generateRoundRobinSchedule` shuffle; replaying them on rebase would re-pair
  the round differently from what the admin is already looking at. So compute
  pairings and brackets **outside** the action and close over the finished array
  — the action only appends what was computed. Add a cheap guard inside the
  closure (`if (s.round >= nextRound) return s;`) so a rebase against an admin
  who already started the round is a no-op instead of a double-append.
- **Keyed coalescing is only for last-write-wins single fields.**
  `renamePlayer`, `setPlayerDeck` and `roundsInput` pass
  `key: 'rename:<playerId>'` and friends so per-keystroke edits collapse to one
  write. Discrete actions (report result, start round, drop, swap, finish,
  generate bracket) pass no key and flush immediately, shrinking the conflict
  window from 600ms to one round trip.

`admitRegistrations` uses a `commitAsync` variant that resolves when its entry is
confirmed, preserving its existing save-roster-before-flipping-registrations
ordering.

In `useEventState`, the 8 persisted `useState` calls collapse into one
`useState<EventState>` plus the queue. **The returned API keeps the same key
names** (`players: state.players`, `matches: state.matches`, …), so no consumer
component changes beyond the ID signatures in step 1.

### 4. Realtime for admins, Refresh button for everyone else

- New `src/hooks/useEventRealtime.ts`: `supabase.channel('event:' + id)`
  subscribing to `postgres_changes` UPDATE on `public.events` filtered
  `id=eq.<id>`; `removeChannel` on cleanup. Subscribe **only when `isAdmin`** —
  pass it through `LiveEvent` in
  [EventPage.tsx](../../src/pages/EventPage.tsx), which already has it.
- Handler: if `payload.new.version > serverVersion` **and** no flush is in
  flight, refetch via `loadEventById` (avoids Realtime payload-size limits on a
  large blob) and re-fold. If a flush is in flight, ignore — step 3's conflict
  path already resolves it. Also route `payload.new.status !== 'active'` to the
  existing `onBecameInactive`.
- The existing visibility/focus listener in `useEventState` stays as the mobile
  fallback for a slept socket, but its "never re-applies the record" restriction
  can now be lifted: re-folding pending actions over a fresh base is safe by
  construction.
- **Non-admin Refresh:** `useEventState` exposes `refresh()` and `refreshing`.
  Render a `tk-btn ghost tk-btn--sm` button in the `tk-standings-block` header
  alongside `<h3 className="tk-section-title">Standings</h3>` in `SwissPanel` and
  `LeaguePanel`, shown when `!isAdmin`. Both panels already receive `isAdmin`;
  thread `onRefresh`/`refreshing` from `CurrentEventPage`. One small flex-row
  class in [src/styles/tokens.css](../../src/styles/tokens.css) near
  `.tk-standings-block`.

## Trade-offs accepted

- Two admins reporting **different** matches: both survive, no visible conflict.
- Two admins reporting the **same** match: last writer wins that match's result.
  Everything else on both sides survives.
- After 5 failed rebases the footer shows "Save failed"; local edits are still on
  screen and re-committing retries.
- Single/double-elim modes have no standings block, so non-admins there keep the
  current manual-reload behaviour. Revisit if elim events get run alongside a
  crowd watching.
- Realtime connections are admin-only, which keeps the concurrent-connection
  count at roughly the number of organizers rather than the number of attendees.

## Verification

1. `npm run test` — extend `tournament.test.ts` for match IDs and
   `normalizeState` backfill; new `src/lib/eventCommit.test.ts` covering fold,
   keyed coalescing, a single rebase, concurrent-disjoint-actions merge, and
   give-up after max retries (inject fake `save`/`reload`, no network).
2. `npm run check` (prettier + oxlint + tsc) — not tests alone.
3. Run the schema block in the Supabase SQL editor; confirm `version` increments
   on update and `events` is in the `supabase_realtime` publication.
4. Two-tab manual test on `npm run dev`, signed in as admin in both tabs on the
   same `/event/<slug>`:
   - Report table 1 in tab A → appears in tab B within ~1s without refreshing.
   - Report table 1 in A and table 2 in B as simultaneously as possible → **both**
     results present in both tabs and in the Supabase row.
   - Type a description in A while B reports a result → neither is lost.
   - Archive from a third tab → both event tabs fall back to the archive view.
5. Open the event signed out; confirm the Refresh button appears above standings,
   pulls the latest results, and that no Realtime channel is opened.

## Relationship to Phase 4

Phase 4 ("live/shared views") was dropped on the reasoning that matches take
10–30 minutes, so *players* only need standings after their own match ends and
manual refresh is enough. That reasoning still holds for participants, and this
phase doesn't change it — they get a button, not a socket. What it didn't
anticipate is *organizers*, who write concurrently and for whom a stale view
isn't an inconvenience but silent data loss.
