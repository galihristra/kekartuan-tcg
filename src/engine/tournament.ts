// ===================== Domain types =====================
export interface Player {
  id: string;
  name: string;
  seed?: number;
  dropped?: boolean;
  /** National dex id of the deck's namesake Pokémon, set by the organizer. */
  deckPokemon1?: string;
  deckPokemon2?: string;
  /** Set when this player was admitted from a self-registration; makes
   *  admitting the same registration twice a no-op. */
  registrationId?: string;
}

export type MatchResult = 'p1' | 'p2' | 'draw';

/**
 * A Swiss-round match. Regular matches carry a `p2Id` and (once played) a
 * `result` plus game counts. Byes set `isBye` and omit `p2Id`.
 */
export interface SwissMatch {
  p1Id: string;
  p2Id?: string;
  round: number;
  result?: MatchResult | null;
  p1Games?: number;
  p2Games?: number;
  isBye?: boolean;
}

/** Result of a match from one player's point of view. */
export type MatchOutcome = 'W' | 'D' | 'L';

export interface OpponentBreakdown {
  id: string;
  /** Swiss round this opponent was faced in. */
  round: number;
  /** Outcome from the perspective of the player this breakdown belongs to. */
  result: MatchOutcome;
  mw: number;
  gw: number;
}

export interface StandingRow {
  id: string;
  name: string;
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  mw: number;
  gw: number;
  omw: number;
  ogw: number;
  opponents: OpponentBreakdown[];
  /** Rounds the player sat out with a bye (counted as a win, no opponent). */
  byeRounds: number[];
}

export interface SwissPairing {
  p1Id: string;
  p2Id: string;
}

export interface SwissPairingResult {
  pairings: SwissPairing[];
  byePlayerId: string | null;
}

/** Minimal shape shared by every bracket match that can auto-advance. */
interface AdvanceableMatch {
  p1Id: string | null;
  p2Id: string | null;
  winnerId: string | null;
}

export interface ElimMatch {
  id: string;
  round: number;
  p1Id: string | null;
  p2Id: string | null;
  winnerId: string | null;
}

export interface SingleEliminationBracket {
  size: number;
  totalRounds: number;
  rounds: ElimMatch[][];
}

export interface WBMatch {
  id: string;
  round: number;
  bracket: 'WB';
  p1Id: string | null;
  p2Id: string | null;
  winnerId: string | null;
}

export interface LBMatch {
  id: string;
  round: number;
  bracket: 'LB';
  type: 'minor' | 'major';
  wbLoserRound: number | null;
  p1Id: string | null;
  p2Id: string | null;
  winnerId: string | null;
}

export interface LBRound {
  type: 'minor' | 'major';
  wbLoserRound: number | null;
  matches: LBMatch[];
}

export interface GrandFinalMatch {
  id: string;
  p1Id: string | null;
  p2Id: string | null;
  winnerId: string | null;
  active?: boolean;
}

export interface DoubleEliminationBracket {
  size: number;
  R: number;
  wbRounds: WBMatch[][];
  lbRounds: LBRound[];
  grandFinal: GrandFinalMatch;
  grandFinalReset: GrandFinalMatch & { active: boolean };
}

// ===================== Utilities =====================
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function nextPowerOfTwo(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(n, 1))));
}

// ===================== Standings (Swiss) =====================
const MATCH_POINTS = { win: 3, draw: 1, loss: 0 };
const MIN_PCT = 1 / 3;

interface PlayerStat {
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  gamesWon: number;
  gamesPlayed: number;
  opponents: { id: string; round: number; result: MatchOutcome }[];
  byeRounds: number[];
}

