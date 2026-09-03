import { describe, it, expect, vi } from 'vitest';
import {
  computeStandings,
  generateSwissPairings,
  generateRoundRobinSchedule,
  applyGameWin,
  dropPlayer,
  matchesThroughRound,
  createSingleEliminationBracket,
  reportSingleEliminationResult,
  createDoubleEliminationBracket,
  reportDoubleEliminationResult,
} from './tournament';
import type { Player, SwissMatch } from './tournament';

function makePlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

describe('Swiss pairing', () => {
  it.each([4, 5, 6, 7, 8, 16])(
    'pairs every player exactly once per round for n=%i',
    (n) => {
      const players = makePlayers(n);
      const matches: SwissMatch[] = [];
      const rounds = Math.ceil(Math.log2(n)) + 1;
      const byeLog: Record<string, number> = {};

      for (let r = 1; r <= rounds; r++) {
        const { pairings, byePlayerId } = generateSwissPairings(
          players,
          matches,
          r,
        );
        const seen = new Set<string>();
        pairings.forEach(({ p1Id, p2Id }) => {
          expect(seen.has(p1Id)).toBe(false);
          expect(seen.has(p2Id)).toBe(false);
          seen.add(p1Id);
          seen.add(p2Id);
          const rand = Math.random();
          const result = rand < 0.45 ? 'p1' : rand < 0.9 ? 'p2' : 'draw';
          matches.push({
            p1Id,
            p2Id,
            result,
            p1Games: 2,
            p2Games: 1,
            round: r,
          });
        });
        if (byePlayerId) {
          expect(seen.has(byePlayerId)).toBe(false);
          seen.add(byePlayerId);
          matches.push({ isBye: true, p1Id: byePlayerId, round: r });
          byeLog[byePlayerId] = (byeLog[byePlayerId] || 0) + 1;
        }
        expect(seen.size).toBe(n);
      }
      expect(Object.values(byeLog).every((c) => c <= 1) || n % 2 === 0).toBe(
        true,
      );

      const standings = computeStandings(players, matches);
      expect(standings.length).toBe(n);
      // points should be non-increasing down the standings
      for (let i = 1; i < standings.length; i++) {
        expect(standings[i - 1].points).toBeGreaterThanOrEqual(
          standings[i].points,
        );
      }
    },
  );
});

describe('Swiss pairing avoids avoidable rematches', () => {
  // Regression test for the bug where the pairer forced a rematch even
  // though a valid rematch-free pairing existed for the round. With
  // players processed in order [p1..p6] (order === input order in round 1,
  // once the shuffle is neutralized below) and this history:
  //   p1-p2, p2-p4, p2-p5, p2-p6
  // a naive greedy first-fit pairs p1 with p3 immediately (the first player
  // p1 hasn't faced), which strands p2 — every other player left (p4, p5,
  // p6) is someone p2 has already played, forcing a rematch. A valid
  // rematch-free pairing does exist (p1-p4, p2-p3, p5-p6); only a
  // backtracking search finds it.
  it('backtracks out of a dead end instead of forcing a rematch', () => {
    const players = makePlayers(6);
    const forbidden: SwissMatch[] = [
      {
        p1Id: 'p1',
        p2Id: 'p2',
        round: 0,
        result: 'p1',
        p1Games: 2,
        p2Games: 0,
      },
      {
        p1Id: 'p2',
        p2Id: 'p4',
        round: 0,
        result: 'p1',
        p1Games: 2,
        p2Games: 0,
      },
      {
        p1Id: 'p2',
        p2Id: 'p5',
        round: 0,
        result: 'p1',
        p1Games: 2,
        p2Games: 0,
      },
      {
        p1Id: 'p2',
        p2Id: 'p6',
        round: 0,
        result: 'p1',
        p1Games: 2,
        p2Games: 0,
      },
    ];
    const forbiddenKeys = new Set(
      forbidden.map((m) => [m.p1Id, m.p2Id!].sort().join('|')),
    );

    // Round 1 pairs by a random shuffle of the roster; pin it to the
    // identity permutation so the pairing order is deterministic (p1..p6).
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const { pairings, byePlayerId } = generateSwissPairings(
        players,
        forbidden,
        1,
      );
      expect(byePlayerId).toBeNull();
      expect(pairings).toHaveLength(3);
      const seen = new Set<string>();
      pairings.forEach(({ p1Id, p2Id }) => {
        const key = [p1Id, p2Id].sort().join('|');
        expect(forbiddenKeys.has(key)).toBe(false);
        expect(seen.has(p1Id)).toBe(false);
        expect(seen.has(p2Id)).toBe(false);
        seen.add(p1Id);
        seen.add(p2Id);
      });
      expect(seen.size).toBe(6);
    } finally {
      randomSpy.mockRestore();
    }
  });
});

