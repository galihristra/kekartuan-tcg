/** The location as an openable URL, or null if it's a plain venue name.
 *
 *  An explicit http(s) scheme is required. Google Maps share links always carry
 *  one, and guessing at bare `domain/path` strings would turn "Hall A, Level 2"
 *  into a broken link. Restricting the protocol also keeps `javascript:` and
 *  `data:` values out of the href we render. */
export function locationUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return trimmed;
}
