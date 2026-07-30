import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeStandings,
  generateSwissPairings,
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
  loadActiveEvent,
  createActiveEvent,
  saveEvent,
  archiveAndCreate,
  setRegistrationStatus,
} from '../lib/eventStore';
import type {
  Mode,
  EventState,
  EventRecord,
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

/** Owns the active event's data, persistence (load/autosave/archive), and all mutating actions. */
export function useEventState() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [mode, setMode] = useState<Mode>('swiss');

  const [matches, setMatches] = useState<SwissMatch[]>([]);
  const [round, setRound] = useState(0);
  const [roundsInput, setRoundsInput] = useState('3');
  const [eventFinished, setEventFinished] = useState(false);

  const [singleBracket, setSingleBracket] =
    useState<SingleEliminationBracket | null>(null);
  const [doubleBracket, setDoubleBracket] =
    useState<DoubleEliminationBracket | null>(null);

  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const skipSaveRef = useRef(true);
  // Mirrors eventId so the refresh listener below can compare against the
  // current event without re-subscribing on every change.
  const eventIdRef = useRef<string | null>(null);

  const applyRecord = useCallback((rec: EventRecord) => {
    eventIdRef.current = rec.id;
    setEventId(rec.id);
    setEventName(rec.name);
    setEventDescription(rec.description);
    setEventLocation(rec.location);
    const s = rec.state;
    setMode(s.mode);
    setPlayers(s.players);
    setMatches(s.matches);
    setRound(s.round);
    setRoundsInput(s.roundsInput);
    setEventFinished(s.eventFinished);
    setSingleBracket(s.singleBracket);
    setDoubleBracket(s.doubleBracket);
  }, []);

  // Load the active event on startup. Read-only — an event is only ever created
  // by an explicit organizer action, so a participant can browse with no event
  // running instead of tripping over an authenticated-only insert.
  useEffect(() => {
    let cancelled = false;
    loadActiveEvent()
      .then((rec) => {
        if (cancelled) return;
        skipSaveRef.current = true;
        if (rec) applyRecord(rec);
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
  }, [applyRecord]);

  // The active event is loaded once, but it can be replaced while a tab sits
  // open — the organizer finishes or cancels an event and starts the next one.
  // Phones keep tabs alive for weeks and restore them without refetching, so
  // without this a participant keeps seeing the finished event (including a
  // stale "you're registered") and can never join its replacement.
  //
  // Deliberately not polling: this fires when the tab is actually looked at,
  // which is the moment it matters and keeps the app's manual-refresh model.
  useEffect(() => {
    const refreshIfEventChanged = () => {
      if (document.visibilityState !== 'visible') return;
      loadActiveEvent()
        .then((rec) => {
          // Only adopt a *different* event. Re-applying the current one would
          // overwrite the organizer's in-flight edits with an older server copy.
          if (!rec || rec.id === eventIdRef.current) return;
          skipSaveRef.current = true;
          applyRecord(rec);
        })
        .catch((e) => console.error('Failed to refresh active event', e));
    };
    document.addEventListener('visibilitychange', refreshIfEventChanged);
    window.addEventListener('focus', refreshIfEventChanged);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfEventChanged);
      window.removeEventListener('focus', refreshIfEventChanged);
    };
  }, [applyRecord]);

  // Debounced auto-save whenever any persisted field changes.
  useEffect(() => {
    if (loading || !eventId) return;
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
  const roundCount = parseInt(roundsInput, 10);
  const roundsValid = roundCount >= 3;
  const rosterLocked = round > 0;
  const hasEvent = eventId != null;
  // Self-registration closes as soon as the event starts pairing. Kept in step
  // with the `public_register` RLS policy in supabase/schema.sql, which enforces
  // the same window server-side.
  const registrationOpen = hasEvent && round === 0 && !eventFinished;

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
    if (!eventId) return;
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

  const finishEvent = () => setEventFinished(true);
  /** Start the first event of the day (organizer-only; RLS rejects anon). */
  const createEvent = async () => {
    const rec = await createActiveEvent();
    skipSaveRef.current = true;
    applyRecord(rec);
  };
  const resetEvent = async () => {
    if (!eventId) return;
    try {
      const rec = await archiveAndCreate(eventId);
      skipSaveRef.current = true;
      applyRecord(rec);
    } catch (e) {
      console.error('Failed to start new event', e);
    }
  };

  const reportSwiss = (targetMatch: SwissMatch, patch: Partial<SwissMatch>) => {
    setMatches((all) =>
      all.map((m) => (m === targetMatch ? { ...m, ...patch } : m)),
    );
  };

  const standings = useMemo(
    () => computeStandings(players, matches),
    [players, matches],
  );

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
    hasEvent,
    eventName,
    setEventName,
    eventDescription,
    setEventDescription,
    eventLocation,
    setEventLocation,
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
    rosterLocked,
    playerMap,

    // mode + rounds
    mode,
    setMode,
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
    standings,

    // brackets
    singleBracket,
    doubleBracket,
    genSingle,
    genDouble,
    reportSingle,
    reportDouble,

    // lifecycle
    createEvent,
    resetEvent,
  };
}
