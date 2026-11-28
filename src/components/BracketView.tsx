import { useMemo, type ReactElement } from 'react';
import type { Player } from '../engine/tournament';
import { nameOf, type BracketMatch } from '../lib/bracketHelpers';

interface BracketViewProps {
  rounds: BracketMatch[][];
  roundLabels?: string[];
  playerMap: Record<string, Player>;
  onReport: (matchId: string, winnerId: string) => void;
  /** Whether a reported result can still be taken back. Without it (and
   *  `onUndo`) results are final once clicked. */
  canUndo?: (matchId: string) => boolean;
  onUndo?: (matchId: string) => void;
  readOnly?: boolean;
}

const SLOTS = ['p1Id', 'p2Id'] as const;

export default function BracketView({
  rounds,
  roundLabels,
  playerMap,
  onReport,
  canUndo,
  onUndo,
  readOnly,
}: BracketViewProps) {
  const matchH = 46,
    gapUnit = 62;
  const n0 = rounds[0].length;

  const centers = useMemo(() => {
    let prev = Array.from({ length: n0 }, (_, i) => i * gapUnit + gapUnit / 2);
    const all: number[][] = [prev];
    for (let r = 1; r < rounds.length; r++) {
      const cur: number[] = [];
      for (let i = 0; i < prev.length / 2; i++)
        cur.push((prev[2 * i] + prev[2 * i + 1]) / 2);
      all.push(cur);
      prev = cur;
    }
    return all;
  }, [rounds.length, n0]);

  const totalHeight = n0 * gapUnit;
  const colW = 196;
  const totalWidth = rounds.length * colW + 40;

  const lines: ReactElement[] = [];
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((_m, i) => {
      const x1 = r * colW + 180,
        y1 = centers[r][i];
      const x2 = (r + 1) * colW,
        y2 = centers[r + 1][Math.floor(i / 2)];
      const midX = (x1 + x2) / 2;
      lines.push(
        <path
          key={`${r}-${i}`}
          d={`M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`}
          style={{ stroke: 'var(--border)' }}
          strokeWidth="1.5"
          fill="none"
        />,
      );
    });
  }

  return (
    <div className="tk-bracket-scroll">
      <div
        className="tk-bracket"
        style={{ height: totalHeight + 24, width: totalWidth }}
      >
        <svg
          className="tk-bracket-lines"
          width={totalWidth}
          height={totalHeight}
        >
          {lines}
        </svg>
        {rounds.map((round, r) => (
          <div key={r} className="tk-bcol" style={{ left: r * colW }}>
            <div className="tk-bcol-label">
              {roundLabels ? roundLabels[r] : `Round ${r + 1}`}
            </div>
            {round.map((m, i) => (
              <div
                key={m.id}
                className="tk-bmatch"
                style={{ top: centers[r][i] - matchH / 2 + 24 }}
              >
                {SLOTS.map((slot) => {
                  const pid = m[slot];
                  const isWinner = !!m.winnerId && m.winnerId === pid;
                  const canClick =
                    !readOnly && pid && m.p1Id && m.p2Id && !m.winnerId;
                  const undoable =
                    isWinner && !readOnly && !!onUndo && !!canUndo?.(m.id);
                  return (
                    <div
                      key={slot}
                      className={`tk-bslot ${isWinner ? 'winner' : ''} ${!pid ? 'empty' : ''}`}
                      onClick={() => canClick && pid && onReport(m.id, pid)}
                    >
                      <span>{nameOf(playerMap, pid)}</span>
                      {undoable ? (
                        <button
                          type="button"
                          className="tk-bundo"
                          title="Undo this result"
                          aria-label={`Undo ${nameOf(playerMap, pid)}'s win`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUndo(m.id);
                          }}
                        >
                          W ↺
                        </button>
                      ) : (
                        isWinner && <span className="tk-bwin">W</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
