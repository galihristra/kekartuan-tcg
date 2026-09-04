import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeStandings,
  generateSwissPairings,
  generateRoundRobinSchedule,
  applyGameWin,
  dropPlayer as applyDropPlayer,
  matchesThroughRound,
  createSingleEliminationBracket,
  reportSingleEliminationResult,
  createDoubleEliminationBracket,
  reportDoubleEliminationResult,
} from '../engine/tournament';
import type {
  Player,
  SwissMatch,
  SingleEliminationBracket,
  DoubleEliminationBracket,
} from '../engine/tournament';
import {
  loadEventById,
  saveEvent,
  archiveEvent,
  deleteEvent,
  updateEventSlug,
  setRegistrationStatus,
} from '../lib/eventStore';
import type {
  Mode,
  EventState,
  EventDetail,
  Registration,
} from '../lib/eventStore';
import {
  admitIntoRoster,
  unadmittedRegistrations,
} from '../lib/registrationAdmission';

type SaveStatus = 'saved' | 'saving' | 'error';

const newPlayerId = () => `p-${Math.random().toString(36).slice(2, 9)}`;

/** Everything `useEventState` exposes — passed down to the current-event page. */
export type EventStateApi = ReturnType<typeof useEventState>;

interface EventStateOptions {
  /** Called when this event is no longer active — archived from another tab,
   *  device, or the dashboard — so the page can switch to the archive view. */
  onBecameInactive?: () => void;
}

/** Owns one event's data, persistence (load/autosave/archive), and all mutating actions.
 *
 *  Only call this with an id already known to be an active event. */
