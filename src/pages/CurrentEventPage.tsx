import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScrollLock } from '../hooks/useScrollLock';
import type { EventStateApi } from '../hooks/useEventState';
import { hasRegisteredLocally, registeredName } from '../lib/selfRegistration';
import EventSidebar from '../components/EventSidebar';
import SwissPanel from '../components/SwissPanel';
import LeaguePanel from '../components/LeaguePanel';
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
  const [confirming, setConfirming] = useState<'cancel' | 'delete' | null>(
    null,
  );
  const [showRegister, setShowRegister] = useState(false);
  // Which event this session just registered for. Tracked as an id rather than a
  // boolean so it doesn't carry over when the active event is replaced — a plain
  // flag would tell someone they're registered for an event they've never seen.
  const [registeredFor, setRegisteredFor] = useState<string | null>(null);
  const [editingDeckPlayerId, setEditingDeckPlayerId] = useState<string | null>(
    null,
  );
  const editingDeckPlayer = editingDeckPlayerId
    ? (ev.playerMap[editingDeckPlayerId] ?? null)
    : null;
  const navigate = useNavigate();
  useScrollLock(confirming !== null);

  /** Archiving doesn't start a replacement any more, so send the organizer to
   *  the dashboard to pick what happens next. */
  const archiveAndLeave = async () => {
    await ev.archiveThisEvent();
    navigate('/');
  };

  /** Follow the event to its new URL, so the address bar and any copy-link
   *  action reflect the slug that was just claimed. */
  const handleSlugChange = async (slug: string) => {
    const saved = await ev.updateSlug(slug);
    navigate(`/event/${saved}`, { replace: true });
    return saved;
  };

  const confirmDiscard = async () => {
    if (confirming === 'delete') await ev.deleteThisEvent();
    else await ev.archiveThisEvent();
    setConfirming(null);
    navigate('/');
  };

  const alreadyRegistered =
    registeredFor === ev.eventId || hasRegisteredLocally(ev.eventId);

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
      case 'league':
        return ev.round > 0;
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
          eventSlug={ev.eventSlug}
          onSlugChange={handleSlugChange}
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
          onDropPlayer={ev.dropPlayer}
          onAddPlayer={ev.addPlayer}
          onEditDeck={setEditingDeckPlayerId}
          rosterLocked={ev.rosterLocked}
          mode={ev.mode}
          modeLocked={ev.modeLocked}
          onModeChange={ev.setMode}
          roundsInput={ev.roundsInput}
          onRoundsInputChange={ev.setRoundsInput}
          roundsValid={ev.roundsValid}
          recommendedRounds={ev.recommendedRounds}
          round={ev.round}
          eventFinished={ev.eventFinished}
          isEmpty={ev.isEmpty}
          onCancelEventClick={() => setConfirming('cancel')}
          onDeleteEventClick={() => setConfirming('delete')}
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
              onNewEvent={archiveAndLeave}
              onReportSwiss={ev.reportSwiss}
              onSwapPlayers={ev.swapSwissPlayers}
            />
          )}

          {ev.mode === 'league' && (
            <LeaguePanel
              isAdmin={isAdmin}
              eventFinished={ev.eventFinished}
              round={ev.round}
              roundCount={ev.roundCount}
              roundComplete={ev.roundComplete}
              matches={ev.matches}
              playerMap={ev.playerMap}
              standings={ev.standings}
              playersCount={ev.players.length}
              onStartRound={ev.startRound}
              onFinishEvent={ev.finishEvent}
              onNewEvent={archiveAndLeave}
              onReportGame={ev.reportLeagueGame}
              onDraw={ev.reportLeagueDraw}
              onEditMatch={(m) =>
                ev.reportSwiss(m, { result: null, p1Games: 0, p2Games: 0 })
              }
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

      {confirming && (
        <div className="tk-modal-backdrop" onClick={() => setConfirming(null)}>
          <div className="tk-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="tk-section-title">
              {confirming === 'delete'
                ? 'Delete this event?'
                : 'Cancel this event?'}
            </h3>
            <p className="tk-hint">
              {confirming === 'delete'
                ? `"${ev.eventName || 'This event'}" never started, so it will be deleted outright along with any sign-ups. This can't be undone.`
                : `"${ev.eventName}" will move to Past events. This can't be undone.`}
            </p>
            <div className="tk-modal-actions">
              <button
                className="tk-btn ghost"
                onClick={() => setConfirming(null)}
              >
                Keep event
              </button>
              <button className="tk-btn-danger" onClick={confirmDiscard}>
                {confirming === 'delete' ? 'Delete event' : 'Cancel event'}
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
