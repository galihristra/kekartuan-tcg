import type { Player, StandingRow, SwissMatch } from '../engine/tournament';
import LeaguePairingTicket from './LeaguePairingTicket';
import CopyButton from './CopyButton';
import { formatRoundPairings } from '../lib/pairingsText';
import StandingsTable from './StandingsTable';

interface LeaguePanelProps {
  isAdmin: boolean;
  eventFinished: boolean;
  round: number;
  roundCount: number;
  roundComplete: boolean;
  matches: SwissMatch[];
  playerMap: Record<string, Player>;
  standings: StandingRow[];
  playersCount: number;
  onStartRound: () => void;
  onFinishEvent: () => void;
  onNewEvent: () => void;
  onReportGame: (match: SwissMatch, winner: 'p1' | 'p2') => void;
  onDraw: (match: SwissMatch) => void;
  onEditMatch: (match: SwissMatch) => void;
}

export default function LeaguePanel({
  isAdmin,
  eventFinished,
  round,
  roundCount,
  roundComplete,
  matches,
  playerMap,
  standings,
  playersCount,
  onStartRound,
  onFinishEvent,
  onNewEvent,
  onReportGame,
  onDraw,
  onEditMatch,
}: LeaguePanelProps) {
  if (eventFinished) {
    return (
      <div className="tk-panel">
        <div className="tk-roundbar">
          <div className="tk-roundlabel">Event complete</div>
          {isAdmin && (
            <button className="tk-btn ghost" onClick={onNewEvent}>
              New event
            </button>
          )}
        </div>
        <div className="tk-champion">
          🏆 <b className="tk-gold">{standings[0]?.name ?? '—'}</b> wins the
          league
        </div>
        <h3 className="tk-section-title">Final Standings</h3>
        <StandingsTable rows={standings} playerMap={playerMap} mode="league" />
      </div>
    );
  }

  const roundMatches = matches.filter((m) => m.round === round);

  return (
    <div className="tk-panel">
      <div className="tk-roundbar">
        <div className="tk-roundlabel">
          {round === 0 ? (
            'Not started'
          ) : (
            <>
              Round <span className="tk-gold">{round}</span> of {roundCount}
            </>
          )}
        </div>
        <div className="tk-roundbar-actions">
          {isAdmin && roundMatches.length > 0 && (
            <CopyButton
              value={formatRoundPairings(round, matches, playerMap)}
              label="pairings"
            />
          )}
          {(() => {
            if (round === 0) {
              if (!isAdmin)
                return (
                  <span className="tk-hint">
                    Waiting for organizer to start the event
                  </span>
                );
              return (
                <button
                  className="tk-btn"
                  disabled={playersCount < 2}
                  onClick={onStartRound}
                >
                  Start League
                </button>
              );
            }
            if (!roundComplete)
              return (
                <span className="tk-hint">Report all results to continue</span>
              );
            if (round < roundCount) {
              if (!isAdmin)
                return (
                  <span className="tk-hint">
                    Waiting for organizer to start round {round + 1}
                  </span>
                );
              return (
                <button className="tk-btn" onClick={onStartRound}>
                  Start Round {round + 1}
                </button>
              );
            }
            if (!isAdmin)
              return (
                <span className="tk-hint">
                  Waiting for organizer to finish the event
                </span>
              );
            return (
              <button className="tk-btn" onClick={onFinishEvent}>
                Finish event
              </button>
            );
          })()}
        </div>
      </div>

      {round === 0 && (
        <div className="tk-empty">
          Add players, then start the league. Every player faces every other
          player exactly once, best-of-3 per match.
        </div>
      )}

      {roundMatches
        .filter((m) => !m.isBye)
        .map((m, i) => (
          <LeaguePairingTicket
            key={i}
            index={i}
            p1={playerMap[m.p1Id]}
            p2={playerMap[m.p2Id!]}
            match={m}
            onReportGame={(winner) => onReportGame(m, winner)}
            onDraw={() => onDraw(m)}
            onEdit={() => onEditMatch(m)}
            readOnly={!isAdmin}
          />
        ))}
      {roundMatches
        .filter((m) => m.isBye)
        .map((m, i) => (
          <div className="tk-bye" key={`bye-${i}`}>
            {playerMap[m.p1Id]?.name} receives the bye this round (counted as a
            win).
          </div>
        ))}

      {matches.length > 0 && (
        <div className="tk-standings-block">
          <h3 className="tk-section-title">Standings</h3>
          <StandingsTable
            rows={standings}
            playerMap={playerMap}
            mode="league"
          />
        </div>
      )}
    </div>
  );
}
