import { forwardRef } from 'react';
import type { Player, StandingRow, StandingsMode } from '../engine/tournament';
import { formatEventDate } from '../lib/playerResult';
import PlayerResultDetails from './PlayerResultDetails';
import PlayerResultTitle from './PlayerResultTitle';

interface PlayerResultShareCardProps {
  row: StandingRow;
  playerMap: Record<string, Player>;
  /** Which tiebreakers this event actually ranks on. */
  mode?: StandingsMode;
  eventName?: string;
  /** ISO timestamp; omitted or unparseable simply drops the date. */
  eventDate?: string;
}

/**
 * What actually gets rasterized when someone shares their result.
 *
 * It's the modal's own heading and body — same components, same classes, so it
 * carries whichever theme the viewer is in — plus a footer naming the store,
 * which the modal itself has no reason to show. Building it as its own node
 * rather than screenshotting the live modal is what keeps the close button and
 * the admin "Edit deck" button out of the picture, and it sidesteps the modal's
 * `overflow-y: auto`, which would otherwise crop a long round list to whatever
 * happened to fit on screen.
 *
 * `.tk-share-stage` parks it off-screen. It stays a descendant of `.tk-root`,
 * because that is where the palette's custom properties are declared.
 */
const PlayerResultShareCard = forwardRef<
  HTMLDivElement,
  PlayerResultShareCardProps
>(function PlayerResultShareCard(
  { row, playerMap, mode, eventName, eventDate },
  ref,
) {
  const date = formatEventDate(eventDate);

  return (
    <div className="tk-share-stage" aria-hidden="true">
      <div className="tk-share-card" ref={ref}>
        <div className="tk-share-card-head">
          <PlayerResultTitle
            playerName={row.name}
            player={playerMap[row.id]}
            eventName={eventName}
          />
        </div>
        <PlayerResultDetails row={row} playerMap={playerMap} mode={mode} />
        <div className="tk-share-card-foot">
          <img
            className="tk-share-card-logo"
            src="/logo-kekartuan.png"
            alt=""
          />
          <span className="tk-share-card-brand">
            Kekartuan TCG
            <small>@kekartuantcg</small>
          </span>
          {date && <span className="tk-share-card-date">{date}</span>}
        </div>
      </div>
    </div>
  );
});

export default PlayerResultShareCard;
