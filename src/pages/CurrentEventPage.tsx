import { useState } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
import type { EventStateApi } from '../hooks/useEventState';
import EventSidebar from '../components/EventSidebar';
import SwissPanel from '../components/SwissPanel';
import SingleElimPanel from '../components/SingleElimPanel';
import DoubleElimPanel from '../components/DoubleElimPanel';
import DeckEditModal from '../components/DeckEditModal';

interface CurrentEventPageProps {
  ev: EventStateApi;
  isAdmin: boolean;
}

/** The live event: roster, pairings/brackets, and the event lifecycle actions. */
export default function CurrentEventPage({
  ev,
  isAdmin,
}: CurrentEventPageProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [editingDeckPlayerId, setEditingDeckPlayerId] = useState<string | null>(
    null,
  );
  const editingDeckPlayer = editingDeckPlayerId
    ? (ev.playerMap[editingDeckPlayerId] ?? null)
    : null;
  useScrollLock(showCancelConfirm);

  const confirmCancelEvent = async () => {
    await ev.resetEvent();
    setShowCancelConfirm(false);
  };

  // An event is "active" once it's running but not yet finished. On mobile this
  // flips the layout to lead with pairings/standings and collapses the roster.
  const eventStarted = (() => {
    switch (ev.mode) {
      case 'swiss':
        return ev.round > 0;
      case 'single':
        return ev.singleBracket != null;
      case 'double':
        return ev.doubleBracket != null;
    }
  })();
  const eventActive = !ev.eventFinished && eventStarted;

  if (ev.loading) return <div className="tk-loading">Loading event…</div>;

  if (ev.loadError) {
    return (
      <div className="tk-empty">
        Couldn't connect to the database: {ev.loadError}
        <br />
        Check the values in <b>.env.local</b> and that the <b>events</b> table
        exists (run <b>supabase/schema.sql</b>).
      </div>
    );
  }

  return (
    <>
      <div className={`tk-layout ${eventActive ? 'tk-layout--active' : ''}`}>
        <EventSidebar
          isAdmin={isAdmin}
          eventActive={eventActive}
          eventName={ev.eventName}
          onEventNameChange={ev.setEventName}
          eventDescription={ev.eventDescription}
          onEventDescriptionChange={ev.setEventDescription}
          saveLabel={ev.saveLabel}
          players={ev.players}
          onRenamePlayer={ev.renamePlayer}
          onRemovePlayer={ev.removePlayer}
          onAddPlayer={ev.addPlayer}
          onEditDeck={setEditingDeckPlayerId}
          rosterLocked={ev.rosterLocked}
          mode={ev.mode}
          roundsInput={ev.roundsInput}
          onRoundsInputChange={ev.setRoundsInput}
          roundsValid={ev.roundsValid}
          recommendedRounds={ev.recommendedRounds}
          round={ev.round}
          eventFinished={ev.eventFinished}
          onCancelEventClick={() => setShowCancelConfirm(true)}
        />

        <div>
          {ev.mode === 'swiss' && (
            <SwissPanel
              isAdmin={isAdmin}
              eventFinished={ev.eventFinished}
              round={ev.round}
              roundCount={ev.roundCount}
              roundComplete={ev.roundComplete}
              matches={ev.matches}
              playerMap={ev.playerMap}
              standings={ev.standings}
              playersCount={ev.players.length}
              roundsValid={ev.roundsValid}
              onStartRound={ev.startRound}
              onFinishEvent={ev.finishEvent}
              onNewEvent={ev.resetEvent}
              onReportSwiss={ev.reportSwiss}
            />
          )}

          {ev.mode === 'single' && (
            <SingleElimPanel
              isAdmin={isAdmin}
              playersCount={ev.players.length}
              playerMap={ev.playerMap}
              bracket={ev.singleBracket}
              onGenerate={ev.genSingle}
              onReport={ev.reportSingle}
            />
          )}

          {ev.mode === 'double' && (
            <DoubleElimPanel
              isAdmin={isAdmin}
              playersCount={ev.players.length}
              playerMap={ev.playerMap}
              bracket={ev.doubleBracket}
              onGenerate={ev.genDouble}
              onReport={ev.reportDouble}
            />
          )}
        </div>
      </div>

      {showCancelConfirm && (
        <div
          className="tk-modal-backdrop"
          onClick={() => setShowCancelConfirm(false)}
        >
          <div className="tk-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="tk-section-title">Cancel this event?</h3>
            <p className="tk-hint">
              "{ev.eventName}" will move to Past events and a new event will
              start. This can't be undone.
            </p>
            <div className="tk-modal-actions">
              <button
                className="tk-btn ghost"
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep event
              </button>
              <button className="tk-btn-danger" onClick={confirmCancelEvent}>
                Cancel event
              </button>
            </div>
          </div>
        </div>
      )}

      {editingDeckPlayer && (
        <DeckEditModal
          key={editingDeckPlayer.id}
          open
          onClose={() => setEditingDeckPlayerId(null)}
          eventName={ev.eventName}
          player={editingDeckPlayer}
          onSave={(deckPokemon1, deckPokemon2) => {
            ev.setPlayerDeck(editingDeckPlayer.id, deckPokemon1, deckPokemon2);
            setEditingDeckPlayerId(null);
          }}
        />
      )}
    </>
  );
}
