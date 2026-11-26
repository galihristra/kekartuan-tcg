import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import { APP_ROLES, type AppRole } from '../lib/auth';
import {
  describeRoleError,
  listRoleGrants,
  looksLikeEmail,
  normalizeEmail,
  removeRoleGrant,
  setRoleGrant,
  type RoleGrant,
} from '../lib/roles';

interface ManageAccessModalProps {
  open: boolean;
  onClose: () => void;
  /** The signed-in admin, so the list can mark "you". */
  currentEmail: string;
}

/** Admin-only list of who may edit events. Access is granted by email, so a
 *  new organizer can be added before they've ever signed in. */
export default function ManageAccessModal({
  open,
  onClose,
  currentEmail,
}: ManageAccessModalProps) {
  const [grants, setGrants] = useState<RoleGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('organizer');
  const me = normalizeEmail(currentEmail);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setGrants(await listRoleGrants());
    } catch (e) {
      console.error('Failed to load roles', e);
      setError("Couldn't load the access list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setError(null);
      void refresh();
    }
  }, [open, refresh]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      console.error('Role change failed', e);
      setError(describeRoleError(e));
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    if (!looksLikeEmail(newEmail)) {
      setError('Enter a full email address.');
      return;
    }
    void run(async () => {
      await setRoleGrant(newEmail, newRole);
      setNewEmail('');
    });
  };

  const remove = (g: RoleGrant) => {
    const self = g.email === me;
    const ok = window.confirm(
      self
        ? 'Remove your own access? You will lose edit access immediately.'
        : `Remove access for ${g.email}?`,
    );
    if (ok) void run(() => removeRoleGrant(g.email));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage access"
      className="tk-access-modal"
    >
      <p className="tk-hint">
        Organizers can run and edit every event. Admins can also change this
        list. People sign in with Google using the email listed here.
      </p>

      {loading && grants.length === 0 ? (
        <p className="tk-hint">Loading…</p>
      ) : (
        <ul className="tk-access-list">
          {grants.map((g) => (
            <li key={g.email} className="tk-access-row">
              <span className="tk-access-email" title={g.email}>
                {g.email}
                {g.email === me && <span className="tk-hint"> (you)</span>}
              </span>
              <select
                className="tk-access-role"
                value={g.role}
                disabled={busy}
                aria-label={`Role for ${g.email}`}
                onChange={(e) =>
                  void run(() =>
                    setRoleGrant(g.email, e.target.value as AppRole),
                  )
                }
              >
                {APP_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r === 'admin' ? 'Admin' : 'Organizer'}
                  </option>
                ))}
              </select>
              <button
                className="tk-x"
                disabled={busy}
                onClick={() => remove(g)}
                aria-label={`Remove ${g.email}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="tk-access-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className="tk-modal-input"
          type="email"
          placeholder="name@gmail.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <select
          className="tk-access-role"
          value={newRole}
          aria-label="Role for the new email"
          onChange={(e) => setNewRole(e.target.value as AppRole)}
        >
          {APP_ROLES.map((r) => (
            <option key={r} value={r}>
              {r === 'admin' ? 'Admin' : 'Organizer'}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="tk-btn"
          disabled={busy || !newEmail.trim()}
        >
          Add
        </button>
      </form>

      {error && <div className="tk-hint tk-error">{error}</div>}
    </Modal>
  );
}
