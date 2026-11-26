import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** Write access comes from `public.user_roles`, not from being signed in —
 *  anyone with a Google account can sign in. See supabase/schema.sql. */
export type AppRole = 'admin' | 'organizer';

export const APP_ROLES: readonly AppRole[] = ['admin', 'organizer'];

export function isAppRole(value: unknown): value is AppRole {
  return value === 'admin' || value === 'organizer';
}

/** Redirects to Google and back to the page the user signed in from. The
 *  return URL has to match an entry in Supabase's Redirect URLs allowlist. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  });
  if (error) throw error;
}

/** The legacy shared organizer account. Kept as a fallback for signing in
 *  without Google. */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** The signed-in user's role, or null for no access. The database's own
 *  answer (`app_role()`), so the UI can't disagree with what RLS enforces. */
export async function getMyRole(): Promise<AppRole | null> {
  const { data, error } = await supabase.rpc('app_role');
  if (error) throw error;
  return isAppRole(data) ? data : null;
}

/** Returns an unsubscribe function. */
export function onAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    callback(session),
  );
  return () => data.subscription.unsubscribe();
}