describe('Standings match history', () => {
  it('records the round and per-player outcome of every match, byes included', () => {
    const players = makePlayers(3);
    const matches: SwissMatch[] = [
      {
        p1Id: 'p1',
        p2Id: 'p2',
        round: 1,
        result: 'p1',
        p1Games: 2,
        p2Games: 0,
      },
      { p1Id: 'p3', round: 1, isBye: true },
      {
        p1Id: 'p1',
        p2Id: 'p3',
        round: 2,
        result: 'draw',
        p1Games: 1,
        p2Games: 1,
      },
      { p1Id: 'p2', round: 2, isBye: true },
    ];
    const byId = Object.fromEntries(
      computeStandings(players, matches).map((r) => [r.id, r]),
    );

    expect(
      byId.p1.opponents.map((o) => ({
        id: o.id,
        round: o.round,
        result: o.result,
      })),
    ).toEqual([
      { id: 'p2', round: 1, result: 'W' },
      { id: 'p3', round: 2, result: 'D' },
    ]);
    expect(byId.p1.byeRounds).toEqual([]);

    // The loser sees the mirrored outcome, and a bye is history without an
    // opponent (so it must not land in the tiebreaker averages).
    expect(byId.p2.opponents.map((o) => o.result)).toEqual(['L']);
    expect(byId.p2.byeRounds).toEqual([2]);
    expect(byId.p3.byeRounds).toEqual([1]);
    expect(byId.p3.opponents.map((o) => o.id)).toEqual(['p1']);
  });

  it('carries each match game score into the opponent breakdown', () => {
    const players = makePlayers(2);
    const matches: SwissMatch[] = [
      {
        p1Id: 'p1',
        p2Id: 'p2',
        round: 1,
        result: 'p2',
        p1Games: 1,
        p2Games: 2,
      },
    ];
    const byId = Object.fromEntries(
      computeStandings(players, matches, 'league').map((r) => [r.id, r]),
    );

    // Each side sees the score from its own point of view.
    expect(byId.p1.opponents).toMatchObject([
      { result: 'L', gamesFor: 1, gamesAgainst: 2 },
    ]);
    expect(byId.p2.opponents).toMatchObject([
      { result: 'W', gamesFor: 2, gamesAgainst: 1 },
    ]);
  });

  it('flags a forfeited match in the opponent breakdown', () => {
    const players = makePlayers(2);
    const { matches } = dropPlayer(
      players,
      [
        {
          p1Id: 'p1',
          p2Id: 'p2',
          round: 1,
          result: null,
          p1Games: 0,
          p2Games: 0,
        },
      ],
      'p2',
    );
    const byId = Object.fromEntries(
      computeStandings(players, matches, 'league').map((r) => [r.id, r]),
    );

    expect(byId.p1.opponents).toMatchObject([
      { result: 'W', gamesFor: 2, gamesAgainst: 0, forfeited: true },
    ]);
  });
});

describe('Single elimination', () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 13, 16])(
    'produces exactly one valid champion for n=%i',
    (n) => {
      const players = makePlayers(n);
      const ids = new Set(players.map((p) => p.id));
      let bracket = createSingleEliminationBracket(players);

      for (const round of bracket.rounds) {
        for (const m of round) {
          if (!m.winnerId && m.p1Id && m.p2Id) {
            bracket = reportSingleEliminationResult(
              bracket,
              m.id,
              Math.random() < 0.5 ? m.p1Id : m.p2Id,
            );
          }
        }
      }
      const final = bracket.rounds[bracket.rounds.length - 1][0];
      expect(final.winnerId).toBeTruthy();
      expect(ids.has(final.winnerId!)).toBe(true);
    },
  );
});

