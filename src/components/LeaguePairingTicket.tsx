import type { Player, SwissMatch } from '../engine/tournament';
import DeckSprites from './DeckSprites';

interface LeaguePairingTicketProps {
  index: number;
  p1: Player;
  p2: Player;
  match: SwissMatch;
  onReportGame: (winner: 'p1' | 'p2') => void;
  onDraw: () => void;
  onEdit: () => void;
  readOnly?: boolean;
}

export default function LeaguePairingTicket({
  index,
  p1,
  p2,
  match,
  onReportGame,
  onDraw,
  onEdit,
  readOnly,
}: LeaguePairingTicketProps) {
  const decided = !!match.result;
  const p1Games = match.p1Games ?? 0;
  const p2Games = match.p2Games ?? 0;
  const gameNumber = p1Games + p2Games + 1;
  // A draw only represents a round timer expiring mid-decider — only offer
  // it once the score is genuinely tied at 1-1.
  const canDraw = p1Games === 1 && p2Games === 1;

  return (
    <div className="tk-ticket">
      <div className="tk-seed">{String(index + 1).padStart(2, '0')}</div>
      <div>
        <div className="tk-side">
          <DeckSprites player={p1} />
          <span className="tk-name">{p1.name}</span>
          <span className="tk-vs">vs</span>
          <DeckSprites player={p2} />
          <span className="tk-name">{p2.name}</span>
        </div>
        {!decided && (
          <div className="tk-hint">
            Games: {p1Games}–{p2Games}
          </div>
        )}
        {!decided && !readOnly && (
          <div className="tk-report">
            <button
              className="tk-btn ghost tk-btn--sm"
              onClick={() => onReportGame('p1')}
            >
              Game {gameNumber}: {p1.name} won
            </button>
            <button
              className="tk-btn ghost tk-btn--sm"
              onClick={() => onReportGame('p2')}
            >
              Game {gameNumber}: {p2.name} won
            </button>
            {canDraw && (
              <button className="tk-btn ghost tk-btn--sm" onClick={onDraw}>
                Call it a draw
              </button>
            )}
          </div>
        )}
        {!decided && readOnly && <div className="tk-hint">Awaiting result</div>}
      </div>
      <div className="tk-result">
        {match.result === 'p1' && (
          <span className="tk-stamp win">
            {p1.name} won {p1Games}–{p2Games}
            {match.forfeited && ' (forfeit)'}
          </span>
        )}
        {match.result === 'p2' && (
          <span className="tk-stamp win">
            {p2.name} won {p2Games}–{p1Games}
            {match.forfeited && ' (forfeit)'}
          </span>
        )}
        {match.result === 'draw' && <span className="tk-stamp draw">Draw</span>}
        {decided && !readOnly && !match.forfeited && (
          <button className="tk-btn ghost tk-btn--sm" onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
