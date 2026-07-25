import { useEffect, useMemo, useState } from 'react';
import type { Player } from '../engine/tournament';
import { EVENT_DESCRIPTION_MAX_LENGTH } from '../lib/eventStore';
import type { Mode, Registration } from '../lib/eventStore';
import { getPokemon, pokemonSpriteUrl } from '../lib/pokemon';
import PendingRegistrations from './PendingRegistrations';

interface EventSidebarProps {
  isAdmin: boolean;
  eventId: string;
  registrationOpen: boolean;
  onAdmitRegistrations: (regs: Registration[]) => Promise<void>;
  eventName: string;
  onEventNameChange: (name: string) => void;
  eventDescription: string;
  onEventDescriptionChange: (description: string) => void;
  saveLabel: string;
  players: Player[];
  onRenamePlayer: (id: string, name: string) => void;
  onRemovePlayer: (id: string) => void;
  onAddPlayer: (name: string) => void;
  onEditDeck: (id: string) => void;
  eventActive: boolean;
  rosterLocked: boolean;
  mode: Mode;
  roundsInput: string;
  onRoundsInputChange: (value: string) => void;
  roundsValid: boolean;
  recommendedRounds: number;
  round: number;
  eventFinished: boolean;
  onCancelEventClick: () => void;
}

export default function EventSidebar({
  isAdmin,
  eventId,
  registrationOpen,
  onAdmitRegistrations,
  eventName,
  onEventNameChange,
  eventDescription,
  onEventDescriptionChange,
  saveLabel,
  players,
  onRenamePlayer,
  onRemovePlayer,
  onAddPlayer,
  onEditDeck,
  eventActive,
  rosterLocked,
  mode,
  roundsInput,
  onRoundsInputChange,
  roundsValid,
  recommendedRounds,
  round,
  eventFinished,
  onCancelEventClick,
}: EventSidebarProps) {
  const [newName, setNewName] = useState('');
  // Roster collapses (mobile only, via CSS) once the event is active so live
  // pairings/standings lead. Auto-collapse the moment the event starts running.
  const [rosterOpen, setRosterOpen] = useState(!eventActive);
  useEffect(() => {
    if (eventActive) setRosterOpen(false);
  }, [eventActive]);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddPlayer(newName);
    setNewName('');
  };

  const admittedIds = useMemo(
    () =>
      new Set(
        players
          .map((p) => p.registrationId)
          .filter((id): id is string => id != null),
      ),
    [players],
  );

  return (
    <div className={`tk-panel ${!rosterOpen ? 'is-collapsed' : ''}`}>
      <input
        className="tk-eventname"
        value={eventName}
        placeholder="Event name"
        disabled={!isAdmin}
        onChange={(e) => onEventNameChange(e.target.value)}
      />
      {(isAdmin || eventDescription) && (
        <div className="tk-eventdescription-wrap">
          <textarea
            className="tk-eventdescription"
            value={eventDescription}
            placeholder="Event details — map link, start time, rules… (optional)"
            disabled={!isAdmin}
            maxLength={EVENT_DESCRIPTION_MAX_LENGTH}
            rows={3}
            onChange={(e) => onEventDescriptionChange(e.target.value)}
          />
          {isAdmin && (
            <div className="tk-eventdescription-count tk-hint">
              {eventDescription.length}/{EVENT_DESCRIPTION_MAX_LENGTH}
            </div>
          )}
        </div>
      )}
      <div className="tk-savestatus tk-hint">{saveLabel}</div>
      {isAdmin && registrationOpen && (
        <PendingRegistrations
          eventId={eventId}
          onAdmit={onAdmitRegistrations}
          admittedIds={admittedIds}
        />
      )}
      <button
        type="button"
        className="tk-roster-toggle"
        aria-expanded={rosterOpen}
        onClick={() => setRosterOpen((o) => !o)}
      >
        <h3>Participants · {players.length}</h3>
        <svg
          className={`tk-roster-caret ${rosterOpen ? 'is-open' : ''}`}
          width="18"
          height="18"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className="tk-roster-list">
        {players.map((p, i) => {
          const deck1 = getPokemon(p.deckPokemon1);
          const deck2 = getPokemon(p.deckPokemon2);
          return (
            <div className="tk-roster-row" key={p.id}>
              <span className="tk-seed">{i + 1}</span>
              {deck1 && (
                <img
                  className="tk-deck-sprite-mini"
                  src={pokemonSpriteUrl(deck1)}
                  alt={deck1.name}
                  loading="lazy"
                />
              )}
              {deck2 && (
                <img
                  className="tk-deck-sprite-mini"
                  src={pokemonSpriteUrl(deck2)}
                  alt={deck2.name}
                  loading="lazy"
                />
              )}
              {/* Long names ellipsize in the narrow sidebar, so keep the full
                  one reachable on hover. */}
              <input
                value={p.name}
                title={p.name}
                disabled={!isAdmin}
                onChange={(e) => onRenamePlayer(p.id, e.target.value)}
              />
              {isAdmin && (
                <button
                  className="tk-btn ghost tk-btn--sm"
                  onClick={() => onEditDeck(p.id)}
                >
                  Deck
                </button>
              )}
              {isAdmin && !rosterLocked && (
                <button className="tk-x" onClick={() => onRemovePlayer(p.id)}>
                  ×
                </button>
              )}
            </div>
          );
        })}
        {isAdmin && (
          <div className="tk-add">
            <input
              placeholder="Add player…"
              value={newName}
              disabled={rosterLocked}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              className="tk-btn"
              disabled={rosterLocked}
              onClick={handleAdd}
            >
              Add
            </button>
          </div>
        )}
        {isAdmin && rosterLocked && (
          <p className="tk-suggest">
            Roster is locked while the event is running.
          </p>
        )}
        {!isAdmin && (
          <p className="tk-suggest">
            View-only — sign in as organizer to manage the participants.
          </p>
        )}
        {mode === 'swiss' && (
          <div className="tk-rounds-setting">
            <label htmlFor="tk-round-count">Rounds</label>
            <input
              id="tk-round-count"
              type="number"
              min={3}
              value={roundsInput}
              disabled={!isAdmin || round > 0 || eventFinished}
              onChange={(e) => onRoundsInputChange(e.target.value)}
            />
            <span className="tk-hint">
              {roundsValid ? `suggested ${recommendedRounds}` : 'min 3 rounds'}
            </span>
          </div>
        )}
        {isAdmin && round > 0 && !eventFinished && (
          <button
            className="tk-btn ghost tk-cancel-btn"
            onClick={onCancelEventClick}
          >
            Cancel event
          </button>
        )}
      </div>
    </div>
  );
}
