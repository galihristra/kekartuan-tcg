import { useState } from 'react';
import { computeStandings } from '../engine/tournament';
import { saveEvent } from '../lib/eventStore';
import type { ArchivedEventSummary } from '../lib/eventStore';
import StandingsTable from './StandingsTable';
import EventPhotos from './EventPhotos';
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
      await saveEvent(
        updated.id,
        updated.name,
        updated.description,
        updated.state,
      );
    } catch (e) {
      console.error('Failed to save deck', e);
      // Ask the owner to re-read the server's truth if the write failed.
      onEventChange?.(null);
    }
  }

  const standings = computeStandings(event.state.players, event.state.matches);

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
      {event.description && (
        <p className="tk-eventdescription-readonly">{event.description}</p>
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
