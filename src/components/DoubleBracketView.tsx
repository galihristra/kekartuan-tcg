import type {
  DoubleEliminationBracket,
  GrandFinalMatch,
  LBMatch,
  Player,
} from '../engine/tournament';
import { singleRoundLabels } from '../lib/bracketLabels';
import { nameOf } from '../lib/bracketHelpers';
import BracketView from './BracketView';

const SLOTS = ['p1Id', 'p2Id'] as const;

interface MatchSlotsProps {
  match: LBMatch | GrandFinalMatch;
  playerMap: Record<string, Player>;
  readOnly: boolean;
  onReport: (matchId: string, winnerId: string) => void;
}

/** Both slots of one match; a slot is clickable once both players are in. */
function MatchSlots({ match, playerMap, readOnly, onReport }: MatchSlotsProps) {
  return SLOTS.map((slot) => {
    const pid = match[slot];
    const isWinner = !!match.winnerId && match.winnerId === pid;
    const canClick =
      !readOnly && !!(pid && match.p1Id && match.p2Id && !match.winnerId);
    return (
      <div
        key={slot}
        className={`tk-bslot ${isWinner ? 'winner' : ''} ${!pid ? 'empty' : ''}`}
        onClick={() => canClick && pid && onReport(match.id, pid)}
      >
        <span>{nameOf(playerMap, pid)}</span>
        {isWinner && <span className="tk-bwin">W</span>}
      </div>
    );
  });
}

interface DoubleBracketViewProps {
  bracket: DoubleEliminationBracket;
  playerMap: Record<string, Player>;
  onReport: (matchId: string, winnerId: string) => void;
  readOnly: boolean;
}

/** Winners' bracket, losers' bracket and grand final (plus reset, if played). */
export default function DoubleBracketView({
  bracket,
  playerMap,
  onReport,
  readOnly,
}: DoubleBracketViewProps) {
  return (
    <>
      <h3 className="tk-section-title">Winners' Bracket</h3>
      <BracketView
        rounds={bracket.wbRounds}
        roundLabels={singleRoundLabels(bracket.wbRounds.length)}
        playerMap={playerMap}
        onReport={onReport}
        readOnly={readOnly}
      />

      <h3 className="tk-section-title">Losers' Bracket</h3>
      <div className="tk-lbwrap">
        {bracket.lbRounds.map((lbRound, ri) => (
          <div className="tk-lbcol" key={ri}>
            <div className="tk-bcol-label">LB {ri + 1}</div>
            {lbRound.matches.map((m) => (
              <div className="tk-bmatch tk-bmatch--static" key={m.id}>
                <MatchSlots
                  match={m}
                  playerMap={playerMap}
                  readOnly={readOnly}
                  onReport={onReport}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <h3 className="tk-section-title">Grand Final</h3>
      <div className="tk-gf">
        <div className="tk-bmatch">
          <MatchSlots
            match={bracket.grandFinal}
            playerMap={playerMap}
            readOnly={readOnly}
            onReport={onReport}
          />
        </div>
        {bracket.grandFinalReset.active && (
          <div className="tk-bmatch">
            <div className="tk-reset-label">BRACKET RESET</div>
            <MatchSlots
              match={bracket.grandFinalReset}
              playerMap={playerMap}
              readOnly={readOnly}
              onReport={onReport}
            />
          </div>
        )}
      </div>
    </>
  );
}
