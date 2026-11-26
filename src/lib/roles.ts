import { supabase } from './supabase';
import { isAppRole, type AppRole } from './auth';

export interface RoleGrant {
  email: string;
  role: AppRole;
  createdAt: string;
}

/** The table stores lowercase emails (a check constraint enforces it), and
 *  Google may hand back any casing. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Deliberately loose — just enough to catch a typo before the round trip.
 *  The real gate is the address Google confirms at sign-in. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/** Admin-only: RLS returns nothing to anyone else. */
export async function listRoleGrants(): Promise<RoleGrant[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('email, role, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((r) => isAppRole(r.role))
    .map((r) => ({ email: r.email, role: r.role, createdAt: r.created_at }));
}

/** Grants a role, or changes the role of an email that already has one. */
export async function setRoleGrant(
  email: string,
  role: AppRole,
): Promise<void> {
  const { error } = await supabase
    .from('user_roles')
    .upsert({ email: normalizeEmail(email), role }, { onConflict: 'email' });
  if (error) throw error;
}

export async function removeRoleGrant(email: string): Promise<void> {
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('email', normalizeEmail(email));
  if (error) throw error;
}

/** Turns a Postgres error into something an admin can act on. */
export function describeRoleError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes('At least one admin must remain')) {
    return 'At least one admin must remain.';
  }
  return "That didn't go through. Try again.";
}
