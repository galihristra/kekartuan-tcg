import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  getMyRole,
  getSession,
  onAuthStateChange,
  type AppRole,
} from '../lib/auth';

export function useAdminSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    getSession()
      .then(setSession)
      .catch((e) => console.error('Failed to get session', e));
    return onAuthStateChange(setSession);
  }, []);

  // Keyed on the user, not the session object: the hourly token refresh hands
  // back a new session for the same person and shouldn't refetch. Fetched here
  // rather than inside the auth listener, where awaiting another Supabase call
  // can deadlock the client.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      setRole(null);
      setRoleLoading(false);
      return;
    }
    let cancelled = false;
    setRoleLoading(true);
    getMyRole()
      .then((r) => {
        if (!cancelled) setRole(r);
      })
      .catch((e) => {
        console.error('Failed to load role', e);
        if (!cancelled) setRole(null);
      })
      .finally(() => {
        if (!cancelled) setRoleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    session,
    role,
    roleLoading,
    /** May manage who has access. */
    isAdmin: role === 'admin',
    /** May create and run events — admins and organizers alike. */
    canEdit: role === 'admin' || role === 'organizer',
  };
}
