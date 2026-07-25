# Event System

Tournament pairing/bracket engine for a TCG store platform. See
[PLAN.md](./PLAN.md) for roadmap and architecture decisions.

## Getting started

```bash
npm install
npm run dev        # start dev server
npm run test       # run engine tests (vitest)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
```

## Persistence (Supabase)

Event state is persisted to Supabase (Postgres). To run the app you need a
Supabase project and two env vars.

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env.local` and fill in your **Project URL** and
   **publishable** key (Project Settings → API):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
3. Run [`supabase/schema.sql`](./supabase/schema.sql) once in the Supabase
   SQL editor to create the `events`, `event_photos` and `registrations`
   tables. It's idempotent, so re-run it after pulling schema changes.

**Deploy (Vercel):** import the repo and set the same two env vars in the
Vercel project settings.

See [PLAN.md](./PLAN.md) for the Phase 2 TODOs, including archive support for
elimination-format events.

## Organizer sign-in (Supabase Auth)

Everyone can view the current event; only a signed-in organizer can edit it
(report results, start rounds, manage the roster, archive events). There's
exactly **one shared admin account**, created directly in the Supabase
dashboard — there's no self-serve sign-up.

1. In the Supabase dashboard: **Authentication → Users → Add user**. Enter
   the organizer's email + a password, and check **Auto Confirm User**.
2. **Authentication → Providers → Email**: turn off **Allow new users to
   sign up**. This is what makes it a _single_ admin account — no one else
   can ever create one, regardless of the (public) publishable key being in
   the browser bundle.
3. In the app, click **Organizer sign in** (top right) and sign in with that
   email + password.

Protection is enforced in Postgres (RLS), not just hidden in the UI — see
`supabase/schema.sql`.

Because creating an event is an organizer write, the app no longer conjures one
on page load: with nothing running, participants see "no event running right
now" and the organizer gets a **Start an event** button.

## Participant self-registration

Participants sign themselves up from the public page — **Join event** → name,
optional email, optional deck — with no account and no login. Submissions land
in the organizer's **Pending** list in the sidebar, and only appear on the
roster once the organizer clicks **Admit** (or **Admit all**). **Dismiss**
rejects one.

Registration closes automatically when the event starts pairing, i.e. the same
moment the roster locks.

Notes on how this holds up without participant accounts:

- Sign-ups go to their own `registrations` table, **not** into `events.state`.
  That column is written by whole-blob replacement, so concurrent writers would
  overwrite each other, and no RLS policy can restrict a write to one key inside
  a blob — `anon` gets `insert` on `registrations` and no write on `events` at
  all.
- **Emails are organizer-only.** `registrations` has no `anon` select policy, and
  emails are deliberately never copied onto a player, because `events` is
  world-readable.
- The registration window (`status = 'active'`, round 0, not finished) and
  `status = 'pending'` on insert are both enforced by RLS, so a participant
  can't sign up late or admit themselves by calling the API directly.
- Duplicates: a unique index on `(event_id, lower(email))` blocks the same email
  twice, and a `localStorage` flag stops the accidental resubmit-on-refresh.
  Neither is airtight without identity — a determined person with a second email
  can still get two rows in, which is why admission is a deliberate organizer
  click. Dismissed rows are kept, not deleted, so a rejected address stays
  blocked.
- **Participants can't edit their own submission** (there's no identity to
  authorize it against). Deck changes go through the organizer, who can already
  edit any player's deck.

## Structure

```
src/
  engine/
    tournament.ts         # pure Swiss + bracket logic + domain types, no React dependency
    tournament.test.ts    # vitest suite
  components/
    PairingTicket.tsx
    StandingsTable.tsx
    BracketView.tsx
    AdminLogin.tsx              # organizer sign-in popup + signed-in badge
    DeckSlots.tsx               # two-Pokémon deck picker, shared by the two forms below
    DeckEditModal.tsx           # organizer edits a player's deck
    RegistrationModal.tsx       # participant self-sign-up form
    PendingRegistrations.tsx    # organizer's admit / dismiss queue
  lib/
    supabase.ts                 # Supabase client (reads env vars)
    eventStore.ts               # load / save / archive events, registrations, photos
    registrationAdmission.ts    # pure registration → roster logic (unit-tested)
    selfRegistration.ts         # localStorage "already registered" flag
    auth.ts                     # sign in / out, session helpers
  App.tsx                       # wires engine to UI + persistence + auth-gated editing
  styles/tokens.css
supabase/
  schema.sql                    # run once; creates events, event_photos, registrations
```
