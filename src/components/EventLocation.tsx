import { EVENT_LOCATION_MAX_LENGTH } from '../lib/eventStore';
import { locationUrl } from '../lib/eventLocation';
import CopyButton from './CopyButton';

interface EventLocationProps {
  isAdmin: boolean;
  value: string;
  onChange: (value: string) => void;
}

/** Where the event is — a venue name or a map link, on its own line so it can
 *  be copied in one tap instead of being picked out of the description.
 *
 *  Always optional: blank is never flagged, and for everyone but the organizer
 *  an empty location renders nothing at all. */
export default function EventLocation({
  isAdmin,
  value,
  onChange,
}: EventLocationProps) {
  const url = locationUrl(value);
  const hasValue = value.trim() !== '';

  // Copy and open apply to the organizer too — they're the one sharing it.
  const actions = hasValue && (
    <div className="tk-eventlocation-actions">
      <CopyButton value={value} label="location" />
      {url && (
        <a
          className="tk-btn ghost tk-btn--sm"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open ↗
        </a>
      )}
    </div>
  );

  if (!isAdmin) {
    if (!hasValue) return null;
    return (
      <div className="tk-eventlocation-wrap">
        {/* Plain selectable text rather than a disabled input, matching how the
            name and description read for participants. */}
        <span className="tk-eventlocation-readonly">{value}</span>
        {actions}
      </div>
    );
  }

  return (
    <div className="tk-eventlocation-wrap">
      <input
        className="tk-eventlocation"
        value={value}
        aria-label="Location"
        placeholder="Location — venue or map link (optional)"
        maxLength={EVENT_LOCATION_MAX_LENGTH}
        onChange={(e) => onChange(e.target.value)}
      />
      {actions}
    </div>
  );
}