describe('Double elimination', () => {
  it.each([2, 4, 6, 8, 16])(
    'eliminates correctly and always produces a champion for n=%i',
    (n) => {
      const players = makePlayers(n);
      const ids = new Set(players.map((p) => p.id));
      let bracket = createDoubleEliminationBracket(players);

      function allMatches() {
        return [
          ...bracket.wbRounds.flat(),
          ...bracket.lbRounds.flatMap((r) => r.matches),
          bracket.grandFinal,
          bracket.grandFinalReset,
        ];
      }

      let safety = 0;
      while (safety++ < 200) {
        const pending = allMatches().filter(
          (m) =>
            !m.winnerId &&
            m.p1Id &&
            m.p2Id &&
            (m.id !== 'GF2' || bracket.grandFinalReset.active),
        );
        if (pending.length === 0) break;
        for (const m of pending) {
          const winner = Math.random() < 0.5 ? m.p1Id : m.p2Id;
          bracket = reportDoubleEliminationResult(bracket, m.id, winner!);
        }
      }

      const champion = bracket.grandFinalReset.active
        ? bracket.grandFinalReset.winnerId
        : bracket.grandFinal.winnerId;
      expect(champion).toBeTruthy();
      expect(ids.has(champion!)).toBe(true);

      const seatedCount = bracket.wbRounds[0].reduce(
        (sum, m) => sum + (m.p1Id ? 1 : 0) + (m.p2Id ? 1 : 0),
        0,
      );
      expect(seatedCount).toBe(n);
    },
  );
});

describe('Round-robin schedule', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'pairs every player against every other exactly once for n=%i',
    (n) => {
      const players = makePlayers(n);
      const { matches, roundCount } = generateRoundRobinSchedule(players);

      expect(roundCount).toBe(n % 2 === 0 ? n - 1 : n);

      const regular = matches.filter((m) => !m.isBye);
      const expectedPairs = new Set<string>();
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          expectedPairs.add([players[i].id, players[j].id].sort().join('|'));
        }
      }
      const actualPairs = new Set(
        regular.map((m) => [m.p1Id, m.p2Id!].sort().join('|')),
      );
      expect(actualPairs).toEqual(expectedPairs);
      expect(regular.length).toBe(expectedPairs.size);

      // No player appears twice within a round (as either side or the bye).
      const byRound = new Map<number, string[]>();
      matches.forEach((m) => {
        const ids = byRound.get(m.round) ?? [];
        ids.push(m.p1Id);
        if (m.p2Id) ids.push(m.p2Id);
        byRound.set(m.round, ids);
      });
      byRound.forEach((ids) => {
        expect(new Set(ids).size).toBe(ids.length);
      });

      if (n % 2 === 1) {
        const byeCounts: Record<string, number> = {};
        matches
          .filter((m) => m.isBye)
          .forEach((m) => {
            byeCounts[m.p1Id] = (byeCounts[m.p1Id] || 0) + 1;
          });
        players.forEach((p) => expect(byeCounts[p.id]).toBe(1));
      } else {
        expect(matches.some((m) => m.isBye)).toBe(false);
      }
    },
  );
});

describe('computeStandings league mode', () => {
  it('sorts by points, then game differential, then game win %', () => {
    // p1 beats p3 2-0, p2 beats p3 2-1 — p1 and p2 tied on points (3 each
    // from this match), p3 has 0. Tiebreak between p1/p2 is gameDiff.
    const players = makePlayers(3);
    const matches: SwissMatch[] = [
      {
        p1Id: 'p1',
        p2Id: 'p3',
        round: 1,
        result: 'p1',
        p1Games: 2,
        p2Games: 0,
      },
      {
        p1Id: 'p2',
        p2Id: 'p3',
        round: 1,
        result: 'p1',
        p1Games: 2,
        p2Games: 1,
      },
    ];
    const standings = computeStandings(players, matches, 'league');
    expect(standings[0].id).toBe('p1');
    expect(standings[1].id).toBe('p2');
    expect(standings[0].gameDiff).toBe(2);
    expect(standings[1].gameDiff).toBe(1);
    expect(standings[2].id).toBe('p3');
  });

  it('defaults to swiss ordering (omw-based) with no mode argument', () => {
    const players = makePlayers(3);
    const matches: SwissMatch[] = [
      {
        p1Id: 'p1',
        p2Id: 'p2',
        round: 1,
        result: 'p1',
        p1Games: 2,
        p2Games: 0,
      },
    ];
    const withDefault = computeStandings(players, matches);
    const withSwiss = computeStandings(players, matches, 'swiss');
    expect(withDefault.map((r) => r.id)).toEqual(withSwiss.map((r) => r.id));
  });
});

