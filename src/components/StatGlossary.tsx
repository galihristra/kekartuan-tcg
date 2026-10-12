import type { StandingRow, StandingsMode } from '../engine/tournament';
import { statGlossary } from '../lib/playerResult';

/** Plain-language meanings for the stat grid above it, folded away until
 *  asked for. Phones never see the standings table's tiebreak columns, or
 *  their tooltips, so this is where a player on one finds out what OMW% is.
 *  Lives in the modal only: the shared result image stays numbers-only. */
export default function StatGlossary({
  row,
  mode,
}: {
  row: StandingRow;
  mode?: StandingsMode;
}) {
  const items = statGlossary(row, mode);
  if (items.length === 0) return null;
  return (
    <details className="tk-perf-glossary">
      <summary>What do these mean?</summary>
      <dl>
        {items.map((i) => (
          <div key={i.label}>
            <dt>{i.label}</dt>
            <dd>{i.text}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
