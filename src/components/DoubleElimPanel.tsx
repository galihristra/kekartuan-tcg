import {
  doubleEliminationChampion,
  type DoubleEliminationBracket,
  type Player,
} from '../engine/tournament';
import { nameOf } from '../lib/bracketHelpers';
import DoubleBracketView from './DoubleBracketView';

interface DoubleElimPanelProps {
  isAdmin: boolean;
  playersCount: number;
  playerMap: Record<string, Player>;
  bracket: DoubleEliminationBracket | null;
  eventFinished: boolean;
  onGenerate: () => void;
  onReport: (matchId: string, winnerId: string) => void;
  /** Marks the event complete once the grand final (or its reset) is in. */
  onFinishEvent: () => void;
  /** Archives the finished event and leaves for the dashboard. */
  onNewEvent: () => void;
}

export default function DoubleElimPanel({
  isAdmin,
  playersCount,
  playerMap,
  bracket,
  eventFinished,
  onGenerate,
  onReport,
  onFinishEvent,
  onNewEvent,
}: DoubleElimPanelProps) {
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
              Lose in the winners' bracket and you drop to the losers' bracket.
              Lose twice and you're out. Seeded by roster order above (player 1
              = top seed). Generating the bracket locks the roster and closes
              registration.
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

  // Null until the grand final is in, and again while a bracket reset it
  // forced is still to be played.
  const championId = doubleEliminationChampion(bracket);

  return (
    <div className="tk-panel">
      <div className="tk-roundbar">
        <div className="tk-roundlabel">
          {eventFinished
            ? 'Event complete'
            : championId
              ? 'Final decided'
              : bracket.grandFinalReset.active
                ? 'Bracket reset to play'
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
      <DoubleBracketView
        bracket={bracket}
        playerMap={playerMap}
        onReport={onReport}
        readOnly={!isAdmin || eventFinished}
      />
    </div>
  );
}
