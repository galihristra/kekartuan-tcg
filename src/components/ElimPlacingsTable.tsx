import type { ElimPlacing, Player } from '../engine/tournament';
import { nameOf } from '../lib/bracketHelpers';
import DeckSprites from './DeckSprites';

interface ElimPlacingsTableProps {
  placings: ElimPlacing[];
  playerMap: Record<string, Player>;
  /** Shows a Deck button on each row when provided. */
  onEditDeck?: (playerId: string) => void;
}

/** An elimination event's result: how far each player got. */
export default function ElimPlacingsTable({
  placings,
  playerMap,
  onEditDeck,
}: ElimPlacingsTableProps) {
  return (
    <div className="tk-table-scroll">
      <table className="tk-standings">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            {onEditDeck && <th />}
          </tr>
        </thead>
        <tbody>
          {placings.map((p, i) => {
            // Shared places print once, like the Swiss standings do.
            const showsPlace = i === 0 || placings[i - 1].place !== p.place;
            return (
              <tr key={p.playerId}>
                <td className="tk-num">{showsPlace ? (p.place ?? '—') : ''}</td>
                <td>
                  <DeckSprites player={playerMap[p.playerId]} />
                  {nameOf(playerMap, p.playerId)}
                  {p.place === null && (
                    <span className="tk-hint"> (still in)</span>
                  )}
                </td>
                {onEditDeck && (
                  <td>
                    <button
                      className="tk-btn ghost tk-btn--sm"
                      onClick={() => onEditDeck(p.playerId)}
                    >
                      Deck
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
