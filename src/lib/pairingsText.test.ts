import { describe, it, expect } from 'vitest';
import type { Player, SwissMatch } from '../engine/tournament';
import { formatRoundPairings } from './pairingsText';

const players: Record<string, Player> = {
  a: { id: 'a', name: 'John' },
  b: { id: 'b', name: 'Doe' },
  c: { id: 'c', name: 'Ralph' },
  d: { id: 'd', name: 'David' },
  e: { id: 'e', name: 'Leo' },
};

describe('formatRoundPairings', () => {
  it('lists the round header and one pairing per line', () => {
    const matches: SwissMatch[] = [
      { p1Id: 'a', p2Id: 'b', round: 1 },
      { p1Id: 'c', p2Id: 'd', round: 1 },
    ];
    expect(formatRoundPairings(1, matches, players)).toBe(
      'ROUND 1\nJohn VS Doe\nRalph VS David',
    );
  });

  it('leaves out other rounds', () => {
    const matches: SwissMatch[] = [
      { p1Id: 'a', p2Id: 'b', round: 1, result: 'p1' },
      { p1Id: 'a', p2Id: 'c', round: 2 },
    ];
    expect(formatRoundPairings(2, matches, players)).toBe(
      'ROUND 2\nJohn VS Ralph',
    );
  });

  it('puts byes last and names them', () => {
    const matches: SwissMatch[] = [
      { p1Id: 'e', round: 3, isBye: true },
      { p1Id: 'a', p2Id: 'b', round: 3 },
    ];
    expect(formatRoundPairings(3, matches, players)).toBe(
      'ROUND 3\nJohn VS Doe\nLeo VS BYE',
    );
  });

  it('falls back to a placeholder for a player off the roster', () => {
    const matches: SwissMatch[] = [{ p1Id: 'a', p2Id: 'gone', round: 1 }];
    expect(formatRoundPairings(1, matches, players)).toBe(
      'ROUND 1\nJohn VS ???',
    );
  });

  it('is just the header when the round has no matches', () => {
    expect(formatRoundPairings(1, [], players)).toBe('ROUND 1');
  });
});
