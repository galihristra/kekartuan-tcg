import { useState } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
import type { EventStateApi } from '../hooks/useEventState';
import { hasRegisteredLocally, registeredName } from '../lib/selfRegistration';
import EventSidebar from '../components/EventSidebar';
import SwissPanel from '../components/SwissPanel';
import SingleElimPanel from '../components/SingleElimPanel';
import DoubleElimPanel from '../components/DoubleElimPanel';
import DeckEditModal from '../components/DeckEditModal';
import RegistrationModal from '../components/RegistrationModal';

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
  const [showRegister, setShowRegister] = useState(false);
  // Which event this session just registered for. Tracked as an id rather than a
  // boolean so it doesn't carry over when the active event is replaced — a plain
  // flag would tell someone they're registered for an event they've never seen.
  const [registeredFor, setRegisteredFor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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

  const alreadyRegistered =
    ev.eventId != null &&
    (registeredFor === ev.eventId || hasRegisteredLocally(ev.eventId));

  const handleCreateEvent = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      await ev.createEvent();
    } catch (e) {
      console.error('Failed to start event', e);
      setCreateError("Couldn't start an event. Try again.");
    } finally {
      setCreating(false);
    }
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

  // Nothing is running. Participants get told so plainly; the organizer gets the
  // button that starts the day's event (creating one is an authenticated write,
  // so it can't happen automatically on load any more).
  if (!ev.hasEvent || !ev.eventId) {
    return (
      <div className="tk-empty">
        No event running right now.
        {isAdmin ? (
          <div className="tk-noevent-actions">
            <button
              className="tk-btn"
              disabled={creating}
              onClick={() => void handleCreateEvent()}
            >
              {creating ? 'Starting…' : 'Start an event'}
            </button>
            {createError && <p className="tk-error tk-hint">{createError}</p>}
          </div>
        ) : (
          <>
            <br />
            Check back soon, or ask the organizer.
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {!isAdmin && ev.registrationOpen && (
        <div className="tk-join">
          {alreadyRegistered ? (
            <>
              <span className="tk-join-ok">
                You're registered
                {registeredName(ev.eventId)
                  ? ` as ${registeredName(ev.eventId)}`
                  : ''}{' '}
                ✓
              </span>
              <span className="tk-hint">
                The organizer will confirm you — talk to them at the event to
                change your deck.
              </span>
            </>
          ) : (
            <>
              <div className="tk-join-copy">
                <strong>Registration is open</strong>
                <span className="tk-hint">
                  Sign up for {ev.eventName} — no account needed.
                </span>
              </div>
              <button className="tk-btn" onClick={() => setShowRegister(true)}>
                Join event
              </button>
            </>
          )}
        </div>
      )}

      <div className={`tk-layout ${eventActive ? 'tk-layout--active' : ''}`}>
        <EventSidebar
          isAdmin={isAdmin}
          eventId={ev.eventId}
          registrationOpen={ev.registrationOpen}
          onAdmitRegistrations={ev.admitRegistrations}
          eventActive={eventActive}
          eventName={ev.eventName}
          onEventNameChange={ev.setEventName}
          eventLocation={ev.eventLocation}
          onEventLocationChange={ev.setEventLocation}
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
              onSwapPlayers={ev.swapSwissPlayers}
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

      {showRegister && (
        <RegistrationModal
          // Drop any half-filled form (or a previous confirmation) if the active
          // event is replaced while the modal is open.
          key={ev.eventId}
          open
          onClose={() => setShowRegister(false)}
          eventId={ev.eventId}
          eventName={ev.eventName}
          onRegistered={() => setRegisteredFor(ev.eventId)}
        />
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