describe('applyGameWin', () => {
  it('decides the match once a side reaches 2 game wins, straight games', () => {
    const match: SwissMatch = {
      p1Id: 'p1',
      p2Id: 'p2',
      round: 1,
      result: null,
      p1Games: 0,
      p2Games: 0,
    };
    let patch = applyGameWin(match, 'p1');
    expect(patch).toEqual({ p1Games: 1, p2Games: 0, result: null });
    patch = applyGameWin({ ...match, ...patch }, 'p1');
    expect(patch).toEqual({ p1Games: 2, p2Games: 0, result: 'p1' });
  });

  it('decides the match after a decider game', () => {
    let match: SwissMatch = {
      p1Id: 'p1',
      p2Id: 'p2',
      round: 1,
      result: null,
      p1Games: 0,
      p2Games: 0,
    };
    match = { ...match, ...applyGameWin(match, 'p1') };
    match = { ...match, ...applyGameWin(match, 'p2') };
    expect(match).toMatchObject({ p1Games: 1, p2Games: 1, result: null });
    const final = applyGameWin(match, 'p2');
    expect(final).toEqual({ p1Games: 1, p2Games: 2, result: 'p2' });
  });
});

describe('dropPlayer', () => {
  it('forfeits pending current- and future-round matches, leaves the rest untouched', () => {
    const players = makePlayers(4);
    const matches: SwissMatch[] = [
      // Already decided — untouched even though it involves p1.
      {
        p1Id: 'p1',
        p2Id: 'p2',
        round: 1,
        result: 'p1',
        p1Games: 2,
        p2Games: 0,
      },
      // A bye — untouched.
      { p1Id: 'p3', round: 1, isBye: true },
      // Pending match in a future round involving the dropped player.
      {
        p1Id: 'p1',
        p2Id: 'p3',
        round: 2,
        result: null,
        p1Games: 0,
        p2Games: 0,
      },
      // Pending match not involving the dropped player — untouched.
      {
        p1Id: 'p2',
        p2Id: 'p4',
        round: 2,
        result: null,
        p1Games: 0,
        p2Games: 0,
      },
    ];
    const { players: nextPlayers, matches: nextMatches } = dropPlayer(
      players,
      matches,
      'p1',
    );

    expect(nextPlayers.find((p) => p.id === 'p1')?.dropped).toBe(true);
    expect(nextMatches[0]).toEqual(matches[0]);
    expect(nextMatches[1]).toEqual(matches[1]);
    expect(nextMatches[2]).toMatchObject({
      result: 'p2',
      p1Games: 0,
      p2Games: 2,
      forfeited: true,
    });
    expect(nextMatches[3]).toEqual(matches[3]);
  });
});

describe('matchesThroughRound', () => {
  it('drops byes scheduled for rounds not yet reached, keeps everything else', () => {
    const matches: SwissMatch[] = [
      { p1Id: 'p1', round: 1, isBye: true },
      { p1Id: 'p2', round: 2, isBye: true },
      {
        p1Id: 'p3',
        p2Id: 'p4',
        round: 1,
        result: 'p1',
        p1Games: 2,
        p2Games: 0,
      },
      {
        p1Id: 'p3',
        p2Id: 'p5',
        round: 2,
        result: null,
        p1Games: 0,
        p2Games: 0,
      },
    ];
    const visible = matchesThroughRound(matches, 1);
    expect(visible).toEqual([matches[0], matches[2], matches[3]]);
  });

  it('keeps a forfeited match regardless of round, since a drop should score immediately', () => {
    const matches: SwissMatch[] = [
      {
        p1Id: 'p1',
        p2Id: 'p2',
        round: 4,
        result: 'p2',
        p1Games: 0,
        p2Games: 2,
        forfeited: true,
      },
    ];
    expect(matchesThroughRound(matches, 1)).toEqual(matches);
  });

  // Regression test: generateRoundRobinSchedule front-loads every round's
  // matches (including future byes) the moment the league starts. Without
  // filtering through matchesThroughRound first, computeStandings counted
  // every player's bye immediately — win #1 for everyone before a single
  // game was played.
  it('prevents a round-robin schedule from crediting future byes to standings', () => {
    const players = makePlayers(5);
    const { matches } = generateRoundRobinSchedule(players);

    const round1Visible = matchesThroughRound(matches, 1);
    const standings = computeStandings(players, round1Visible, 'league');

    // Nobody has played a match yet, so only the round-1 bye recipient
    // should have any points; everyone else must be at zero.
    const withPoints = standings.filter((s) => s.points > 0);
    expect(withPoints.length).toBeLessThanOrEqual(1);
  });
});