function computeStandings(
  players: Player[],
  matches: SwissMatch[],
): StandingRow[] {
  const stats: Record<string, PlayerStat> = {};
  players.forEach((p) => {
    stats[p.id] = {
      points: 0,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gamesWon: 0,
      gamesPlayed: 0,
      opponents: [],
      byeRounds: [],
    };
  });

  matches.forEach((m) => {
    if (m.isBye) {
      const s = stats[m.p1Id];
      if (s) {
        s.points += MATCH_POINTS.win;
        s.matchesPlayed += 1;
        s.wins += 1;
        s.byeRounds.push(m.round);
      }
      return;
    }
    const { p2Id } = m;
    if (p2Id === undefined) return;
    const s1 = stats[m.p1Id],
      s2 = stats[p2Id];
    if (!s1 || !s2 || !m.result) return;
    s1.matchesPlayed += 1;
    s2.matchesPlayed += 1;
    const outcome1: MatchOutcome =
      m.result === 'p1' ? 'W' : m.result === 'p2' ? 'L' : 'D';
    const outcome2: MatchOutcome =
      outcome1 === 'W' ? 'L' : outcome1 === 'L' ? 'W' : 'D';
    s1.opponents.push({ id: p2Id, round: m.round, result: outcome1 });
    s2.opponents.push({ id: m.p1Id, round: m.round, result: outcome2 });
    s1.gamesWon += m.p1Games || 0;
    s2.gamesWon += m.p2Games || 0;
    const totalGames = (m.p1Games || 0) + (m.p2Games || 0);
    s1.gamesPlayed += totalGames;
    s2.gamesPlayed += totalGames;
    if (m.result === 'p1') {
      s1.points += MATCH_POINTS.win;
      s1.wins += 1;
      s2.losses += 1;
    } else if (m.result === 'p2') {
      s2.points += MATCH_POINTS.win;
      s2.wins += 1;
      s1.losses += 1;
    } else {
      s1.points += MATCH_POINTS.draw;
      s2.points += MATCH_POINTS.draw;
      s1.draws += 1;
      s2.draws += 1;
    }
  });

  const mw = (id: string): number => {
    const s = stats[id];
    if (!s || s.matchesPlayed === 0) return MIN_PCT;
    return Math.max(s.points / (s.matchesPlayed * MATCH_POINTS.win), MIN_PCT);
  };
  const gw = (id: string): number => {
    const s = stats[id];
    if (!s || s.gamesPlayed === 0) return MIN_PCT;
    return Math.max(s.gamesWon / s.gamesPlayed, MIN_PCT);
  };

  const rows: StandingRow[] = players.map((p) => {
    const s = stats[p.id];
    const opp = s.opponents;
    const omw = opp.length
      ? opp.reduce((sum, o) => sum + mw(o.id), 0) / opp.length
      : MIN_PCT;
    const ogw = opp.length
      ? opp.reduce((sum, o) => sum + gw(o.id), 0) / opp.length
      : MIN_PCT;
    return {
      id: p.id,
      name: p.name,
      points: s.points,
      matchesPlayed: s.matchesPlayed,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      mw: mw(p.id),
      gw: gw(p.id),
      omw,
      ogw,
      opponents: opp.map((o) => ({
        ...o,
        mw: mw(o.id),
        gw: gw(o.id),
      })),
      byeRounds: s.byeRounds,
    };
  });

  rows.sort(
    (a, b) =>
      b.points - a.points || b.omw - a.omw || b.gw - a.gw || b.ogw - a.ogw,
  );
  return rows;
}

// ===================== Swiss pairing =====================
function hasPlayed(matches: SwissMatch[], aId: string, bId: string): boolean {
  return matches.some(
    (m) =>
      !m.isBye &&
      ((m.p1Id === aId && m.p2Id === bId) ||
        (m.p1Id === bId && m.p2Id === aId)),
  );
}
function hadBye(matches: SwissMatch[], id: string): boolean {
  return matches.some((m) => !!m.isBye && m.p1Id === id);
}

function generateSwissPairings(
  players: Player[],
  matches: SwissMatch[],
  roundNumber: number,
): SwissPairingResult {
  const active = players.filter((p) => !p.dropped);
  let order: Player[];
  if (roundNumber === 1) {
    order = shuffle(active);
  } else {
    const standings = computeStandings(active, matches);
    order = standings.map((s) => active.find((p) => p.id === s.id)!);
  }

  const pool = [...order];
  let byePlayer: Player | null = null;
  if (pool.length % 2 === 1) {
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!hadBye(matches, pool[i].id)) {
        byePlayer = pool.splice(i, 1)[0];
        break;
      }
    }
    if (!byePlayer) byePlayer = pool.pop() ?? null;
  }

  const unpaired = [...pool];
  const pairings: SwissPairing[] = [];
  while (unpaired.length > 0) {
    const p1 = unpaired.shift()!;
    let idx = unpaired.findIndex((p2) => !hasPlayed(matches, p1.id, p2.id));
    if (idx === -1) idx = 0;
    const p2 = unpaired.splice(idx, 1)[0];
    pairings.push({ p1Id: p1.id, p2Id: p2.id });
  }

  return { pairings, byePlayerId: byePlayer ? byePlayer.id : null };
}

// ===================== Single elimination =====================
function generateSeedOrder(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const s2 = seeds.length * 2;
    const next: number[] = [];
    seeds.forEach((s) => {
      next.push(s);
      next.push(s2 + 1 - s);
    });
    seeds = next;
  }
  return seeds;
}

function maybeAutoAdvance(m: AdvanceableMatch): void {
  if (m.winnerId) return;
  const a = m.p1Id,
    b = m.p2Id;
  if (a && !b) m.winnerId = a;
  else if (b && !a) m.winnerId = b;
}

