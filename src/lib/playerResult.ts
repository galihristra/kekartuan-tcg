import type { StandingRow } from '../engine/tournament';

/** One played round, either against an opponent or a bye. */
export interface RoundEntry {
  round: number;
  opponentId: string | null;
  result: 'W' | 'D' | 'L';
  /** Game score of the match, from this player's side. Null for a bye,
   *  which is awarded as a match win without any games being played. */
  gamesFor: number | null;
  gamesAgainst: number | null;
  forfeited?: boolean;
  mw: number | null;
  gw: number | null;
}

export interface ResultStat {
  label: string;
  value: string;
}

export const RESULT_LABEL = { W: 'Win', D: 'Draw', L: 'Loss' } as const;

/** Opponents and byes are tracked separately on a `StandingRow` (byes have no
 *  opponent and are excluded from the tiebreaker averages), so merge them back
 *  into one round-ordered history. */
export function roundHistory(row: StandingRow): RoundEntry[] {
  return [
    ...row.opponents.map((o) => ({
      round: o.round,
      opponentId: o.id,
      result: o.result,
      gamesFor: o.gamesFor,
      gamesAgainst: o.gamesAgainst,
      forfeited: o.forfeited,
      mw: o.mw,
      gw: o.gw,
    })),
    ...row.byeRounds.map((round) => ({
      round,
      opponentId: null,
      result: 'W' as const,
      gamesFor: null,
      gamesAgainst: null,
      mw: null,
      gw: null,
    })),
  ].sort((a, b) => a.round - b.round);
}

export function resultStats(row: StandingRow): ResultStat[] {
  return [
    { label: 'Points', value: String(row.points) },
    { label: 'W-D-L', value: `${row.wins}-${row.draws}-${row.losses}` },
    { label: 'MW%', value: (row.mw * 100).toFixed(1) },
    { label: 'GW%', value: (row.gw * 100).toFixed(1) },
    { label: 'OMW%', value: (row.omw * 100).toFixed(1) },
    { label: 'OGW%', value: (row.ogw * 100).toFixed(1) },
  ];
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** The event date as it reads on a shared image: "3 Sep 2026". Spelled out from
 *  a fixed table rather than through `Intl`, whose short month names drift
 *  between locales and ICU versions ("Sept", "9月") — this string is baked into
 *  a picture, so it should look the same wherever it was rendered. Read in the
 *  viewer's own timezone, which for a local store's event is the right day.
 *
 *  Returns null for a missing or unparseable timestamp so the footer drops the
 *  date rather than printing "Invalid Date" into something someone posts. */
export function formatEventDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}
