import type { Player, StandingRow } from '../engine/tournament';
import Modal from './Modal';
import DeckSprites from './DeckSprites';

interface PlayerPerformanceModalProps {
  onClose: () => void;
  row: StandingRow;
  playerMap: Record<string, Player>;
  /** Shown above the player's name so a screenshot of this modal says which
   *  event the result belongs to. */
  eventName?: string;
  /** When provided, renders an "Edit deck" button (admin only). */
  onEditDeck?: () => void;
}

/** One played round, either against an opponent or a bye. */
interface RoundEntry {
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

const RESULT_LABEL = { W: 'Win', D: 'Draw', L: 'Loss' } as const;

export default function PlayerPerformanceModal({
  onClose,
  row,
  playerMap,
  eventName,
  onEditDeck,
}: PlayerPerformanceModalProps) {
  const player = playerMap[row.id];

  // Opponents and byes are tracked separately (byes have no opponent and are
  // excluded from the tiebreaker averages), so merge them back into one
  // round-ordered history.
  const rounds: RoundEntry[] = [
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

  const stats: { label: string; value: string }[] = [
    { label: 'Points', value: String(row.points) },
    { label: 'W-D-L', value: `${row.wins}-${row.draws}-${row.losses}` },
    { label: 'MW%', value: (row.mw * 100).toFixed(1) },
    { label: 'GW%', value: (row.gw * 100).toFixed(1) },
    { label: 'OMW%', value: (row.omw * 100).toFixed(1) },
    { label: 'OGW%', value: (row.ogw * 100).toFixed(1) },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      className="tk-modal--perf"
      title={
        <span className="tk-perf-title">
          {eventName?.trim() && (
            <span className="tk-perf-title-event">{eventName.trim()}</span>
          )}
          <span className="tk-perf-title-main">
            <DeckSprites player={player} />
            {row.name}'s Result
          </span>
        </span>
      }
    >
      <div className="tk-perf-stats">
        {stats.map((s) => (
          <div className="tk-perf-stat" key={s.label}>
            <span className="tk-perf-stat-label">{s.label}</span>
            <span className="tk-perf-stat-value">{s.value}</span>
          </div>
        ))}
      </div>

      {onEditDeck && (
        <button className="tk-btn ghost tk-perf-edit" onClick={onEditDeck}>
          Edit deck
        </button>
      )}

      <h4 className="tk-perf-heading">Rounds</h4>
      {rounds.length === 0 ? (
        <div className="tk-perf-empty">No rounds played yet.</div>
      ) : (
        <ul className="tk-perf-rounds">
          {rounds.map((e) => {
            const opp = e.opponentId ? playerMap[e.opponentId] : undefined;
            const hasScore = e.gamesFor !== null && e.gamesAgainst !== null;
            return (
              <li
                className={`tk-perf-round tk-perf-round--${e.result}`}
                key={`${e.round}-${e.opponentId ?? 'bye'}`}
              >
                <span className="tk-perf-round-num">{e.round}</span>
                <span className="tk-perf-round-opp">
                  <span className="tk-perf-round-name">
                    <DeckSprites player={opp} size="xs" />
                    {e.opponentId
                      ? (opp?.name ?? 'Unknown')
                      : 'Bye (no opponent)'}
                  </span>
                  {e.mw !== null && e.gw !== null && (
                    <span className="tk-perf-round-tb">
                      Opp MW {(e.mw * 100).toFixed(1)}% · Opp GW{' '}
                      {(e.gw * 100).toFixed(1)}%{e.forfeited && ' · forfeit'}
                    </span>
                  )}
                </span>
                <span
                  className="tk-perf-round-result"
                  title={
                    hasScore
                      ? `${RESULT_LABEL[e.result]} ${e.gamesFor}-${e.gamesAgainst}`
                      : RESULT_LABEL[e.result]
                  }
                >
                  {e.result}
                  {hasScore && (
                    <span className="tk-perf-round-score">
                      ({e.gamesFor}–{e.gamesAgainst})
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
