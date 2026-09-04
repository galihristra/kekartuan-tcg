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
  /** Set when `result` was decided by a drop rather than being played out. */
  forfeited?: boolean;
}

/** Result of a match from one player's point of view. */
export type MatchOutcome = 'W' | 'D' | 'L';

export interface OpponentBreakdown {
  id: string;
  /** Swiss round this opponent was faced in. */
  round: number;
  /** Outcome from the perspective of the player this breakdown belongs to. */
  result: MatchOutcome;
  /** Games won in this match by the player this breakdown belongs to. */
  gamesFor: number;
  /** Games won in this match by the opponent. */
  gamesAgainst: number;
  /** Set when the match was decided by a drop rather than being played out. */
  forfeited?: boolean;
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
  /** Games won minus games lost. League's primary tiebreak; harmless for Swiss. */
  gameDiff: number;
  opponents: OpponentBreakdown[];
  /** Rounds the player sat out with a bye (counted as a win, no opponent). */
  byeRounds: number[];
  /** Placing under standard competition ranking: players nothing separates
   *  share the higher place and the places they fill are skipped, so a tie for
   *  1st reads 1, 1, 3 — the way a sports table does it. */
  rank: number;
  /** No tiebreak could separate this player from someone sharing their rank.
   *  The organizer has to settle it (a playoff, a draw) before prizes. */
  tiebreakNeeded: boolean;
  /** This player's place inside an otherwise unbreakable tie was set by the
   *  organizer rather than by results. */
  manuallyOrdered: boolean;
  /** Identifies the set of players no tiebreak could separate from this one,
   *  or null when nothing is tied with them. It stays stable once an organizer
   *  orders the group, which is what lets them keep adjusting it — `rank` and
   *  `tiebreakNeeded` both stop marking the tie at that point. */
  tieGroup: number | null;
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
  opponents: Omit<OpponentBreakdown, 'mw' | 'gw'>[];
  byeRounds: number[];
}

export type StandingsMode = 'swiss' | 'league';

/**
 * The standings table for one event.
 *
 * `manualOrder` is the organizer's own ordering of players a tiebreak could
 * not separate, listed best-first. It is consulted only inside a tied group,
 * so it can settle a 2nd/3rd prize without letting anyone jump a player they
 * genuinely finished behind.
 */
function computeStandings(
  players: Player[],
  matches: SwissMatch[],
  mode: StandingsMode = 'swiss',
  manualOrder: string[] = [],
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
    const p1Games = m.p1Games || 0;
    const p2Games = m.p2Games || 0;
    s1.opponents.push({
      id: p2Id,
      round: m.round,
      result: outcome1,
      gamesFor: p1Games,
      gamesAgainst: p2Games,
      forfeited: m.forfeited,
    });
    s2.opponents.push({
      id: m.p1Id,
      round: m.round,
      result: outcome2,
      gamesFor: p2Games,
      gamesAgainst: p1Games,
      forfeited: m.forfeited,
    });
    s1.gamesWon += p1Games;
    s2.gamesWon += p2Games;
    const totalGames = p1Games + p2Games;
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
      gameDiff: s.gamesWon - (s.gamesPlayed - s.gamesWon),
      opponents: opp.map((o) => ({
        ...o,
        mw: mw(o.id),
        gw: gw(o.id),
      })),
      byeRounds: s.byeRounds,
      // Stamped by `orderStandings` once every row exists to compare against.
      rank: 0,
      tiebreakNeeded: false,
      manuallyOrdered: false,
      tieGroup: null,
    };
  });

  return orderStandings(rows, mode, manualOrder);
}

/**
 * The values a format ranks on, most significant first. Two players level on
 * every one of them are tied as far as their results can show.
 *
 * A league is a full round-robin, so everyone faces the same field and
 * opponent strength carries no signal — it never reads OMW%/OGW%.
 */
function tiebreakKey(row: StandingRow, mode: StandingsMode): number[] {
  return mode === 'league'
    ? [row.points, row.gameDiff, row.gw]
    : [row.points, row.omw, row.gw, row.ogw];
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (b[i] !== a[i]) return b[i] - a[i];
  }
  return 0;
}

/**
 * Match points a player took from the others they are tied with and from
 * nobody else — the "mini-league" a sports table falls back on.
 *
 * A completed round-robin has every tied pair meeting exactly once, so this
 * usually settles it. Two cases it cannot settle, both left to the organizer:
 * a cycle (A beat B beat C beat A) scores everyone equally, and a tie that
 * shows up mid-league between players who have yet to be paired.
 */
function headToHeadPoints(row: StandingRow, group: Set<string>): number {
  return row.opponents.reduce((sum, o) => {
    if (!group.has(o.id)) return sum;
    if (o.result === 'W') return sum + MATCH_POINTS.win;
    if (o.result === 'D') return sum + MATCH_POINTS.draw;
    return sum;
  }, 0);
}

