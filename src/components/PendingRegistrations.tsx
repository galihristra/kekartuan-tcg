import { useCallback, useEffect, useState } from 'react';
import {
  listRegistrations,
  setRegistrationStatus,
  type Registration,
} from '../lib/eventStore';
import { getPokemon, pokemonSpriteUrl } from '../lib/pokemon';

interface PendingRegistrationsProps {
  eventId: string;
  /** Admits them onto the roster; resolves once both writes have landed. */
  onAdmit: (regs: Registration[]) => Promise<void>;
  /** Registration ids already on the roster, so a stale list can't offer them twice. */
  admittedIds: Set<string>;
}

/** The organizer's queue of participant self-registrations, awaiting admission.
 *  Refreshed on demand rather than live — matching the app's manual-refresh
 *  approach elsewhere. */
export default function PendingRegistrations({
  eventId,
  onAdmit,
  admittedIds,
}: PendingRegistrationsProps) {
  const [regs, setRegs] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRegs(await listRegistrations(eventId));
    } catch (e) {
      console.error('Failed to load registrations', e);
      setError("Couldn't load registrations.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      console.error('Registration action failed', e);
      setError("That didn't go through. Try again.");
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  const admit = (targets: Registration[]) => run(() => onAdmit(targets));
  const dismiss = (reg: Registration) =>
    run(() => setRegistrationStatus([reg.id], 'rejected'));

  // Anything already on the roster (e.g. a status update that failed after the
  // roster write) shouldn't be offered for admission again.
  const pending = regs.filter((r) => !admittedIds.has(r.id));

  if (loading && regs.length === 0) {
    return <p className="tk-hint tk-pending-empty">Loading registrations…</p>;
  }

  if (pending.length === 0) {
    return (
      <div className="tk-pending">
        <div className="tk-pending-head">
          <h3>Pending · 0</h3>
          <button
            className="tk-btn ghost tk-btn--sm"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        </div>
        {error ? (
          <p className="tk-error tk-hint">{error}</p>
        ) : (
          <p className="tk-hint">No new sign-ups.</p>
        )}
      </div>
    );
  }

  return (
    <div className="tk-pending">
      <div className="tk-pending-head">
        <h3>Pending · {pending.length}</h3>
        <button
          className="tk-btn ghost tk-btn--sm"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>

      {pending.map((r) => {
        const deck1 = getPokemon(r.deckPokemon1 ?? undefined);
        const deck2 = getPokemon(r.deckPokemon2 ?? undefined);
        return (
          <div className="tk-pending-row" key={r.id}>
            <div className="tk-pending-who">
              <span className="tk-pending-name" title={r.name}>
                {r.name}
              </span>
              {/* The sidebar is narrow, so both of these ellipsize — the title
                  attributes are how the organizer reads the full value. */}
              {r.email && (
                <span className="tk-hint" title={r.email}>
                  {r.email}
                </span>
              )}
            </div>
            <div className="tk-pending-decks">
              {deck1 && (
                <img
                  className="tk-deck-sprite-xs"
                  src={pokemonSpriteUrl(deck1)}
                  alt={deck1.name}
                  loading="lazy"
                />
              )}
              {deck2 && (
                <img
                  className="tk-deck-sprite-xs"
                  src={pokemonSpriteUrl(deck2)}
                  alt={deck2.name}
                  loading="lazy"
                />
              )}
            </div>
            <button
              className="tk-btn tk-btn--sm"
              disabled={busy}
              onClick={() => void admit([r])}
            >
              Admit
            </button>
            <button
              className="tk-x"
              disabled={busy}
              title={`Dismiss ${r.name}`}
              aria-label={`Dismiss ${r.name}`}
              onClick={() => void dismiss(r)}
            >
              ×
            </button>
          </div>
        );
      })}

      {pending.length > 1 && (
        <button
          className="tk-btn tk-pending-all"
          disabled={busy}
          onClick={() => void admit(pending)}
        >
          Admit all {pending.length}
        </button>
      )}
      {error && <p className="tk-error tk-hint">{error}</p>}
    </div>
  );
}
