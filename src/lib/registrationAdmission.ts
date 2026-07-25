import type { Player } from '../engine/tournament';
import type { Registration } from './eventStore';

// Type-only imports above, so this module stays free of the Supabase client and
// can be unit-tested without env vars.

/** Registrations that aren't on the roster yet.
 *
 *  Admission is two writes (roster blob, then registration statuses); if the
 *  second fails the rows stay pending, so filtering by what's already admitted
 *  is what keeps a retry from adding anyone twice. */
export function unadmittedRegistrations(
  players: Player[],
  regs: Registration[],
): Registration[] {
  const admitted = new Set(
    players
      .map((p) => p.registrationId)
      .filter((id): id is string => id != null),
  );
  return regs.filter((r) => !admitted.has(r.id));
}

/** The roster with `regs` appended as players.
 *
 *  Note what is *not* carried over: `email`. Players live in the event's
 *  `state` blob, which is world-readable (see `public_read` in schema.sql), so
 *  contact details must stay in the registrations table. */
export function admitIntoRoster(
  players: Player[],
  regs: Registration[],
  newId: () => string,
): Player[] {
  return [
    ...players,
    ...regs.map((r, i) => ({
      id: newId(),
      name: r.name.trim(),
      seed: players.length + i + 1,
      ...(r.deckPokemon1 ? { deckPokemon1: r.deckPokemon1 } : {}),
      ...(r.deckPokemon2 ? { deckPokemon2: r.deckPokemon2 } : {}),
      registrationId: r.id,
    })),
  ];
}