/**
 * Orders the table and stamps each row's place.
 *
 * Head-to-head is applied as a mini-league within each tied group rather than
 * as a pairwise comparison inside the sort: a cycle makes pairwise
 * head-to-head intransitive, and an intransitive comparator gives
 * `Array.prototype.sort` licence to return anything at all.
 *
 * `manualOrder` only ever separates players a tiebreak already failed to, so
 * it cannot lift anyone above someone they actually finished behind.
 */
function orderStandings(
  rows: StandingRow[],
  mode: StandingsMode,
  manualOrder: string[],
): StandingRow[] {
  const manualIndex = new Map(manualOrder.map((id, i) => [id, i]));
  const h2h = new Map<string, number>();

  rows.sort((a, b) => compareKeys(tiebreakKey(a, mode), tiebreakKey(b, mode)));

  // Resolve each run of rows that the format's own tiebreaks left level.
  const ordered: StandingRow[] = [];
  for (let i = 0; i < rows.length;) {
    const key = tiebreakKey(rows[i], mode);
    let j = i + 1;
    while (
      j < rows.length &&
      compareKeys(tiebreakKey(rows[j], mode), key) === 0
    ) {
      j++;
    }
    const group = rows.slice(i, j);
    if (group.length > 1) {
      const ids = new Set(group.map((r) => r.id));
      group.forEach((r) => h2h.set(r.id, headToHeadPoints(r, ids)));
      group.sort((a, b) => {
        const byHeadToHead = h2h.get(b.id)! - h2h.get(a.id)!;
        if (byHeadToHead !== 0) return byHeadToHead;
        const ma = manualIndex.get(a.id);
        const mb = manualIndex.get(b.id);
        // Only an ordering that covers both players says anything about which
        // of the two comes first.
        if (ma !== undefined && mb !== undefined) return ma - mb;
        return 0;
      });
    }
    ordered.push(...group);
    i = j;
  }

  // Standard competition ranking over what nothing could separate.
  const level = (a: StandingRow, b: StandingRow): boolean =>
    compareKeys(tiebreakKey(a, mode), tiebreakKey(b, mode)) === 0 &&
    (h2h.get(a.id) ?? 0) === (h2h.get(b.id) ?? 0);

  let tieGroup = 0;
  for (let i = 0; i < ordered.length;) {
    let j = i + 1;
    while (j < ordered.length && level(ordered[i], ordered[j])) j++;
    const place = ordered.slice(i, j);
    const tied = place.length > 1;
    const settledByOrganizer =
      tied && place.every((r) => manualIndex.has(r.id));
    place.forEach((r, k) => {
      // An organizer who ordered the whole group has decided the places, so
      // they stop sharing one and the table stops asking for a tiebreak.
      r.rank = settledByOrganizer ? i + k + 1 : i + 1;
      r.tiebreakNeeded = tied && !settledByOrganizer;
      r.manuallyOrdered = settledByOrganizer;
      r.tieGroup = tied ? tieGroup : null;
    });
    if (tied) tieGroup++;
    i = j;
  }

  return ordered;
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

/**
 * Backtracking search for a pairing of `pool` with no rematches. Tries
 * candidates in list order (closest in standings first) so the result stays
 * close to a straight top-down pairing, but backtracks instead of forcing a
 * rematch the moment a greedy choice dead-ends. `budget` bounds the search
 * so a pool with no valid solution (or a pathological one) fails fast
 * instead of hanging.
 */
function pairWithoutRematches(
  pool: Player[],
  matches: SwissMatch[],
  budget: { steps: number },
): SwissPairing[] | null {
  if (pool.length === 0) return [];
  if (budget.steps <= 0) return null;
  budget.steps--;

  const [p1, ...rest] = pool;
  for (let i = 0; i < rest.length; i++) {
    if (hasPlayed(matches, p1.id, rest[i].id)) continue;
    const remaining = [...rest.slice(0, i), ...rest.slice(i + 1)];
    const sub = pairWithoutRematches(remaining, matches, budget);
    if (sub) return [{ p1Id: p1.id, p2Id: rest[i].id }, ...sub];
    if (budget.steps <= 0) return null;
  }
  return null;
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

  const found = pairWithoutRematches(pool, matches, { steps: 200_000 });
  let pairings: SwissPairing[];
  if (found) {
    pairings = found;
  } else {
    // No rematch-free pairing exists (or the search budget ran out on a huge
    // field) — fall back to a straight greedy pass so pairing always
    // terminates. This may force a rematch as a last resort.
    const unpaired = [...pool];
    pairings = [];
    while (unpaired.length > 0) {
      const p1 = unpaired.shift()!;
      let idx = unpaired.findIndex((p2) => !hasPlayed(matches, p1.id, p2.id));
      if (idx === -1) idx = 0;
      const p2 = unpaired.splice(idx, 1)[0];
      pairings.push({ p1Id: p1.id, p2Id: p2.id });
    }
  }

  return { pairings, byePlayerId: byePlayer ? byePlayer.id : null };
}

// ===================== League (round-robin) =====================

/**
 * Full round-robin schedule for every active player, generated once up
 * front (unlike Swiss, this doesn't depend on results as rounds are
 * played). Uses the standard circle/polygon method: fix one slot, rotate
 * the rest by one position each round. An odd player count is padded with
 * a `null` "ghost" opponent, which rotates through every real slot so byes
 * land on a different player each round.
 */
function generateRoundRobinSchedule(players: Player[]): {
  matches: SwissMatch[];
  roundCount: number;
} {
  const active = shuffle(players.filter((p) => !p.dropped));
  const arr: (string | null)[] = active.map((p) => p.id);
  if (arr.length % 2 === 1) arr.push(null);
  const n = arr.length;
  if (n < 2) return { matches: [], roundCount: 0 };
  const roundCount = n - 1;
  const half = n / 2;

  const matches: SwissMatch[] = [];
  const cur = [...arr];
  for (let round = 1; round <= roundCount; round++) {
    for (let i = 0; i < half; i++) {
      const a = cur[i];
      const b = cur[n - 1 - i];
      if (a === null || b === null) {
        const byeId = (a ?? b) as string;
        matches.push({ p1Id: byeId, round, isBye: true });
      } else {
        matches.push({
          p1Id: a,
          p2Id: b,
          round,
          result: null,
          p1Games: 0,
          p2Games: 0,
        });
      }
    }
    // Rotate everything but slot 0 by one position.
    const fixed = cur[0];
    const rest = cur.slice(1);
    rest.unshift(rest.pop()!);
    cur.splice(0, cur.length, fixed, ...rest);
  }

  return { matches, roundCount };
}

/** Records one game of a best-of-3 league match, auto-deciding the match once either side reaches 2 game wins. */
function applyGameWin(
  match: SwissMatch,
  winner: 'p1' | 'p2',
): Partial<SwissMatch> {
  const p1Games = (match.p1Games ?? 0) + (winner === 'p1' ? 1 : 0);
  const p2Games = (match.p2Games ?? 0) + (winner === 'p2' ? 1 : 0);
  const result: MatchResult | null =
    p1Games >= 2 ? 'p1' : p2Games >= 2 ? 'p2' : null;
  return { p1Games, p2Games, result };
}

/**
 * Marks a player dropped and forfeits every not-yet-decided match of
 * theirs — for a league this reaches into future rounds too, since the
 * whole schedule already exists as rows; for Swiss it only ever touches the
 * current round's pending match, since later rounds aren't generated yet
 * (the pairer already excludes dropped players from those).
 */
function dropPlayer(
  players: Player[],
  matches: SwissMatch[],
  playerId: string,
): { players: Player[]; matches: SwissMatch[] } {
  const nextPlayers = players.map((p) =>
    p.id === playerId ? { ...p, dropped: true } : p,
  );
  const nextMatches = matches.map((m) => {
    if (m.isBye || m.result) return m;
    if (m.p1Id !== playerId && m.p2Id !== playerId) return m;
    if (!m.p2Id) return m;
    const winner: MatchResult = m.p1Id === playerId ? 'p2' : 'p1';
    return {
      ...m,
      result: winner,
      p1Games: winner === 'p1' ? 2 : 0,
      p2Games: winner === 'p2' ? 2 : 0,
      forfeited: true,
    };
  });
  return { players: nextPlayers, matches: nextMatches };
}

/**
 * Matches that have actually happened by `round`. A league's schedule is
 * generated for every round up front, including byes for rounds that
 * haven't been reached yet — and a bye counts as a win the moment it's in
 * the array (unlike a regular match, which is naturally gated on having a
 * `result`), so an unreached bye must be filtered out before computing
 * standings or it scores early. Decided matches (played or forfeited) keep
 * counting regardless of round, since a drop should score immediately.
 */
function matchesThroughRound(
  matches: SwissMatch[],
  round: number,
): SwissMatch[] {
  return matches.filter((m) => !m.isBye || m.round <= round);
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
  generateRoundRobinSchedule,
  applyGameWin,
  dropPlayer,
  matchesThroughRound,
  generateSeedOrder,
  createSingleEliminationBracket,
  reportSingleEliminationResult,
  createDoubleEliminationBracket,
  reportDoubleEliminationResult,
};
