import { useEffect, useRef, useState } from 'react';
import { computeStandings, matchesThroughRound } from '../engine/tournament';
import { EVENT_DESCRIPTION_MAX_LENGTH, saveEvent } from '../lib/eventStore';
import type { ArchivedEventSummary } from '../lib/eventStore';
import StandingsTable from './StandingsTable';
import EventPhotos from './EventPhotos';
import EventLocation from './EventLocation';
import DeckEditModal from './DeckEditModal';

interface ArchivedEventDetailProps {
  event: ArchivedEventSummary;
  isAdmin: boolean;
  /** Called with the updated event after an optimistic edit, and again if the
   *  write fails and the caller should reload the server's truth (null). */
  onEventChange?: (event: ArchivedEventSummary | null) => void;
}

/** Read-only view of a finished (or cancelled) event: result, standings, photos. */
export default function ArchivedEventDetail({
  event,
  isAdmin,
  onEventChange,
}: ArchivedEventDetailProps) {
  const [editingDeckPlayerId, setEditingDeckPlayerId] = useState<string | null>(
    null,
  );

  const editingDeckPlayer =
    event.state.players.find((p) => p.id === editingDeckPlayerId) ?? null;

  // Location and description share one draft and one timer, so editing both in
  // the same burst is a single write rather than two racing ones.
  const [draft, setDraft] = useState({
    description: event.description,
    location: event.location,
  });
  const [draftSaveStatus, setDraftSaveStatus] = useState<
    'saved' | 'saving' | 'error'
  >('saved');
  const skipDraftSaveRef = useRef(true);

  // Resync the draft whenever the event prop changes — either navigating to
  // a different event, or our own save below reflecting back through it.
  useEffect(() => {
    skipDraftSaveRef.current = true;
    setDraft({ description: event.description, location: event.location });
    setDraftSaveStatus('saved');
  }, [event.id, event.description, event.location]);

  useEffect(() => {
    if (skipDraftSaveRef.current) {
      skipDraftSaveRef.current = false;
      return;
    }
    // Nothing to write. Also breaks a save loop: every save hands back a new
    // `event` object, which re-runs this effect, and if the draft had merely
    // round-tripped to its stored value (type a character, delete it) there'd
    // be no resync above to suppress the next write.
    if (
      draft.description === event.description &&
      draft.location === event.location
    ) {
      setDraftSaveStatus('saved');
      return;
    }
    setDraftSaveStatus('saving');
    const t = setTimeout(() => {
      saveEvent(event.id, { name: event.name, ...draft, state: event.state })
        .then(() => {
          setDraftSaveStatus('saved');
          onEventChange?.({ ...event, ...draft });
        })
        .catch((e) => {
          console.error('Failed to save event details', e);
          setDraftSaveStatus('error');
        });
    }, 600);
    return () => clearTimeout(t);
  }, [draft, event, onEventChange]);

  async function handleSaveDeck(
    deckPokemon1: string | null,
    deckPokemon2: string | null,
  ) {
    if (!editingDeckPlayerId) return;
    const players = event.state.players.map((p) =>
      p.id === editingDeckPlayerId
        ? {
            ...p,
            deckPokemon1: deckPokemon1 ?? undefined,
            deckPokemon2: deckPokemon2 ?? undefined,
          }
        : p,
    );
    const updated: ArchivedEventSummary = {
      ...event,
      state: { ...event.state, players },
    };
    // Optimistically reflect the change, then persist.
    onEventChange?.(updated);
    setEditingDeckPlayerId(null);
    try {
      await saveEvent(updated.id, {
        name: updated.name,
        description: updated.description,
        location: updated.location,
        state: updated.state,
      });
    } catch (e) {
      console.error('Failed to save deck', e);
      // Ask the owner to re-read the server's truth if the write failed.
      onEventChange?.(null);
    }
  }

  const standings = computeStandings(
    event.state.players,
    matchesThroughRound(event.state.matches, event.state.round),
    event.state.mode === 'league' ? 'league' : 'swiss',
  );

  return (
    <>
      {event.state.eventFinished ? (
        <div className="tk-champion">
          🏆 <b className="tk-gold">{standings[0]?.name ?? '—'}</b> —{' '}
          {event.name}
        </div>
      ) : (
        <div className="tk-champion">
          <span className="tk-error">Cancelled</span> — {event.name}
        </div>
      )}
      <EventLocation
        isAdmin={isAdmin}
        value={draft.location}
        onChange={(location) => setDraft((d) => ({ ...d, location }))}
      />
      {isAdmin ? (
        <div className="tk-eventdescription-wrap">
          <textarea
            className="tk-eventdescription"
            value={draft.description}
            placeholder="Event details — start time, prizes, rules… (optional)"
            maxLength={EVENT_DESCRIPTION_MAX_LENGTH}
            rows={3}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
            }
          />
          {/* Doubles as the save indicator for the location above. */}
          <div className="tk-eventdescription-count tk-hint">
            {draftSaveStatus === 'saving'
              ? 'Saving…'
              : draftSaveStatus === 'error'
                ? 'Save failed'
                : `${draft.description.length}/${EVENT_DESCRIPTION_MAX_LENGTH}`}
          </div>
        </div>
      ) : (
        event.description && (
          <p className="tk-eventdescription-readonly">{event.description}</p>
        )
      )}
      <h3 className="tk-section-title">
        {event.state.eventFinished
          ? 'Final Standings'
          : 'Standings at cancellation'}
      </h3>
      <StandingsTable
        rows={standings}
        playerMap={Object.fromEntries(
          event.state.players.map((p) => [p.id, p]),
        )}
        mode={event.state.mode}
        eventName={event.name}
        onEditDeck={isAdmin ? setEditingDeckPlayerId : undefined}
      />
      <h3 className="tk-section-title">Photos</h3>
      <EventPhotos eventId={event.id} isAdmin={isAdmin} />

      {editingDeckPlayer && (
        <DeckEditModal
          key={editingDeckPlayer.id}
          open
          onClose={() => setEditingDeckPlayerId(null)}
          eventName={event.name}
          player={editingDeckPlayer}
          onSave={handleSaveDeck}
        />
      )}
    </>
  );
}