function createSingleEliminationBracket(
  players: Player[],
): SingleEliminationBracket {
  const size = nextPowerOfTwo(players.length);
  const seedOrder = generateSeedOrder(size);
  const slots: (Player | null)[] = seedOrder.map(
    (seedNum) => players[seedNum - 1] || null,
  );
  const totalRounds = Math.log2(size);
  let matchId = 1;
  const rounds: ElimMatch[][] = [];

  const round1: ElimMatch[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i],
      b = slots[i + 1];
    round1.push({
      id: `m${matchId++}`,
      round: 1,
      p1Id: a ? a.id : null,
      p2Id: b ? b.id : null,
      winnerId: null,
    });
  }
  rounds.push(round1);

  for (let r = 2; r <= totalRounds; r++) {
    const count = rounds[r - 2].length / 2;
    const rm: ElimMatch[] = [];
    for (let i = 0; i < count; i++)
      rm.push({
        id: `m${matchId++}`,
        round: r,
        p1Id: null,
        p2Id: null,
        winnerId: null,
      });
    rounds.push(rm);
  }

  const bracket: SingleEliminationBracket = { size, totalRounds, rounds };
  propagateSingleElim(bracket);
  return bracket;
}

function propagateSingleElim(bracket: SingleEliminationBracket): void {
  for (let r = 0; r < bracket.rounds.length; r++) {
    bracket.rounds[r].forEach((m) => maybeAutoAdvance(m));
    if (r < bracket.rounds.length - 1) {
      bracket.rounds[r].forEach((m, i) => {
        if (m.winnerId) {
          const nm = bracket.rounds[r + 1][Math.floor(i / 2)];
          nm[i % 2 === 0 ? 'p1Id' : 'p2Id'] = m.winnerId;
        }
      });
    }
  }
}

function reportSingleEliminationResult(
  bracket: SingleEliminationBracket,
  matchId: string,
  winnerId: string,
): SingleEliminationBracket {
  for (const round of bracket.rounds) {
    const m = round.find((x) => x.id === matchId);
    if (m) {
      m.winnerId = winnerId;
      break;
    }
  }
  propagateSingleElim(bracket);
  return bracket;
}

// ===================== Double elimination =====================
function createDoubleEliminationBracket(
  players: Player[],
): DoubleEliminationBracket {
  const size = nextPowerOfTwo(players.length);
  const R = Math.log2(size);
  const seedOrder = generateSeedOrder(size);
  const slots: (Player | null)[] = seedOrder.map((s) => players[s - 1] || null);

  const wbRounds: WBMatch[][] = [];
  const round1: WBMatch[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i],
      b = slots[i + 1];
    round1.push({
      id: `WB1-${i / 2 + 1}`,
      round: 1,
      bracket: 'WB',
      p1Id: a ? a.id : null,
      p2Id: b ? b.id : null,
      winnerId: null,
    });
  }
  wbRounds.push(round1);
  for (let r = 2; r <= R; r++) {
    const count = wbRounds[r - 2].length / 2;
    const rm: WBMatch[] = [];
    for (let i = 0; i < count; i++)
      rm.push({
        id: `WB${r}-${i + 1}`,
        round: r,
        bracket: 'WB',
        p1Id: null,
        p2Id: null,
        winnerId: null,
      });
    wbRounds.push(rm);
  }

  const lbRounds: LBRound[] = [];
  let holdingSize = 0;
  for (let k = 1; k <= R; k++) {
    const LkSize = size / Math.pow(2, k);
    if (holdingSize === 0) {
      const count = LkSize / 2;
      const matches: LBMatch[] = [];
      for (let i = 0; i < count; i++)
        matches.push({
          id: `LB${lbRounds.length + 1}-${i + 1}`,
          round: lbRounds.length + 1,
          bracket: 'LB',
          type: 'minor',
          wbLoserRound: k,
          p1Id: null,
          p2Id: null,
          winnerId: null,
        });
      lbRounds.push({ type: 'minor', wbLoserRound: k, matches });
      holdingSize = count;
    } else {
      const matches: LBMatch[] = [];
      for (let i = 0; i < holdingSize; i++)
        matches.push({
          id: `LB${lbRounds.length + 1}-${i + 1}`,
          round: lbRounds.length + 1,
          bracket: 'LB',
          type: 'major',
          wbLoserRound: k,
          p1Id: null,
          p2Id: null,
          winnerId: null,
        });
      lbRounds.push({ type: 'major', wbLoserRound: k, matches });
      const winnersSize = holdingSize;
      if (k < R) {
        const count2 = winnersSize / 2;
        const matches2: LBMatch[] = [];
        for (let i = 0; i < count2; i++)
          matches2.push({
            id: `LB${lbRounds.length + 1}-${i + 1}`,
            round: lbRounds.length + 1,
            bracket: 'LB',
            type: 'minor',
            wbLoserRound: null,
            p1Id: null,
            p2Id: null,
            winnerId: null,
          });
        lbRounds.push({ type: 'minor', wbLoserRound: null, matches: matches2 });
        holdingSize = count2;
      } else {
        holdingSize = winnersSize;
      }
    }
  }

  const grandFinal: GrandFinalMatch = {
    id: 'GF',
    p1Id: null,
    p2Id: null,
    winnerId: null,
  };
  const grandFinalReset: GrandFinalMatch & { active: boolean } = {
    id: 'GF2',
    p1Id: null,
    p2Id: null,
    winnerId: null,
    active: false,
  };

  const bracket: DoubleEliminationBracket = {
    size,
    R,
    wbRounds,
    lbRounds,
    grandFinal,
    grandFinalReset,
  };
  propagateDoubleElim(bracket);
  return bracket;
}

