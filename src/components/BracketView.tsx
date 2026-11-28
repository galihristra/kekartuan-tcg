import { useMemo, useState, type ReactElement } from 'react';
import type { Player } from '../engine/tournament';
import { nameOf, type BracketMatch } from '../lib/bracketHelpers';
import Modal from './Modal';

/** A winner the organizer has tapped but not yet confirmed. */
interface PendingResult {
  matchId: string;
  winnerId: string;
  loserId: string;
}

interface BracketViewProps {
  rounds: BracketMatch[][];
  roundLabels?: string[];
  playerMap: Record<string, Player>;
  onReport: (matchId: string, winnerId: string) => void;
  readOnly?: boolean;
}

const SLOTS = ['p1Id', 'p2Id'] as const;

export default function BracketView({
  rounds,
  roundLabels,
  playerMap,
  onReport,
  readOnly,
}: BracketViewProps) {
  const [pending, setPending] = useState<PendingResult | null>(null);
  const closeConfirm = () => setPending(null);
  const confirmResult = () => {
    if (pending) onReport(pending.matchId, pending.winnerId);
    setPending(null);
  };

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
                  const otherId = slot === 'p1Id' ? m.p2Id : m.p1Id;
                  const isWinner = !!m.winnerId && m.winnerId === pid;
                  const canClick =
                    !readOnly && !!pid && !!otherId && !m.winnerId;
                  return (
                    <div
                      key={slot}
                      className={`tk-bslot ${isWinner ? 'winner' : ''} ${!pid ? 'empty' : ''} ${canClick ? 'clickable' : ''}`}
                      role={canClick ? 'button' : undefined}
                      tabIndex={canClick ? 0 : undefined}
                      onClick={() =>
                        canClick &&
                        setPending({
                          matchId: m.id,
                          winnerId: pid,
                          loserId: otherId,
                        })
                      }
                    >
                      <span>{nameOf(playerMap, pid)}</span>
                      {isWinner && <span className="tk-bwin">W</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <Modal open={!!pending} onClose={closeConfirm} title="Confirm winner">
        {pending && (
          <>
            <p className="tk-hint tk-bconfirm-text">
              <b className="tk-gold">{nameOf(playerMap, pending.winnerId)}</b>{' '}
              beats <b>{nameOf(playerMap, pending.loserId)}</b> and advances.
            </p>
            <div className="tk-modal-actions">
              <button className="tk-btn ghost" onClick={closeConfirm}>
                Cancel
              </button>
              <button className="tk-btn" onClick={confirmResult} autoFocus>
                Confirm
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
