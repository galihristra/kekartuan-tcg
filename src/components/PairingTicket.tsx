import { useState } from 'react';
import type {
  MatchFormat,
  Player,
  SwissMatch,
  MatchResult,
} from '../engine/tournament';
import DeckSprites from './DeckSprites';

interface GameToggleProps {
  close: boolean;
  setClose: (value: boolean) => void;
}

function GameToggle({ close, setClose }: GameToggleProps) {
  return (
    <label className="tk-scoretoggle">
      <input
        type="checkbox"
        checked={close}
        onChange={(e) => setClose(e.target.checked)}
      />
      went to 3 games
    </label>
  );
}

interface PairingTicketProps {
  index: number;
  p1: Player;
  p2: Player;
  match: SwissMatch;
  onReport: (patch: Partial<SwissMatch>) => void;
  readOnly?: boolean;
  /** Best of 1 is one tap on the winner: no draws, no game count. */
  matchFormat?: MatchFormat;
}

export default function PairingTicket({
  index,
  p1,
  p2,
  match,
  onReport,
  readOnly,
  matchFormat = 'bo3',
}: PairingTicketProps) {
  const [close, setClose] = useState(false);
  const decided = !!match.result;
  const bestOf1 = matchFormat === 'bo1';

  const report = (winner: MatchResult) => {
    if (bestOf1)
      return onReport(
        winner === 'p1'
          ? { result: 'p1', p1Games: 1, p2Games: 0 }
          : { result: 'p2', p1Games: 0, p2Games: 1 },
      );
    if (winner === 'draw')
      return onReport({ result: 'draw', p1Games: 1, p2Games: 1 });
    const loserGames = close ? 1 : 0;
    onReport(
      winner === 'p1'
        ? { result: 'p1', p1Games: 2, p2Games: loserGames }
        : { result: 'p2', p1Games: loserGames, p2Games: 2 },
    );
  };

  return (
    <div className="tk-ticket">
      <div className="tk-seed">{String(index + 1).padStart(2, '0')}</div>
      <div>
        <div className="tk-side">
          {readOnly ? (
            <>
              <DeckSprites player={p1} />
              <span className="tk-name">{p1.name}</span>
              <span className="tk-vs">vs</span>
              <DeckSprites player={p2} />
              <span className="tk-name">{p2.name}</span>
            </>
          ) : (
            <>
              <DeckSprites player={p1} />
              <button onClick={() => !decided && report('p1')}>
                <span className="tk-name">{p1.name}</span>
              </button>
              <span className="tk-vs">vs</span>
              <DeckSprites player={p2} />
              <button onClick={() => !decided && report('p2')}>
                <span className="tk-name">{p2.name}</span>
              </button>
            </>
          )}
        </div>
        {!decided && !readOnly && bestOf1 && (
          <div className="tk-hint">Tap the winner</div>
        )}
        {!decided && !readOnly && !bestOf1 && (
          <div className="tk-report">
            <GameToggle close={close} setClose={setClose} />
            <button
              className="tk-btn ghost tk-btn--sm"
              onClick={() => report('draw')}
            >
              Draw
            </button>
          </div>
        )}
        {!decided && readOnly && <div className="tk-hint">Awaiting result</div>}
      </div>
      <div className="tk-result">
        {match.result === 'p1' && (
          <span className="tk-stamp win">
            {p1.name} won{!bestOf1 && ` ${match.p1Games}–${match.p2Games}`}
            {match.forfeited && ' (forfeit)'}
          </span>
        )}
        {match.result === 'p2' && (
          <span className="tk-stamp win">
            {p2.name} won{!bestOf1 && ` ${match.p2Games}–${match.p1Games}`}
            {match.forfeited && ' (forfeit)'}
          </span>
        )}
        {match.result === 'draw' && <span className="tk-stamp draw">Draw</span>}
        {decided && !readOnly && !match.forfeited && (
          <button
            className="tk-btn ghost tk-btn--sm"
            onClick={() => onReport({ result: null, p1Games: 0, p2Games: 0 })}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