function propagateDoubleElim(bracket: DoubleEliminationBracket): void {
  const { wbRounds, lbRounds, grandFinal, grandFinalReset } = bracket;

  const wbLosersByRound: (string | null | undefined)[][] = [];
  for (let r = 0; r < wbRounds.length; r++) {
    wbRounds[r].forEach((m) => maybeAutoAdvance(m));
    if (r < wbRounds.length - 1) {
      wbRounds[r].forEach((m, i) => {
        if (m.winnerId) {
          const nm = wbRounds[r + 1][Math.floor(i / 2)];
          nm[i % 2 === 0 ? 'p1Id' : 'p2Id'] = m.winnerId;
        }
      });
    }
    wbLosersByRound.push(
      wbRounds[r].map((m) => {
        if (!m.winnerId) return undefined;
        if (!m.p1Id || !m.p2Id) return null;
        return m.winnerId === m.p1Id ? m.p2Id : m.p1Id;
      }),
    );
  }

  let holding: (string | null)[] | null = null;
  let lbIdx = 0;
  for (let k = 1; k <= wbRounds.length; k++) {
    const Lk = wbLosersByRound[k - 1];
    if (holding === null) {
      const round = lbRounds[lbIdx];
      lbIdx++;
      round.matches.forEach((m, i) => {
        const a = Lk[2 * i],
          b = Lk[2 * i + 1];
        if (a !== undefined) m.p1Id = a;
        if (b !== undefined) m.p2Id = b;
        maybeAutoAdvance(m);
      });
      holding = round.matches.map((m) => m.winnerId || null);
    } else {
      const round = lbRounds[lbIdx];
      lbIdx++;
      round.matches.forEach((m, i) => {
        const a = holding![i],
          b = Lk[i];
        if (a !== undefined && a !== null) m.p1Id = a;
        if (b !== undefined) m.p2Id = b;
        maybeAutoAdvance(m);
      });
      const winners = round.matches.map((m) => m.winnerId || null);
      if (k < wbRounds.length) {
        const round2 = lbRounds[lbIdx];
        lbIdx++;
        round2.matches.forEach((m, i) => {
          const a = winners[2 * i],
            b = winners[2 * i + 1];
          if (a) m.p1Id = a;
          if (b) m.p2Id = b;
          maybeAutoAdvance(m);
        });
        holding = round2.matches.map((m) => m.winnerId || null);
      } else {
        holding = winners;
      }
    }
  }

  const wbChampion = wbRounds[wbRounds.length - 1][0]?.winnerId || null;
  const lbChampion = holding ? holding[0] : null;
  if (wbChampion) grandFinal.p1Id = wbChampion;
  if (lbChampion) grandFinal.p2Id = lbChampion;
  maybeAutoAdvance(grandFinal);

  if (
    grandFinal.winnerId &&
    grandFinal.winnerId === grandFinal.p2Id &&
    grandFinal.p1Id &&
    grandFinal.p1Id !== grandFinal.p2Id
  ) {
    grandFinalReset.active = true;
    grandFinalReset.p1Id = grandFinal.p1Id;
    grandFinalReset.p2Id = grandFinal.p2Id;
  } else {
    grandFinalReset.active = false;
    grandFinalReset.p1Id = null;
    grandFinalReset.p2Id = null;
    grandFinalReset.winnerId = null;
  }
}

function reportDoubleEliminationResult(
  bracket: DoubleEliminationBracket,
  matchId: string,
  winnerId: string,
): DoubleEliminationBracket {
  const all: (WBMatch | LBMatch | GrandFinalMatch)[] = [
    ...bracket.wbRounds.flat(),
    ...bracket.lbRounds.flatMap((r) => r.matches),
    bracket.grandFinal,
    bracket.grandFinalReset,
  ];
  const m = all.find((x) => x.id === matchId);
  if (m) m.winnerId = winnerId;
  propagateDoubleElim(bracket);
  return bracket;
}

export {
  computeStandings,
  generateSwissPairings,
  generateSeedOrder,
  createSingleEliminationBracket,
  reportSingleEliminationResult,
  createDoubleEliminationBracket,
  reportDoubleEliminationResult,
};
