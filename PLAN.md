# Event System — Plan

Tournament event system for a TCG store platform (companion to a separate
"Card System" for inventory/auction). This piece owns **event creation,
registration, pairings/brackets, and standings**.

## Status: engine done, verified, and building

- `src/engine/tournament.js` — pure functions, no React/DOM dependency.
  Swiss pairing + standings (MTG-style tiebreakers), single elimination
  (standard seeding), double elimination (winners/losers bracket + grand
  final reset).
- `src/engine/tournament.test.js` — 20 Vitest cases (randomized results,
  sizes 2–16, odd player counts, byes). All passing.
- `src/App.jsx` + `src/components/*` — working reference UI: add/remove
  players, run Swiss rounds and report results, generate & play out
  single/double elim brackets. Runs and builds clean (`npm run dev` /
  `npm run build` both verified).

Known, intentional simplifications (see comments at the top of
`tournament.js`):

1. Swiss pairing is greedy nearest-neighbor by standing, not the full
   Dutch/USCF algorithm — fine below ~64 players, could in rare cases
   force one avoidable rematch.
2. Losers-bracket pairings in double elim are positional, not seeded to
   maximally delay rematches. Elimination logic itself (lose twice = out,
   bracket reset) is correct and tested.

Revisit these only if this needs to satisfy a formal ruleset (e.g. WER/DCI
rules for sanctioned play) — flag it before then.

## Architecture decisions already made

- **Vite + React + TypeScript** (strict mode). Originally plain JS; migrated
  to TS before Phase 2 so the engine's domain types (`Player`, `SwissMatch`,
  bracket shapes in `tournament.ts`) can back the persistence layer directly.
- Engine is framework-agnostic on purpose — same functions should be
  reusable from a React Native "run the floor" companion app later without
  rewriting pairing logic.
- No backend yet. Everything today is in-memory React state. That's the
  next real decision point (see Phase 2).

## Roadmap

### Phase 1 — Registration & check-in (partly done)

- Event model: name, format, game, round count, capacity, entry fee.
- ✅ **Player registration flow — self-serve, organizer-admitted.** Participants
  sign up from the public page (name, optional email, optional deck) with no
  account; submissions land in a `registrations` table and the organizer admits
  them onto the roster. See the README for the full rationale. Key decisions:
  - Registrations get their own table rather than appending into
    `events.state`, which is written by whole-blob replacement (concurrent
    writers would clobber each other) and can't be write-restricted per-key by
    RLS (anon `update` there would let a participant wipe a live event).
  - Emails stay out of the event blob, which is world-readable.
  - The registration window and `status='pending'` are enforced in RLS, not
    just the UI.
  - **Participant self-edit was considered and dropped.** With no participant
    identity the only mechanism is a bearer token in `localStorage`, which is
    lost on a cleared browser or a second device — so it can't replace "ask the
    organizer" anyway, and the organizer already has deck editing. Duplicate
    sign-ups are likewise deliberately *bounded* (unique email index +
    localStorage flag + a visible pending queue) rather than *prevented*:
    prevention needs identity, and at a local store the real gate is showing up
    and paying the entry fee.
  - Also folded in: an event is no longer auto-created on page load (that was an
    organizer-only write, so a participant arriving with no event running hit a
    raw RLS error). Creation is now an explicit **Start an event** button.
- Check-in: roster confirmed present before round 1 pairs; drop/no-show
  handling mid-event (the engine already supports `player.dropped`).
- Decklist submission if the format requires it (optional per event).
- Not built, worth revisiting if sign-up volume ever justifies it: a capacity
  cap on registrations, and organizer-visible archive of rejected sign-ups.

### Phase 2 — Persistence ✅ (done)

- **Supabase** (Postgres) as the backend; the Vite SPA talks to it directly
  via `@supabase/supabase-js` (client in `src/lib/supabase.ts`, data access in
  `src/lib/eventStore.ts`). Schema in `supabase/schema.sql`.
- One `events` table; each event stored as a single JSONB `state` blob
  (players, matches, round, brackets, …). Active event auto-loads on startup
  (created if none), debounced auto-save on every change → survives refresh.
- Event naming; "New event" archives the current event (`status = 'archived'`)
  and starts a fresh one. Read-only "Past events" view lists archives with
  their final standings.
- **Auth: open for now** — permissive RLS, no login. Anyone with the URL can
  edit. Add real auth before promoting the app widely (ties into Phase 3
  "who can report results").

TODO / follow-ups for Phase 2:

- [ ] **Archive view for elimination events.** The "Past events" detail shows
      Swiss _standings_, which is meaningless for Single/Double Elim events (their
      result lives in the bracket, not match points — an archived elim event shows
      everyone at 0). Show the final bracket / champion for elim-format archives.
- [ ] Consider formalizing "an event has one chosen format" instead of the
      free tab-switch, so archives are unambiguous.
- [ ] Last-write-wins only; no multi-device conflict handling (fine for a
      single organizer — revisit if Phase 3 adds concurrent editors).

### Phase 3 — Admin auth & view-only participants (current)

Right now the running event shares state across every device with no
distinction between roles — anyone with the URL can report results, start
rounds, edit the roster, etc. Phase 3 splits this into two layers:

- **Organizer (admin):** signs in, can do everything (roster, rounds,
  reporting, archiving).
- **Everyone else (participant):** no login, sees the same live event
  read-only — roster, current pairings, standings, brackets — but every
  write control is hidden/disabled.
- **Auth:** Supabase Auth, **email + password**, **one shared admin account**.
  Public sign-ups disabled in the Supabase dashboard and exactly one user
  (the organizer's email + a password) created manually, so "authenticated"
  and "the organizer" are the same thing — no admin table needed. (Originally
  tried magic link, but Supabase's free-tier auth-email rate limit — 2 emails/
  hour — made it impractical; password auth sends no email at sign-in, so the
  limit doesn't apply, and there's no redirect-URL config needed either.)
- Sign-in is a small popup (email + password + submit) opened from an
  "Organizer sign in" button in the header; `src/components/AdminLogin.tsx`.
- **Enforcement is in Postgres RLS**, not just the UI: `select` stays open
  to everyone; `insert`/`update`/`delete` require `auth.role() =
'authenticated'`. A determined participant poking the API directly still
  can't write.

### Phase 4 — Live/shared views — dropped

Not building this. Matches take 10–30 min each, so players only need to
check standings/pairings after their own match finishes — manual refresh
on Phase 3's read-only participant view is enough. Revisit only if event
sizes/formats change this assumption (e.g. very fast rounds).

### Phase 5 — Polish (next)

- Tiebreaker display detail — show the breakdown, not just the number,
  so a player can see _why_ they placed where they did.

(Print/export of pairings and standings was considered and dropped — not
needed.)

## Immediate next steps for this session

1. `npm install`, `npm run test`, `npm run dev` — confirm still green
   after pulling this into your own environment.
2. Decide Phase 2's persistence approach before building Phase 1 UI on
   top of it — registration/check-in state needs somewhere to live.
3. Open questions to resolve before Phase 1: single event at a time, or
   multi-event dashboard? Does registration need payment (ties back to
   the auction/inventory side of the platform), or is that out of scope
   for v1?

## Git workflow

Repo is initialized with an initial commit containing everything above.
Suggested from here: feature branches per phase (`feature/registration`,
`feature/persistence`, ...), conventional commits, PR back to `main` per
phase rather than one long-running branch.
