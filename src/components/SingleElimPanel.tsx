import {
  canUndoSingleEliminationResult,
  singleEliminationChampion,
  type Player,
  type SingleEliminationBracket,
} from '../engine/tournament';
import { singleRoundLabels } from '../lib/bracketLabels';
import { nameOf } from '../lib/bracketHelpers';
import BracketView from './BracketView';

interface SingleElimPanelProps {
  isAdmin: boolean;
  playersCount: number;
  playerMap: Record<string, Player>;
  bracket: SingleEliminationBracket | null;
  eventFinished: boolean;
  onGenerate: () => void;
  onReport: (matchId: string, winnerId: string) => void;
  /** Takes back a result whose winner hasn't played their next match yet. */
  onUndo: (matchId: string) => void;
  /** Marks the event complete once the final is in. */
  onFinishEvent: () => void;
  /** Archives the finished event and leaves for the dashboard. */
  onNewEvent: () => void;
}

export default function SingleElimPanel({
  isAdmin,
  playersCount,
  playerMap,
  bracket,
  eventFinished,
  onGenerate,
  onReport,
  onUndo,
  onFinishEvent,
  onNewEvent,
}: SingleElimPanelProps) {
  if (!bracket) {
    return (
      <div className="tk-panel">
        {isAdmin ? (
          <>
            <button
              className="tk-btn"
              disabled={playersCount < 2}
              onClick={onGenerate}
            >
              Generate Bracket
            </button>
            <div className="tk-empty tk-empty--spaced">
              Seeded by roster order above (player 1 = top seed). Byes go to the
              top seeds if the field isn't a power of two. Generating the
              bracket locks the roster and closes registration.
            </div>
          </>
        ) : (
          <div className="tk-empty">
            Waiting for organizer to generate the bracket.
          </div>
        )}
      </div>
    );
  }

  const championId = singleEliminationChampion(bracket);

  return (
    <div className="tk-panel">
      <div className="tk-roundbar">
        <div className="tk-roundlabel">
          {eventFinished
            ? 'Event complete'
            : championId
              ? 'Final decided'
              : 'Bracket in progress'}
        </div>
        <div className="tk-roundbar-actions">
          {eventFinished
            ? isAdmin && (
                <button className="tk-btn ghost" onClick={onNewEvent}>
                  Finish Event
                </button>
              )
            : championId &&
              (isAdmin ? (
                <button className="tk-btn" onClick={onFinishEvent}>
                  Finish event
                </button>
              ) : (
                <span className="tk-hint">
                  Waiting for organizer to finish the event
                </span>
              ))}
          {isAdmin && !eventFinished && (
            <button className="tk-btn ghost" onClick={onGenerate}>
              Re-seed &amp; restart
            </button>
          )}
        </div>
      </div>
      {championId && (
        <div className="tk-champion">
          🏆 <b className="tk-gold">{nameOf(playerMap, championId)}</b> wins the
          event
        </div>
      )}
      <BracketView
        rounds={bracket.rounds}
        roundLabels={singleRoundLabels(bracket.totalRounds)}
        playerMap={playerMap}
        onReport={onReport}
        canUndo={(matchId) => canUndoSingleEliminationResult(bracket, matchId)}
        onUndo={onUndo}
        readOnly={!isAdmin || eventFinished}
      />
    </div>
  );
}
