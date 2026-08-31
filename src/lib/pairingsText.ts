import type { Player, SwissMatch } from '../engine/tournament';

/** Stands in for a player the roster no longer knows about. */
const UNKNOWN_PLAYER = '???';

function nameOf(playerMap: Record<string, Player>, id: string | undefined) {
  if (!id) return UNKNOWN_PLAYER;
  return playerMap[id]?.name || UNKNOWN_PLAYER;
}

/**
 * The round's pairings as plain text, ready to paste into a WhatsApp or
 * Discord message:
 *
 *     ROUND 1
 *     John VS Doe
 *     Ralph VS David
 *
 * Byes come last, mirroring how the panel lists them, and read as
 * `Leo VS BYE`.
 */
export function formatRoundPairings(
  round: number,
  matches: SwissMatch[],
  playerMap: Record<string, Player>,
): string {
  const roundMatches = matches.filter((m) => m.round === round);
  const lines = [`ROUND ${round}`];

  roundMatches
    .filter((m) => !m.isBye)
    .forEach((m) => {
      lines.push(
        `${nameOf(playerMap, m.p1Id)} VS ${nameOf(playerMap, m.p2Id)}`,
      );
    });
  roundMatches
    .filter((m) => m.isBye)
    .forEach((m) => {
      lines.push(`${nameOf(playerMap, m.p1Id)} VS BYE`);
    });

  return lines.join('\n');
}
