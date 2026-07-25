import { describe, it, expect } from 'vitest';
import type { Player } from '../engine/tournament';
import type { Registration } from './eventStore';
import {
  admitIntoRoster,
  unadmittedRegistrations,
} from './registrationAdmission';

function reg(over: Partial<Registration> = {}): Registration {
  return {
    id: 'r-1',
    eventId: 'e-1',
    name: 'Ash',
    email: 'ash@example.com',
    deckPokemon1: null,
    deckPokemon2: null,
    status: 'pending',
    createdAt: '2026-07-25T00:00:00Z',
    ...over,
  };
}

let n = 0;
const newId = () => `p-${++n}`;

describe('unadmittedRegistrations', () => {
  it('keeps registrations with no player yet', () => {
    const regs = [reg({ id: 'r-1' }), reg({ id: 'r-2' })];
    expect(unadmittedRegistrations([], regs)).toEqual(regs);
  });

  it('drops registrations already on the roster', () => {
    const players: Player[] = [
      { id: 'p-1', name: 'Ash', registrationId: 'r-1' },
    ];
    const kept = unadmittedRegistrations(players, [
      reg({ id: 'r-1' }),
      reg({ id: 'r-2' }),
    ]);
    expect(kept.map((r) => r.id)).toEqual(['r-2']);
  });

  it('ignores organizer-typed players, which carry no registration id', () => {
    const players: Player[] = [{ id: 'p-1', name: 'Typed by hand' }];
    expect(unadmittedRegistrations(players, [reg()])).toHaveLength(1);
  });
});

describe('admitIntoRoster', () => {
  it('never copies email onto a player (the event blob is world-readable)', () => {
    const [player] = admitIntoRoster([], [reg()], newId);
    expect(JSON.stringify(player)).not.toContain('@');
    expect(Object.keys(player)).not.toContain('email');
  });

  it('carries name, decks and the registration id', () => {
    const [player] = admitIntoRoster(
      [],
      [reg({ name: '  Misty  ', deckPokemon1: '121', deckPokemon2: '131' })],
      newId,
    );
    expect(player).toMatchObject({
      name: 'Misty',
      deckPokemon1: '121',
      deckPokemon2: '131',
      registrationId: 'r-1',
    });
  });

  it('omits empty deck slots rather than storing nulls', () => {
    const [player] = admitIntoRoster([], [reg()], newId);
    expect('deckPokemon1' in player).toBe(false);
    expect('deckPokemon2' in player).toBe(false);
  });

  it('appends after existing players and continues the seed numbering', () => {
    const players: Player[] = [{ id: 'p-0', name: 'Brock', seed: 1 }];
    const next = admitIntoRoster(
      players,
      [reg({ id: 'r-1' }), reg({ id: 'r-2', name: 'Gary' })],
      newId,
    );
    expect(next.map((p) => p.name)).toEqual(['Brock', 'Ash', 'Gary']);
    expect(next.map((p) => p.seed)).toEqual([1, 2, 3]);
  });

  it('leaves the original roster untouched', () => {
    const players: Player[] = [{ id: 'p-0', name: 'Brock' }];
    admitIntoRoster(players, [reg()], newId);
    expect(players).toHaveLength(1);
  });

  it('admitting the same registration twice is a no-op via the filter', () => {
    const first = admitIntoRoster([], [reg()], newId);
    const retry = admitIntoRoster(
      first,
      unadmittedRegistrations(first, [reg()]),
      newId,
    );
    expect(retry).toHaveLength(1);
  });
});
