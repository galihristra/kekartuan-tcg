import { useState } from 'react';
import type { Player, StandingRow, StandingsMode } from '../engine/tournament';
import type { Mode } from '../lib/eventStore';
import { formatGameDiff } from '../lib/playerResult';
import DeckSprites from './DeckSprites';
import PlayerPerformanceModal from './PlayerPerformanceModal';

interface TiebreakColumn {
  key: string;
  header: string;
  cell: (r: StandingRow) => string;
}

const TIEBREAK_COLUMNS: Record<StandingsMode, TiebreakColumn[]> = {
  swiss: [
    { key: 'omw', header: 'OMW%', cell: (r) => (r.omw * 100).toFixed(1) },
    { key: 'gw', header: 'GW%', cell: (r) => (r.gw * 100).toFixed(1) },
    { key: 'ogw', header: 'OGW%', cell: (r) => (r.ogw * 100).toFixed(1) },
  ],
  league: [
    {
      key: 'gameDiff',
      header: 'Diff',
      cell: (r) => formatGameDiff(r.gameDiff),
    },
    { key: 'gw', header: 'GW%', cell: (r) => (r.gw * 100).toFixed(1) },
  ],
};

interface StandingsTableProps {
  rows: StandingRow[];
  playerMap: Record<string, Player>;
  /** Which tiebreak columns to show. Non-league modes (single/double elim don't use this table) fall back to Swiss's columns. */
  mode?: Mode;
  /** Titles the performance modal, so a shared screenshot names the event. */
  eventName?: string;
  /** ISO timestamp, dated into the footer of a shared result image. */
  eventDate?: string;
  /** When provided, the performance modal offers an "Edit deck" button. */
  onEditDeck?: (playerId: string) => void;
  /** Organizer-only: settles a tie no result could, by moving one player past
   *  the neighbour they share a place with. */
  onReorderTied?: (playerId: string, direction: 'up' | 'down') => void;
}

export default function StandingsTable({
  rows,
  playerMap,
  mode = 'swiss',
  eventName,
  eventDate,
  onEditDeck,
  onReorderTied,
}: StandingsTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRow = rows.find((r) => r.id === selectedId) ?? null;
  // Single/double elimination don't render this table at all, so anything
  // that isn't a league is ranked by Swiss's tiebreakers.
  const tbMode: StandingsMode = mode === 'league' ? 'league' : 'swiss';
  const columns = TIEBREAK_COLUMNS[tbMode];

  return (
    <div className="tk-table-scroll">
      <table className="tk-standings">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Pts</th>
            <th>W-D-L</th>
            {columns.map((c) => (
              <th key={c.key} className={`tk-col-tb tk-col-${c.key}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const player = playerMap[r.id];
            // Standard competition ranking repeats a shared place on every row
            // that holds it, so only the first of them prints the number.
            const showsRank = i === 0 || rows[i - 1].rank !== r.rank;
            const groupTop = i === 0 || rows[i - 1].tieGroup !== r.tieGroup;
            const groupEnd =
              i === rows.length - 1 || rows[i + 1].tieGroup !== r.tieGroup;
            return (
              <tr
                key={r.id}
                className="tk-standings-row--expandable"
                onClick={() => setSelectedId(r.id)}
              >
                <td className="tk-num">
                  {showsRank ? r.rank : ''}
                  {r.tiebreakNeeded && showsRank && (
                    <span
                      className="tk-standings-tiemark"
                      title="Tied — no tiebreak can separate these players"
                    >
                      =
                    </span>
                  )}
                </td>
                <td>
                  <DeckSprites player={player} />
                  {r.name}
                  {r.manuallyOrdered && (
                    <span
                      className="tk-standings-manual"
                      title="Placed by the organizer: results alone could not separate these players"
                    >
                      set
                    </span>
                  )}
                  <span className="tk-standings-caret"> ›</span>
                  {onReorderTied && r.tieGroup !== null && (
                    <span
                      className="tk-standings-reorder"
                      // The row itself opens the performance modal.
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="tk-btn ghost tk-btn--sm"
                        disabled={groupTop}
                        title="Move above the player tied with them"
                        aria-label={`Move ${r.name} up`}
                        onClick={() => onReorderTied(r.id, 'up')}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="tk-btn ghost tk-btn--sm"
                        disabled={groupEnd}
                        title="Move below the player tied with them"
                        aria-label={`Move ${r.name} down`}
                        onClick={() => onReorderTied(r.id, 'down')}
                      >
                        ↓
                      </button>
                    </span>
                  )}
                </td>
                <td className="tk-num">{r.points}</td>
                <td className="tk-num">
                  {r.wins}-{r.draws}-{r.losses}
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`tk-num tk-col-tb tk-col-${c.key}`}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {selectedRow && (
        <PlayerPerformanceModal
          key={selectedRow.id}
          onClose={() => setSelectedId(null)}
          row={selectedRow}
          playerMap={playerMap}
          mode={tbMode}
          eventName={eventName}
          eventDate={eventDate}
          onEditDeck={
            onEditDeck
              ? () => {
                  // Hand off to the deck editor so the two modals never stack.
                  setSelectedId(null);
                  onEditDeck(selectedRow.id);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
