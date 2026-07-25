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
  loadOrCreateActiveEvent,
  saveEvent,
  archiveAndCreate,
} from '../lib/eventStore';
import type { Mode, EventState, EventRecord } from '../lib/eventStore';

type SaveStatus = 'saved' | 'saving' | 'error';

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const skipSaveRef = useRef(true);

  const applyRecord = useCallback((rec: EventRecord) => {
    setEventId(rec.id);
    setEventName(rec.name);
    setEventDescription(rec.description);
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

  // Load (or create) the active event on startup.
  useEffect(() => {
    let cancelled = false;
    loadOrCreateActiveEvent()
      .then((rec) => {
        if (cancelled) return;
        skipSaveRef.current = true;
        applyRecord(rec);
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
      saveEvent(eventId, eventName, eventDescription, state)
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

  const addPlayer = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlayers((ps) => [
      ...ps,
      {
        id: `p-${Math.random().toString(36).slice(2, 9)}`,
        name: trimmed,
        seed: ps.length + 1,
      },
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

  const finishEvent = () => setEventFinished(true);
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
    eventName,
    setEventName,
    eventDescription,
    setEventDescription,
    loading,
    loadError,
    saveLabel,

    // roster
    players,
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
    resetEvent,
  };
}
