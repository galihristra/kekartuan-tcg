/**
 * Local record of "this browser already registered for event X".
 *
 * Participants have no account and no read access to the registrations table
 * (it holds everyone's email), so their own sign-up state can't be fetched back
 * from the server. This flag is what stops the common accidental double-submit
 * on refresh; it's a convenience, not a guarantee — clearing site data or
 * switching devices loses it, and the real duplicate defences are the unique
 * email index and the organizer reviewing the pending list.
 */

const KEY_PREFIX = 'tk-registered:';

function key(eventId: string): string {
  return `${KEY_PREFIX}${eventId}`;
}

export function hasRegisteredLocally(eventId: string): boolean {
  try {
    return localStorage.getItem(key(eventId)) !== null;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Losing the
    // flag just means we offer to register again.
    return false;
  }
}

export function markRegisteredLocally(eventId: string, name: string): void {
  try {
    localStorage.setItem(key(eventId), name);
  } catch {
    // Non-fatal: the registration itself already landed server-side.
  }
}

/** The name this browser registered under, for the "you're registered" note. */
export function registeredName(eventId: string): string | null {
  try {
    return localStorage.getItem(key(eventId));
  } catch {
    return null;
  }
}
