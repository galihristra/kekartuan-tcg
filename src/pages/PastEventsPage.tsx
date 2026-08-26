import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { computeStandings } from '../engine/tournament';
import { listArchivedEvents } from '../lib/eventStore';
import type { ArchivedEventSummary } from '../lib/eventStore';

/** The archive index: every finished or cancelled event, newest first. */
export default function PastEventsPage() {
  const [archived, setArchived] = useState<ArchivedEventSummary[]>([]);

  useEffect(() => {
    listArchivedEvents()
      .then(setArchived)
      .catch((e) => console.error('Failed to list events', e));
  }, []);

  return (
    <div className="tk-panel">
      <div className="tk-roundbar">
        <div className="tk-roundlabel">Past events</div>
        <Link className="tk-btn ghost" to="/">
          Back to events
        </Link>
      </div>
      {archived.length === 0 ? (
        <div className="tk-empty tk-empty--spaced">
          No archived events yet. Finish an event and start a new one, and it'll
          show up here.
        </div>
      ) : (
        <div className="tk-archive-list">
          {archived.map((ev) => {
            const st = computeStandings(ev.state.players, ev.state.matches);
            const champion = !ev.state.eventFinished
              ? 'cancelled'
              : st[0]
                ? `🏆 ${st[0].name}`
                : 'no results';
            return (
              <Link
                className="tk-archive-item"
                key={ev.id}
                to={`/event/${ev.slug}`}
              >
                <div className="tk-archive-name">{ev.name}</div>
                <div className="tk-archive-meta">
                  {ev.state.players.length} players · {champion} ·{' '}
                  {new Date(ev.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
