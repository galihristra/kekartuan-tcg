import type { MatchFormat, Mode } from '../lib/eventStore';

export const MODE_LABELS: Record<Mode, string> = {
  swiss: 'Swiss',
  league: 'League',
  single: 'Single Elim',
  double: 'Double Elim',
};

export const MATCH_FORMAT_LABELS: Record<MatchFormat, string> = {
  bo1: 'Bo1',
  bo3: 'Bo3',
};

/** The event's format, up by its name where nobody can miss it. Swiss carries
 *  its match format too: Bo1 and Bo3 rank on different tiebreaks, and a wrong
 *  pick only shows up in the standings once the event is over. */
export default function FormatBadge({
  mode,
  matchFormat,
}: {
  mode: Mode;
  matchFormat: MatchFormat;
}) {
  return (
    <span className="tk-format-badge">
      {MODE_LABELS[mode]}
      {mode === 'swiss' && ` · ${MATCH_FORMAT_LABELS[matchFormat]}`}
    </span>
  );
}
