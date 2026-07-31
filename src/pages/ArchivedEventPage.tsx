import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { loadEventById } from '../lib/eventStore';
import type { ArchivedEventSummary, EventDetail } from '../lib/eventStore';
import ArchivedEventDetail from '../components/ArchivedEventDetail';
import CopyButton from '../components/CopyButton';

interface ArchivedEventPageProps {
  isAdmin: boolean;
}

/** One past event at its own shareable URL: `/event/<uuid>`. */
export default function ArchivedEventPage({ isAdmin }: ArchivedEventPageProps) {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setLoading(true);
    loadEventById(eventId)
      .then((rec) => {
        if (cancelled) return;
        setEvent(rec);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('Failed to load event', e);
        setEvent(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // An optimistic deck edit hands back the updated event; a failed write hands
  // back null, meaning "re-read the server's truth".
  const handleEventChange = useCallback(
    (updated: ArchivedEventSummary | null) => {
      if (updated) {
        setEvent((cur) => (cur ? { ...cur, ...updated } : cur));
        return;
      }
      if (!eventId) return;
      loadEventById(eventId)
        .then(setEvent)
        .catch((e) => console.error('Failed to reload event', e));
    },
    [eventId],
  );

  if (loading) {
    return (
      <div className="tk-panel">
        <div className="tk-loading">Loading event…</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="tk-panel">
        <div className="tk-empty tk-empty--spaced">
          Event not found. It may have been removed, or the link is incomplete.
        </div>
        <Link className="tk-btn ghost tk-reseed" to="/past-events">
          ← All events
        </Link>
      </div>
    );
  }

  // The live event belongs on the main screen — the archive layout would label
  // an unfinished event as cancelled.
  if (event.status === 'active') return <Navigate to="/" replace />;

  return (
    <div className="tk-panel">
      <div className="tk-roundbar">
        <div className="tk-roundlabel">Past event</div>
        <div className="tk-roundbar-actions">
          <CopyButton value={window.location.href} label="link" />
          <Link className="tk-btn ghost" to="/past-events">
            ← All events
          </Link>
        </div>
      </div>
      <ArchivedEventDetail
        event={event}
        isAdmin={isAdmin}
        onEventChange={handleEventChange}
      />
    </div>
  );
}
