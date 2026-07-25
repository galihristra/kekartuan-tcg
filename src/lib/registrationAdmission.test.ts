import { describe, it, expect } from 'vitest';
import type { Player } from '../engine/tournament';
import type { Registration } from './eventStore';
import { DECK_ID_PATTERN, POKEMON_LIST } from './pokemon';
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

// Regression guard for the bug where the deck id check only allowed four digits,
// so picking any mega/alternate form (Mega Venusaur, 10033) failed to submit
// while looking like a network error. The DB is the enforcer, so what matters is
// that every id we can offer is one it will accept.
describe('deck ids the picker can produce are all accepted by the DB', () => {
  it('every POKEMON_LIST id matches DECK_ID_PATTERN', () => {
    const rejected = POKEMON_LIST.filter((p) => !DECK_ID_PATTERN.test(p.id));
    expect(
      rejected.map((p) => `${p.id} ${p.name}`),
      'these Pokémon would be rejected by the deck_pokemon_* check constraints',
    ).toEqual([]);
  });

  it('covers the real id range, including the 10000+ alternate forms', () => {
    const ids = POKEMON_LIST.map((p) => Number(p.id));
    // Guards the test itself: if the data ever stopped containing five-digit
    // ids, the assertion above would pass for the wrong reason.
    expect(Math.max(...ids)).toBeGreaterThan(9999);
    expect(Math.min(...ids)).toBeGreaterThanOrEqual(1);
  });

  it('still rejects values that are not dex ids', () => {
    for (const bad of ['pikachu', '', '123456', '12a', '-1', '1.5', ' 25']) {
      expect(
        DECK_ID_PATTERN.test(bad),
        `should reject ${JSON.stringify(bad)}`,
      ).toBe(false);
    }
  });
});

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
