import type { Player, StandingRow, SwissMatch } from '../engine/tournament';
import PairingTicket from './PairingTicket';
import StandingsTable from './StandingsTable';

interface SwissPanelProps {
  isAdmin: boolean;
  eventFinished: boolean;
  round: number;
  roundCount: number;
  roundComplete: boolean;
  matches: SwissMatch[];
  playerMap: Record<string, Player>;
  standings: StandingRow[];
  playersCount: number;
  roundsValid: boolean;
  onStartRound: () => void;
  onFinishEvent: () => void;
  onNewEvent: () => void;
  onReportSwiss: (match: SwissMatch, patch: Partial<SwissMatch>) => void;
  onSwapPairing: (matchA: SwissMatch, matchB: SwissMatch) => void;
}

/** True if these two players faced each other in an earlier round. */
function isRematch(
  matches: SwissMatch[],
  round: number,
  m: SwissMatch,
): boolean {
  if (!m.p2Id) return false;
  return matches.some(
    (other) =>
      other.round < round &&
      !other.isBye &&
      ((other.p1Id === m.p1Id && other.p2Id === m.p2Id) ||
        (other.p1Id === m.p2Id && other.p2Id === m.p1Id)),
  );
}

export default function SwissPanel({
  isAdmin,
  eventFinished,
  round,
  roundCount,
  roundComplete,
  matches,
  playerMap,
  standings,
  playersCount,
  roundsValid,
  onStartRound,
  onFinishEvent,
  onNewEvent,
  onReportSwiss,
  onSwapPairing,
}: SwissPanelProps) {
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
          event
        </div>
        <h3 className="tk-section-title">Final Standings</h3>
        <StandingsTable rows={standings} playerMap={playerMap} />
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
                disabled={playersCount < 2 || !roundsValid}
                onClick={onStartRound}
              >
                Start Round 1
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

      {round === 0 && (
        <div className="tk-empty">
          Add players, then start round 1. Pairings are randomized for round 1,
          and score-based (no repeat matchups where possible) after that.
        </div>
      )}

      {(() => {
        const regular = roundMatches.filter((m) => !m.isBye);
        const swappable = regular.filter((m) => !m.result);
        return regular.map((m, i) => (
          <div key={i}>
            <PairingTicket
              index={i}
              p1={playerMap[m.p1Id]}
              p2={playerMap[m.p2Id!]}
              match={m}
              onReport={(patch) => onReportSwiss(m, patch)}
              readOnly={!isAdmin}
            />
            {isRematch(matches, round, m) && (
              <div className="tk-hint tk-rematch-warning">
                ⚠ Rematch — these two already played this event
                {isAdmin && !m.result && ' — swap an opponent below to fix it'}
              </div>
            )}
            {isAdmin && !m.result && swappable.length > 1 && (
              <div className="tk-swap-control">
                <label className="tk-hint">
                  Swap opponent:{' '}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value === '') return;
                      const other = swappable[Number(e.target.value)];
                      if (other && other !== m) onSwapPairing(m, other);
                    }}
                  >
                    <option value="">Choose a pairing…</option>
                    {swappable.map(
                      (om, oi) =>
                        om !== m && (
                          <option key={oi} value={oi}>
                            {playerMap[om.p1Id]?.name} vs{' '}
                            {playerMap[om.p2Id!]?.name}
                          </option>
                        ),
                    )}
                  </select>
                </label>
              </div>
            )}
          </div>
        ));
      })()}
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
          <StandingsTable rows={standings} playerMap={playerMap} />
        </div>
      )}
    </div>
  );
}
