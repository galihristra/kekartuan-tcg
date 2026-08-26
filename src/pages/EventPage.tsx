import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useEventState } from '../hooks/useEventState';
import { loadEventBySlugOrId } from '../lib/eventStore';
import type { ArchivedEventSummary, EventDetail } from '../lib/eventStore';
import ArchivedEventDetail from '../components/ArchivedEventDetail';
import CopyButton from '../components/CopyButton';
import CurrentEventPage from './CurrentEventPage';

/** One event at its own shareable URL: `/event/<slug>`, or the uuid links
 *  shared before slugs existed. */
export default function EventPage({ isAdmin }: { isAdmin: boolean }) {
  const { eventId: slugOrId } = useParams<{ eventId: string }>();
  if (!slugOrId) return <Navigate to="/" replace />;
  // Keyed so switching between two events remounts rather than carrying the
  // previous event's state into the next one.
  return (
    <EventPageInner key={slugOrId} slugOrId={slugOrId} isAdmin={isAdmin} />
  );
}

function EventPageInner({
  slugOrId,
  isAdmin,
}: {
  slugOrId: string;
  isAdmin: boolean;
}) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadEventBySlugOrId(slugOrId)
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
  }, [slugOrId, reloadNonce]);

  // An optimistic deck edit hands back the updated event; a failed write hands
  // back null, meaning "re-read the server's truth".
  const handleEventChange = useCallback(
    (updated: ArchivedEventSummary | null) => {
      if (updated) {
        setEvent((cur) => (cur ? { ...cur, ...updated } : cur));
        return;
      }
      setReloadNonce((n) => n + 1);
    },
    [],
  );

  // The live view archived this event out from under itself — re-read so the
  // page switches to the archive layout.
  const handleBecameInactive = useCallback(
    () => setReloadNonce((n) => n + 1),
    [],
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

  if (event.status === 'active') {
    return (
      <LiveEvent
        eventId={event.id}
        isAdmin={isAdmin}
        onBecameInactive={handleBecameInactive}
      />
    );
  }

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

/** Split out so `useEventState` is only ever called with an id already known
 *  to be an active event. */
function LiveEvent({
  eventId,
  isAdmin,
  onBecameInactive,
}: {
  eventId: string;
  isAdmin: boolean;
  onBecameInactive: () => void;
}) {
  const ev = useEventState(eventId, { onBecameInactive });
  return <CurrentEventPage ev={ev} isAdmin={isAdmin} />;
}
