import { useState } from 'react';
import { EVENT_SLUG_MAX_LENGTH, slugify } from '../lib/eventStore';
import CopyButton from './CopyButton';

interface EventSlugProps {
  slug: string;
  /** Resolves with the slug actually stored (normalized), or throws
   *  `DuplicateSlugError` / `InvalidSlugError`. */
  onSave: (slug: string) => Promise<string>;
}

function eventUrl(slug: string): string {
  return `${window.location.origin}/event/${slug}`;
}

/** The event's shareable URL, and the organizer's control for changing it.
 *
 *  Saved on an explicit click rather than the debounced autosave the other
 *  fields use: the slug is unique, so a save can genuinely fail, and every
 *  keystroke of a half-typed URL would otherwise claim a row. */
export default function EventSlug({ slug, onSave }: EventSlugProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = slugify(draft);
  const unchanged = normalized === slug;

  const startEditing = () => {
    setDraft(slug);
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    if (unchanged) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(normalized);
      setEditing(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't change the URL. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="tk-eventslug-wrap">
        <span className="tk-eventslug-readonly tk-hint">/event/{slug}</span>
        <div className="tk-eventslug-actions">
          <CopyButton value={eventUrl(slug)} label="link" />
          <button className="tk-btn ghost tk-btn--sm" onClick={startEditing}>
            Edit URL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tk-eventslug-wrap">
      <div className="tk-eventslug-edit">
        <span className="tk-hint">/event/</span>
        <input
          className="tk-eventslug"
          value={draft}
          aria-label="Event URL"
          autoFocus
          maxLength={EVENT_SLUG_MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      </div>
      <div className="tk-eventslug-actions">
        <button
          className="tk-btn tk-btn--sm"
          disabled={saving || normalized === ''}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          className="tk-btn ghost tk-btn--sm"
          disabled={saving}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
      {normalized !== '' && normalized !== draft && (
        <p className="tk-hint">Will be saved as /event/{normalized}</p>
      )}
      <p className="tk-hint">
        Anyone using the old link will need the new one — change this before
        sharing it around.
      </p>
      {error && <p className="tk-error tk-hint">{error}</p>}
    </div>
  );
}
