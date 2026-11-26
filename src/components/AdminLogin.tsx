import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useScrollLock } from '../hooks/useScrollLock';
import {
  signInWithGoogle,
  signInWithPassword,
  signOut,
  type AppRole,
} from '../lib/auth';
import ManageAccessModal from './ManageAccessModal';

type Status = 'idle' | 'signing-in' | 'error';

interface AdminLoginProps {
  userSession: Session | null;
  role: AppRole | null;
  roleLoading: boolean;
}

const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Admin',
  organizer: 'Organizer',
};

export default function AdminLogin({
  userSession,
  role,
  roleLoading,
}: AdminLoginProps) {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const signedIn = !!userSession;
  // A successful sign-in swaps this component over to the signed-in badge, so
  // the lock has to fall with the dialog rather than with `open`, which nothing
  // is left on screen to clear.
  const dialogOpen = open && !signedIn;
  useScrollLock(dialogOpen);

  // Signing out again shouldn't reopen the form the sign-in left behind.
  useEffect(() => {
    if (signedIn) setOpen(false);
  }, [signedIn]);

  const close = () => {
    setOpen(false);
    setShowPassword(false);
    setPassword('');
    setStatus('idle');
    setErrorMsg('');
  };

  const fail = (e: unknown) => {
    setStatus('error');
    setErrorMsg(e instanceof Error ? e.message : String(e));
  };

  const google = async () => {
    setStatus('signing-in');
    try {
      // On success the browser leaves for Google; the session arrives when it
      // comes back, via the parent's auth listener.
      await signInWithGoogle();
    } catch (e) {
      fail(e);
    }
  };

  const submitPassword = async () => {
    if (!email.trim() || !password) return;
    setStatus('signing-in');
    try {
      await signInWithPassword(email.trim(), password);
    } catch (e) {
      fail(e);
    }
  };

  if (signedIn) {
    const who = userSession.user.email;
    return (
      <div className="tk-admin-badge">
        <span className="tk-hint">
          {roleLoading ? (
            <>
              Signed in as <strong>{who}</strong>
            </>
          ) : role ? (
            <>
              <strong>{who}</strong> · {ROLE_LABEL[role]}
            </>
          ) : (
            <>
              Signed in as <strong>{who}</strong> · no organizer access
            </>
          )}
        </span>
        {role === 'admin' && (
          <button className="tk-btn ghost" onClick={() => setManageOpen(true)}>
            Manage access
          </button>
        )}
        <button className="tk-btn ghost" onClick={() => signOut()}>
          Sign out
        </button>
        {role === 'admin' && (
          <ManageAccessModal
            open={manageOpen}
            onClose={() => setManageOpen(false)}
            currentEmail={who ?? ''}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <button className="tk-btn ghost" onClick={() => setOpen(true)}>
        Organizer sign in
      </button>
      {dialogOpen && (
        <div className="tk-modal-backdrop" onClick={close}>
          <div className="tk-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="tk-section-title">Organizer sign in</h3>
            <button
              type="button"
              className="tk-btn tk-btn--block"
              onClick={google}
              disabled={status === 'signing-in'}
            >
              {status === 'signing-in' && !showPassword
                ? 'Redirecting…'
                : 'Continue with Google'}
            </button>
            <p className="tk-hint tk-signin-note">
              Anyone can sign in, but only accounts an admin has added can edit
              events.
            </p>
            {showPassword ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitPassword();
                }}
              >
                <input
                  className="tk-modal-input"
                  type="email"
                  placeholder="Email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className="tk-modal-input"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {status === 'error' && (
                  <div className="tk-hint tk-error">{errorMsg}</div>
                )}
                <div className="tk-modal-actions">
                  <button
                    type="button"
                    className="tk-btn ghost"
                    onClick={close}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="tk-btn"
                    disabled={status === 'signing-in'}
                  >
                    {status === 'signing-in' ? 'Signing in…' : 'Sign in'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {status === 'error' && (
                  <div className="tk-hint tk-error">{errorMsg}</div>
                )}
                <div className="tk-modal-actions">
                  <button
                    type="button"
                    className="tk-btn ghost"
                    onClick={() => {
                      setShowPassword(true);
                      setStatus('idle');
                      setErrorMsg('');
                    }}
                  >
                    Use email &amp; password
                  </button>
                  <button
                    type="button"
                    className="tk-btn ghost"
                    onClick={close}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
