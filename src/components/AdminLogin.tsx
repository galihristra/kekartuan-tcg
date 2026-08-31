import { useEffect, useState } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
import { signInWithPassword, signOut } from '../lib/auth';
import { Session } from '@supabase/supabase-js';

type Status = 'idle' | 'signing-in' | 'error';

interface AdminLoginProps {
  isAdmin: boolean;
  userSession: Session | null;
}

export default function AdminLogin({ isAdmin, userSession }: AdminLoginProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  // A successful sign-in flips `isAdmin` from the parent's auth listener, and
  // this component then renders the signed-in badge instead of the dialog. The
  // lock has to fall with the dialog rather than with `open`, which nothing is
  // left on screen to clear.
  const dialogOpen = open && !isAdmin;
  useScrollLock(dialogOpen);

  // Signing out again shouldn't reopen the form the sign-in left behind.
  useEffect(() => {
    if (isAdmin) setOpen(false);
  }, [isAdmin]);

  const close = () => {
    setOpen(false);
    setPassword('');
    setStatus('idle');
    setErrorMsg('');
  };

  const submit = async () => {
    if (!email.trim() || !password) return;
    setStatus('signing-in');
    try {
      await signInWithPassword(email.trim(), password);
      // isAdmin flips via the parent's auth-state listener once this resolves.
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  if (isAdmin) {
    return (
      <div className="tk-admin-badge">
        <span className="tk-hint">
          Signed in as <strong>{userSession?.user.email}</strong>
        </span>
        <button className="tk-btn ghost" onClick={() => signOut()}>
          Sign out
        </button>
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
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
                <button type="button" className="tk-btn ghost" onClick={close}>
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
          </div>
        </div>
      )}
    </>
  );
}
