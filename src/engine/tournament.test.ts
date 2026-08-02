import { describe, it, expect } from 'vitest';
import {
  computeStandings,
  generateSwissPairings,
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

      // No two players should ever face each other twice.
      const seenPairs = new Set<string>();
      matches
        .filter((m) => !m.isBye)
        .forEach((m) => {
          const key = [m.p1Id, m.p2Id].sort().join('|');
          expect(seenPairs.has(key)).toBe(false);
          seenPairs.add(key);
        });
    },
  );
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
