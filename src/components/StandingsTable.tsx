import { useState } from 'react';
import type { Player, StandingRow } from '../engine/tournament';
import type { Mode } from '../lib/eventStore';
import DeckSprites from './DeckSprites';
import PlayerPerformanceModal from './PlayerPerformanceModal';

interface TiebreakColumn {
  key: string;
  header: string;
  cell: (r: StandingRow) => string;
}

const TIEBREAK_COLUMNS: Record<'swiss' | 'league', TiebreakColumn[]> = {
  swiss: [
    { key: 'omw', header: 'OMW%', cell: (r) => (r.omw * 100).toFixed(1) },
    { key: 'gw', header: 'GW%', cell: (r) => (r.gw * 100).toFixed(1) },
    { key: 'ogw', header: 'OGW%', cell: (r) => (r.ogw * 100).toFixed(1) },
  ],
  league: [
    {
      key: 'gameDiff',
      header: 'Diff',
      cell: (r) => (r.gameDiff > 0 ? `+${r.gameDiff}` : String(r.gameDiff)),
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
  /** When provided, the performance modal offers an "Edit deck" button. */
  onEditDeck?: (playerId: string) => void;
}

export default function StandingsTable({
  rows,
  playerMap,
  mode = 'swiss',
  eventName,
  onEditDeck,
}: StandingsTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRow = rows.find((r) => r.id === selectedId) ?? null;
  const columns = TIEBREAK_COLUMNS[mode === 'league' ? 'league' : 'swiss'];

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
              <th key={c.key} className="tk-col-tb">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const player = playerMap[r.id];
            return (
              <tr
                key={r.id}
                className="tk-standings-row--expandable"
                onClick={() => setSelectedId(r.id)}
              >
                <td className="tk-num">{i + 1}</td>
                <td>
                  <DeckSprites player={player} />
                  {r.name}
                  <span className="tk-standings-caret"> ›</span>
                </td>
                <td className="tk-num">{r.points}</td>
                <td className="tk-num">
                  {r.wins}-{r.draws}-{r.losses}
                </td>
                {columns.map((c) => (
                  <td key={c.key} className="tk-num tk-col-tb">
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
          eventName={eventName}
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