export function useEventState(eventId: string, opts?: EventStateOptions) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [mode, setMode] = useState<Mode>('swiss');

  const [matches, setMatches] = useState<SwissMatch[]>([]);
  const [round, setRound] = useState(0);
  const [roundsInput, setRoundsInput] = useState('3');
  const [eventFinished, setEventFinished] = useState(false);

  // The organizer's ordering of players nothing could separate. Empty until a
  // tie actually needs settling.
  const [standingsOrder, setStandingsOrder] = useState<string[]>([]);

  const [singleBracket, setSingleBracket] =
    useState<SingleEliminationBracket | null>(null);
  const [doubleBracket, setDoubleBracket] =
    useState<DoubleEliminationBracket | null>(null);

  const [eventSlug, setEventSlug] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  // Read-only: the organizer never edits it, it just dates the shareable
  // result image. Kept as the raw ISO string the row carries.
  const [eventCreatedAt, setEventCreatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const skipSaveRef = useRef(true);

  const applyRecord = useCallback((rec: EventDetail) => {
    setEventSlug(rec.slug);
    setEventName(rec.name);
    setEventDescription(rec.description);
    setEventLocation(rec.location);
    setEventCreatedAt(rec.created_at);
    const s = rec.state;
    setMode(s.mode);
    setPlayers(s.players);
    setMatches(s.matches);
    setRound(s.round);
    setRoundsInput(s.roundsInput);
    setEventFinished(s.eventFinished);
    setSingleBracket(s.singleBracket);
    setDoubleBracket(s.doubleBracket);
    setStandingsOrder(s.standingsOrder ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadEventById(eventId)
      .then((rec) => {
        if (cancelled) return;
        skipSaveRef.current = true;
        if (rec) applyRecord(rec);
        else setLoadError('Event not found.');
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('Failed to load event', e);
        setLoadError(e?.message ?? String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, applyRecord]);

  // This event can be archived elsewhere (another tab, another device, the
  // dashboard) while a tab sits open. Phones keep tabs alive for weeks and
  // restore them without refetching, so without this a participant keeps
  // seeing a finished event, including a stale "you're registered".
  //
  // Deliberately not polling: this fires when the tab is actually looked at,
  // which is the moment it matters and keeps the app's manual-refresh model.
  // Never re-applies the record — that would overwrite the organizer's
  // in-flight edits with an older server copy.
  const onBecameInactive = opts?.onBecameInactive;
  useEffect(() => {
    const checkStillActive = () => {
      if (document.visibilityState !== 'visible') return;
      loadEventById(eventId)
        .then((rec) => {
          if (!rec || rec.status !== 'active') onBecameInactive?.();
        })
        .catch((e) => console.error('Failed to refresh event', e));
    };
    document.addEventListener('visibilitychange', checkStillActive);
    window.addEventListener('focus', checkStillActive);
    return () => {
      document.removeEventListener('visibilitychange', checkStillActive);
      window.removeEventListener('focus', checkStillActive);
    };
  }, [eventId, onBecameInactive]);

  // Debounced auto-save whenever any persisted field changes.
  useEffect(() => {
    if (loading) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    setSaveStatus('saving');
    const state: EventState = {
      mode,
      players,
      matches,
      round,
      roundsInput,
      eventFinished,
      singleBracket,
      doubleBracket,
      standingsOrder,
    };
    const t = setTimeout(() => {
      saveEvent(eventId, {
        name: eventName,
        description: eventDescription,
        location: eventLocation,
        state,
      })
        .then(() => setSaveStatus('saved'))
        .catch((e) => {
          console.error('Save failed', e);
          setSaveStatus('error');
        });
    }, 600);
    return () => clearTimeout(t);
  }, [
    mode,
    players,
    matches,
    round,
    roundsInput,
    eventFinished,
    singleBracket,
    doubleBracket,
    standingsOrder,
    eventName,
    eventDescription,
    eventLocation,
    eventId,
    loading,
  ]);

  const playerMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players],
  );
  const recommendedRounds = Math.max(
    3,
    Math.ceil(Math.log2(Math.max(players.length, 2))),
  );
  // League's round count is derived from the generated schedule (fixed once
  // the roster locks), not an organizer-entered value like Swiss's roundsInput.
  const roundCount =
    mode === 'league'
      ? matches.length
        ? Math.max(...matches.map((m) => m.round))
        : 0
      : parseInt(roundsInput, 10);
  const roundsValid = mode === 'league' ? players.length >= 2 : roundCount >= 3;
  const rosterLocked = round > 0;
  // Changing format mid-event would reinterpret an existing schedule under
  // different rules, so it's only editable while the event is still empty.
  const modeLocked = players.length > 0 || matches.length > 0 || round > 0;
  // Nothing worth archiving yet, so this one can simply be thrown away.
  const isEmpty = players.length === 0 && matches.length === 0 && round === 0;
  // Self-registration closes as soon as the event starts pairing. Kept in step
  // with the `public_register` RLS policy in supabase/schema.sql, which enforces
  // the same window server-side.
  const registrationOpen = round === 0 && !eventFinished;

  const addPlayer = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlayers((ps) => [
      ...ps,
      { id: newPlayerId(), name: trimmed, seed: ps.length + 1 },
    ]);
  };
  const removePlayer = (id: string) =>
    setPlayers((ps) => ps.filter((p) => p.id !== id));
  const renamePlayer = (id: string, name: string) =>
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
  const setPlayerDeck = (
    id: string,
    deckPokemon1: string | null,
    deckPokemon2: string | null,
  ) =>
    setPlayers((ps) =>
      ps.map((p) =>
        p.id === id
          ? {
              ...p,
              deckPokemon1: deckPokemon1 ?? undefined,
              deckPokemon2: deckPokemon2 ?? undefined,
            }
          : p,
      ),
    );

  const roundMatches = matches.filter((m) => m.round === round);
  const roundComplete =
    round > 0 && roundMatches.every((m) => m.isBye || m.result);

  const startRound = () => {
    if (mode === 'league') {
      // The whole schedule is generated once, up front — later calls just
      // advance the round pointer over matches that already exist.
      if (round === 0) {
        const { matches: schedule } = generateRoundRobinSchedule(players);
        setMatches(schedule);
        setRound(1);
      } else {
        setRound((r) => r + 1);
      }
      return;
    }
    const nextRound = round + 1;
    const { pairings, byePlayerId } = generateSwissPairings(
      players,
      matches,
      nextRound,
    );
    const newMatches: SwissMatch[] = pairings.map((p) => ({
      ...p,
      round: nextRound,
      result: null,
      p1Games: 0,
      p2Games: 0,
    }));
    if (byePlayerId)
      newMatches.push({ isBye: true, p1Id: byePlayerId, round: nextRound });
    setMatches((m) => [...m, ...newMatches]);
    setRound(nextRound);
  };

  /** Move pending registrations onto the roster. Safe to retry: registrations
   *  already admitted are skipped, so a half-finished run can't duplicate anyone. */
  const admitRegistrations = async (regs: Registration[]) => {
    const fresh = unadmittedRegistrations(players, regs);
    if (fresh.length === 0) return;
    const nextPlayers = admitIntoRoster(players, fresh, newPlayerId);

    // Persist the roster before flipping the registrations, so a failure here
    // leaves them pending (and re-admittable) rather than admitted but lost.
    // Awaited directly instead of riding the debounced autosave for that reason.
    const state: EventState = {
      mode,
      players: nextPlayers,
      matches,
      round,
      roundsInput,
      eventFinished,
      singleBracket,
      doubleBracket,
    };
    await saveEvent(eventId, {
      name: eventName,
      description: eventDescription,
      location: eventLocation,
      state,
    });
    await setRegistrationStatus(
      fresh.map((r) => r.id),
      'admitted',
    );
    // Re-saves the identical blob once via the autosave — harmless, and simpler
    // than suppressing it.
    setPlayers(nextPlayers);
  };

  /** Claim a new URL for this event. Throws `DuplicateSlugError` /
   *  `InvalidSlugError` for the editor to show; the caller re-points the
   *  browser at the new slug on success. */
  const updateSlug = async (next: string) => {
    const saved = await updateEventSlug(eventId, next);
    setEventSlug(saved);
    return saved;
  };

  const finishEvent = () => setEventFinished(true);
  /** Move this event to the archive. The caller navigates away afterwards. */
  const archiveThisEvent = () => archiveEvent(eventId);

  /** Discard an event that never got going, so a mistyped or test event
   *  doesn't have to sit in the archive forever. */
  const deleteThisEvent = () => deleteEvent(eventId);

  const reportSwiss = (targetMatch: SwissMatch, patch: Partial<SwissMatch>) => {
    setMatches((all) =>
      all.map((m) => (m === targetMatch ? { ...m, ...patch } : m)),
    );
  };

  /** Organizer override: pull one specific player out of an undecided pairing
   *  and trade them for one specific player from another undecided pairing
   *  (e.g. to break up a rematch the auto-pairer forced), leaving everyone
   *  else's pairing untouched. */
  const swapSwissPlayers = (
    matchA: SwissMatch,
    sideA: 'p1' | 'p2',
    matchB: SwissMatch,
    sideB: 'p1' | 'p2',
  ) => {
    const playerA = sideA === 'p1' ? matchA.p1Id : matchA.p2Id;
    const playerB = sideB === 'p1' ? matchB.p1Id : matchB.p2Id;
    if (!playerA || !playerB || matchA === matchB) return;
    setMatches((all) =>
      all.map((m) => {
        if (m === matchA)
          return sideA === 'p1'
            ? { ...m, p1Id: playerB }
            : { ...m, p2Id: playerB };
        if (m === matchB)
          return sideB === 'p1'
            ? { ...m, p1Id: playerA }
            : { ...m, p2Id: playerA };
        return m;
      }),
    );
  };

  /** Records one game of a best-of-3 league match; auto-decides the match once either side reaches 2 game wins. */
  const reportLeagueGame = (match: SwissMatch, winner: 'p1' | 'p2') => {
    const patch = applyGameWin(match, winner);
    setMatches((all) => all.map((m) => (m === match ? { ...m, ...patch } : m)));
  };

  /** Records a time-limit draw. The UI only offers this at a 1-1 game score. */
  const reportLeagueDraw = (match: SwissMatch) => {
    setMatches((all) =>
      all.map((m) => (m === match ? { ...m, result: 'draw' } : m)),
    );
  };

  /** Marks a player dropped and forfeits their not-yet-decided matches (including future league rounds, which already exist as rows). */
  const dropPlayer = (playerId: string) => {
    const { players: nextPlayers, matches: nextMatches } = applyDropPlayer(
      players,
      matches,
      playerId,
    );
    setPlayers(nextPlayers);
    setMatches(nextMatches);
  };

  const standings = useMemo(
    () =>
      computeStandings(
        players,
        matchesThroughRound(matches, round),
        mode === 'league' ? 'league' : 'swiss',
        standingsOrder,
      ),
    [players, matches, mode, round, standingsOrder],
  );

  /** Moves one player past the neighbour they share a place with. Only ever
   *  called for rows the standings flagged as needing a tiebreak, and it
   *  records the whole tied group so the ordering survives a reload — a
   *  partial list would leave the rest of the group unsettled. */
  const reorderTiedPlayer = (playerId: string, direction: 'up' | 'down') => {
    const group = standings.find((r) => r.id === playerId)?.tieGroup;
    if (group == null) return;
    const tied = standings.filter((r) => r.tieGroup === group);
    const from = tied.findIndex((r) => r.id === playerId);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= tied.length) return;
    const ids = tied.map((r) => r.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    setStandingsOrder((prev) => [
      ...prev.filter((id) => !ids.includes(id)),
      ...ids,
    ]);
  };

  /** Drops the organizer's ordering, putting every tie back to shared places. */
  const clearStandingsOrder = () => setStandingsOrder([]);

  const genSingle = () =>
    setSingleBracket(createSingleEliminationBracket(players));
  const genDouble = () =>
    setDoubleBracket(createDoubleEliminationBracket(players));

  const reportSingle = useCallback((matchId: string, winnerId: string) => {
    setSingleBracket((b) =>
      b ? reportSingleEliminationResult(b, matchId, winnerId) : b,
    );
  }, []);
  const reportDouble = useCallback((matchId: string, winnerId: string) => {
    setDoubleBracket((b) =>
      b ? reportDoubleEliminationResult(b, matchId, winnerId) : b,
    );
  }, []);

  const saveLabel =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'error'
        ? 'Save failed'
        : 'All changes saved';

  return {
    // meta / persistence
    eventId,
    eventSlug,
    updateSlug,
    eventName,
    setEventName,
    eventDescription,
    setEventDescription,
    eventLocation,
    setEventLocation,
    eventCreatedAt,
    loading,
    loadError,
    saveLabel,

    // roster
    players,
    registrationOpen,
    admitRegistrations,
    addPlayer,
    removePlayer,
    renamePlayer,
    setPlayerDeck,
    dropPlayer,
    rosterLocked,
    playerMap,

    // mode + rounds
    mode,
    setMode,
    modeLocked,
    roundsInput,
    setRoundsInput,
    roundCount,
    roundsValid,
    recommendedRounds,

    // swiss
    matches,
    round,
    roundComplete,
    eventFinished,
    startRound,
    finishEvent,
    reportSwiss,
    swapSwissPlayers,
    standings,

    // league
    reportLeagueGame,
    reportLeagueDraw,
    standingsOrder,
    reorderTiedPlayer,
    clearStandingsOrder,

    // brackets
    singleBracket,
    doubleBracket,
    genSingle,
    genDouble,
    reportSingle,
    reportDouble,

    // lifecycle
    isEmpty,
    archiveThisEvent,
    deleteThisEvent,
  };
}
