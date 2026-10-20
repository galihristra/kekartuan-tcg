# Kekartuan TCG — Event System

Tournament app for the Kekartuan TCG store: event creation, participant
registration, pairings, standings and shareable results. It's a Vite + React +
TypeScript single-page app backed by Supabase, deployed on Vercel.

See [PLAN.md](./PLAN.md) for the roadmap and the architecture decisions behind
it.

## Features

- **Several events at once.** The Events page lists everything currently
  running; the organizer starts new ones from there. Each event lives at its
  own shareable URL, `/event/<slug>` (the slug is editable; older uuid links
  still resolve).
- **Formats**
  - **Swiss**, played as **Best of 3** or **Best of 1** (fixed when the event
    is created). Pairing avoids rematches, odd counts get a bye, and the
    organizer can manually swap individual players between pairings.
  - **League**: a full round-robin schedule generated up front, with each
    match recorded game by game as a Best of 3.
  - Single and double elimination brackets are implemented in the engine and
    UI, but are currently hidden from the "start an event" form.
- **Results**: a win, a **draw**, or a **double loss** (for a match that runs
  out of time). Matches score 3 / 1 / 0 points, and a bye counts as a win.
- **Standings with honest tiebreaks**, which depend on the format:

  | Format      | Ranked by                            |
  | ----------- | ------------------------------------ |
  | Swiss Bo3   | Points → OMW% → GW% → OGW%           |
  | Swiss Bo1   | Points → OMW% → OOMW%                |
  | League      | Points → game difference → GW%       |

  Players still level after that are separated by head-to-head among the tied
  group. A tie nothing can break is flagged, ranks are shared (1, 1, 3), and
  the organizer can settle it by reordering just those players.
- **Player result modal**: click a player in the standings to see their
  record, every match with its game score and the opponent's deck, and a
  "What do these mean?" glossary for the tiebreak stats.
- **Share a result as an image**: the result modal renders a branded card with
  the player's name, deck, event name and match details, which can be shared (native share sheet where
  supported), downloaded, or copied to the clipboard.
