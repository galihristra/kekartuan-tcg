import type { ReactNode } from 'react';
import type { Player, StandingRow } from '../engine/tournament';
import { RESULT_LABEL, resultStats, roundHistory } from '../lib/playerResult';
import DeckSprites from './DeckSprites';

interface PlayerResultDetailsProps {
  row: StandingRow;
  playerMap: Record<string, Player>;
  /** Slot between the stats grid and the round list. The share card leaves it
   *  empty; the modal puts the admin "Edit deck" button here. */
  afterStats?: ReactNode;
}

/** The stats grid and the round-by-round list, shared by the modal body and the
 *  share card. Purely presentational: no buttons, so everything in here is
 *  safe to rasterize into a picture. */
export default function PlayerResultDetails({
  row,
  playerMap,
  afterStats,
}: PlayerResultDetailsProps) {
  const rounds = roundHistory(row);

  return (
    <>
      <div className="tk-perf-stats">
        {resultStats(row).map((s) => (
          <div className="tk-perf-stat" key={s.label}>
            <span className="tk-perf-stat-label">{s.label}</span>
            <span className="tk-perf-stat-value">{s.value}</span>
          </div>
        ))}
      </div>

      {afterStats}

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
    </>
  );
}
