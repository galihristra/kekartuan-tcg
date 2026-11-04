import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createEvent,
  listActiveEvents,
  matchFormatOf,
} from '../lib/eventStore';
import type {
  ArchivedEventSummary,
  MatchFormat,
  Mode,
} from '../lib/eventStore';

const MODE_OPTIONS: [Mode, string][] = [
  ['swiss', 'Swiss'],
  ['league', 'League'],
  // ['single', 'Single Elim'],
  // ['double', 'Double Elim'],
];

function modeLabel(mode: Mode): string {
  return MODE_OPTIONS.find(([m]) => m === mode)?.[1] ?? mode;
}

const MATCH_FORMAT_OPTIONS: [MatchFormat, string][] = [
  ['bo1', 'Bo1'],
  ['bo3', 'Bo3'],
];

function progressLabel(ev: ArchivedEventSummary): string {
  const { mode, round, eventFinished } = ev.state;
  const format =
    mode === 'swiss'
      ? `${modeLabel(mode)} ${matchFormatOf(ev.state) === 'bo1' ? 'Bo1' : 'Bo3'}`
      : modeLabel(mode);
  if (eventFinished) return `${format} · finished`;
  if (round === 0) return `${format} · not started`;
  return `${format} · round ${round}`;
}

interface EventsDashboardPageProps {
  isAdmin: boolean;
}

/** The organizer's list of everything currently running, and where new events
 *  are started. Several events can be active at once. */
export default function EventsDashboardPage({
  isAdmin,
}: EventsDashboardPageProps) {
  const [active, setActive] = useState<ArchivedEventSummary[]>([]);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode>('swiss');
  // Most of the store's Swiss events are played Best of 1.
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('bo1');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Participants reach their event by link, so there's nothing to list for
    // them — and no reason to expose every running event to anyone who visits.
    if (!isAdmin) return;
    listActiveEvents()
      .then(setActive)
      .catch((e) => console.error('Failed to list active events', e));
  }, [isAdmin]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const rec = await createEvent({ name, mode, matchFormat });
      navigate(`/event/${rec.slug}`);
    } catch (e) {
      console.error('Failed to start event', e);
      setCreateError("Couldn't start an event. Try again.");
      setCreating(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="tk-panel">
        <div className="tk-empty tk-empty--spaced">
          Ask the organizer for your event's link.
          <br />
          <Link className="tk-btn ghost tk-reseed" to="/past-events">
            Browse past events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="tk-panel">
      <div className="tk-roundbar">
        <div className="tk-roundlabel">Events</div>
        <Link className="tk-btn ghost" to="/past-events">
          Past events
        </Link>
      </div>

      {active.length === 0 ? (
        <div className="tk-empty tk-empty--spaced">
          No events running right now.
        </div>
      ) : (
        <div className="tk-archive-list">
          {active.map((ev) => (
            <Link
              className="tk-archive-item"
              key={ev.id}
              to={`/event/${ev.slug}`}
            >
              <div className="tk-archive-name">{ev.name}</div>
              <div className="tk-archive-meta">
                {ev.state.players.length} players · {progressLabel(ev)}
                {ev.location ? ` · ${ev.location}` : ''}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="tk-create-event">
        <h3 className="tk-section-title">Start a new event</h3>
        <div className="tk-add">
          <input
            placeholder="Event name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            aria-label="Format"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
          >
            {MODE_OPTIONS.map(([m, label]) => (
              <option key={m} value={m}>
                {label}
              </option>
            ))}
          </select>
          {mode === 'swiss' && (
            <select
              aria-label="Match format"
              value={matchFormat}
              onChange={(e) => setMatchFormat(e.target.value as MatchFormat)}
            >
              {MATCH_FORMAT_OPTIONS.map(([f, label]) => (
                <option key={f} value={f}>
                  {label}
                </option>
              ))}
            </select>
          )}
          <button
            className="tk-btn"
            disabled={creating}
            onClick={() => void handleCreate()}
          >
            {creating ? 'Starting…' : 'Create'}
          </button>
        </div>
        <p className="tk-hint">
          The format is fixed once players are added, so pick it now.
        </p>
        {createError && <p className="tk-error tk-hint">{createError}</p>}
      </div>
    </div>
  );
}
