import type { Player } from '../engine/tournament';
import DeckSprites from './DeckSprites';

interface PlayerResultTitleProps {
  playerName: string;
  player: Player | undefined;
  /** Shown above the player's name so a shared picture of this result says
   *  which event it belongs to. */
  eventName?: string;
  /** The player's place in the standings, printed after "Result" as "#3". */
  rank?: number;
}

/** The sprites-plus-two-lines heading, shared by the modal header and the
 *  share card so both read identically. */
export default function PlayerResultTitle({
  playerName,
  player,
  eventName,
  rank,
}: PlayerResultTitleProps) {
  return (
    <span className="tk-perf-title">
      <DeckSprites player={player} />
      <span className="tk-perf-title-text">
        {eventName?.trim() && (
          <span className="tk-perf-title-event">{eventName.trim()}</span>
        )}
        <span className="tk-perf-title-main">
          {playerName}'s Result
          {/* The dash stays on "Result"'s line, so a wrapped heading never
              starts its next line with it. */}
          {rank !== undefined && (
            <>
              {'\u00a0- '}
              <span className="tk-perf-title-rank">#{rank}</span>
            </>
          )}
        </span>
      </span>
    </span>
  );
}
