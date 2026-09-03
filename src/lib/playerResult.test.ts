import { describe, it, expect } from 'vitest';
import type { OpponentBreakdown, StandingRow } from '../engine/tournament';
import { formatEventDate, resultStats, roundHistory } from './playerResult';

function opponent(
  round: number,
  overrides: Partial<OpponentBreakdown> = {},
): OpponentBreakdown {
  return {
    id: `opp-${round}`,
    round,
    result: 'W',
    gamesFor: 2,
    gamesAgainst: 1,
    mw: 0.5,
    gw: 0.5,
    ...overrides,
  };
}

function row(overrides: Partial<StandingRow> = {}): StandingRow {
  return {
    id: 'p1',
    name: 'Galih',
    points: 9,
    matchesPlayed: 3,
    wins: 3,
    draws: 0,
    losses: 0,
    mw: 1,
    gw: 0.75,
    omw: 0.5,
    ogw: 0.4,
    gameDiff: 3,
    opponents: [],
    byeRounds: [],
    ...overrides,
  };
}

describe('roundHistory', () => {
  it('merges byes back into the played rounds in round order', () => {
    const history = roundHistory(
      row({ opponents: [opponent(3), opponent(1)], byeRounds: [2] }),
    );

    expect(history.map((e) => e.round)).toEqual([1, 2, 3]);
    expect(history.map((e) => e.opponentId)).toEqual(['opp-1', null, 'opp-3']);
  });

  it('gives a bye a match win with no game score', () => {
    const [bye] = roundHistory(row({ byeRounds: [1] }));

    expect(bye.result).toBe('W');
    expect(bye.gamesFor).toBeNull();
    expect(bye.gamesAgainst).toBeNull();
    // Byes are excluded from the tiebreaker averages, so they carry no
    // opponent percentages to show.
    expect(bye.mw).toBeNull();
    expect(bye.gw).toBeNull();
  });

  it('carries a forfeit through to the round it was scored in', () => {
    const [played] = roundHistory(
      row({ opponents: [opponent(1, { result: 'L', forfeited: true })] }),
    );

    expect(played.result).toBe('L');
    expect(played.forfeited).toBe(true);
  });
});

describe('resultStats', () => {
  it('renders the tiebreakers as one-decimal percentages', () => {
    const stats = resultStats(row({ mw: 1, gw: 0.75, omw: 0.5, ogw: 0.4 }));

    expect(stats).toEqual([
      { label: 'Points', value: '9' },
      { label: 'W-D-L', value: '3-0-0' },
      { label: 'MW%', value: '100.0' },
      { label: 'GW%', value: '75.0' },
      { label: 'OMW%', value: '50.0' },
      { label: 'OGW%', value: '40.0' },
    ]);
  });
});

describe('formatEventDate', () => {
  it('formats a timestamp the way the share footer reads it', () => {
    // Built from local parts so the expectation holds in any timezone.
    const iso = new Date(2026, 8, 3, 12).toISOString();

    expect(formatEventDate(iso)).toBe('3 Sep 2026');
  });

  it('returns null rather than printing a broken date into an image', () => {
    expect(formatEventDate(undefined)).toBeNull();
    expect(formatEventDate('')).toBeNull();
    expect(formatEventDate('not a date')).toBeNull();
  });
});