- **Deck namesakes**: each player can be tagged with up to two Pokémon
  (National Dex #1–1025 plus the official Mega Evolutions), shown as sprites
  next to their name everywhere.
- **Participant self-registration** with organizer admission (details below).
- **Event details**: optional description and location (with a copy button,
  plus an Open link when the location is a URL such as a Google Maps link), and
  the event format shown as a badge in the header.
- **Past events**: finishing an event archives it. Archived events keep their
  final standings, can still have decks and the description edited by the
  organizer, and have a photo gallery with a fullscreen lightbox.
- **Light / dark theme** toggle.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values (see below)
npm run dev
```

### Scripts

| Script                 | What it does                                      |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Start the Vite dev server                         |
| `npm run dev:host`     | Same, exposed on your LAN (to test on a phone)    |
| `npm run build`        | Typecheck, then production build to `dist/`       |
| `npm run preview`      | Serve the production build locally                |
| `npm run test`         | Run the Vitest suite once                         |
| `npm run test:watch`   | Run Vitest in watch mode                          |
| `npm run typecheck`    | `tsc --noEmit`                                    |
| `npm run lint`         | Lint with oxlint                                  |
| `npm run format`       | Format with Prettier                              |
| `npm run format:check` | Check formatting without writing                  |
| `npm run check`        | Prettier check + oxlint + `tsc -b` in one go      |

A Husky pre-commit hook runs `lint-staged`, which applies `oxlint --fix` and
Prettier to the files you're committing.

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
   SQL editor. It creates the `events`, `event_photos` and `registrations`
   tables, their RLS policies, and the public `event-photos` storage bucket.
   It's idempotent, so re-run it after pulling schema changes.

Each event is a row in `events`, with the live tournament (players, matches,
rounds, brackets) stored as a single JSONB `state` blob and auto-saved after
every change.

**Deploy (Vercel):** import the repo and set the same two env vars in the
Vercel project settings. `vercel.json` rewrites every path to `index.html` so
client-side routes like `/event/<slug>` load directly.

## Organizer sign-in (Supabase Auth)

Everyone can view events; only a signed-in organizer can edit them (start
events, manage the roster, report results, start rounds, archive or delete
events, upload photos). There's exactly **one shared admin account**, created
directly in the Supabase dashboard — there's no self-serve sign-up.

1. In the Supabase dashboard: **Authentication → Users → Add user**. Enter
   the organizer's email + a password, and check **Auto Confirm User**.
2. **Authentication → Providers → Email**: turn off **Allow new users to
   sign up**. This is what makes it a _single_ admin account — no one else
   can ever create one, regardless of the (public) publishable key being in
   the browser bundle.
3. In the app, click **Organizer sign in** (top right) and sign in with that
   email + password.

Protection is enforced in Postgres (RLS), not just hidden in the UI — see
`supabase/schema.sql`. With no event running, participants see "No events
running right now" and the organizer gets the form to start one.

## Participant self-registration

Participants sign themselves up from the event page — **Join event** → name,
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
  main.tsx                      # React root + router
  App.tsx                       # header, theme, organizer session, routes
  engine/
    tournament.ts               # pure Swiss / league / bracket logic + domain types, no React
    tournament.test.ts
  pages/
    EventsDashboardPage.tsx     # "/": running events + start-an-event form
    EventPage.tsx               # "/event/:slug": loads one event, live or archived
    CurrentEventPage.tsx        # the live event: sidebar, format panel, lifecycle actions
    PastEventsPage.tsx          # "/past-events": the archive index
  components/
    SwissPanel.tsx, LeaguePanel.tsx,
    SingleElimPanel.tsx, DoubleElimPanel.tsx   # one panel per format
    PairingTicket.tsx, LeaguePairingTicket.tsx # result reporting for one match
    StandingsTable.tsx, BracketView.tsx
    PlayerPerformanceModal.tsx  # per-player result modal + share/download/copy
    PlayerResultShareCard.tsx   # the card rendered into the shared image
    StatGlossary.tsx            # plain-language tiebreak explanations
    EventSidebar.tsx            # roster, event details, pending registrations
    ArchivedEventDetail.tsx, EventPhotos.tsx
    RegistrationModal.tsx, PendingRegistrations.tsx
    DeckSlots.tsx, DeckEditModal.tsx, DeckSprites.tsx, PokemonCombobox.tsx
    AdminLogin.tsx, ThemeToggle.tsx, FormatBadge.tsx, ...
  hooks/
    useEventState.ts            # an event's state, auto-save and actions
    useAdminSession.ts, useShareImage.ts, useTheme.ts, useScrollLock.ts
  lib/
    supabase.ts                 # Supabase client (reads env vars)
    eventStore.ts               # load / save / archive events, slugs, registrations, photos
    auth.ts                     # sign in / out, session helpers
    playerResult.ts             # result-modal stats and glossary
    shareImage.ts               # share-sheet / download / copy fallback rules
    registrationAdmission.ts    # pure registration → roster logic
    selfRegistration.ts         # localStorage "already registered" flag
    eventLocation.ts, pokemon.ts, imageCompress.ts, scrollLock.ts, ...
    *.test.ts                   # Vitest suites for the pure logic
  data/pokemon.json             # deck-namesake picker dataset (generated)
  styles/tokens.css
public/pokemon-sprites/         # deck-namesake sprites (generated)
scripts/
  fetch-pokemon-sprites.mjs     # one-off generator for the two generated assets above
supabase/
  schema.sql                    # run once; tables, RLS policies, photo bucket
```

The Pokémon dataset and sprites are committed. Only re-run
`node scripts/fetch-pokemon-sprites.mjs` if they need regenerating; the
script's header explains its sources and licences.
