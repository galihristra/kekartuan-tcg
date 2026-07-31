import { describe, it, expect } from 'vitest';
import { locationUrl } from './eventLocation';

describe('locationUrl', () => {
  it('accepts an https link', () => {
    expect(locationUrl('https://maps.app.goo.gl/xY3k')).toBe(
      'https://maps.app.goo.gl/xY3k',
    );
  });

  it('accepts a plain http link', () => {
    expect(locationUrl('http://example.com/venue')).toBe(
      'http://example.com/venue',
    );
  });

  it('trims surrounding whitespace from a pasted link', () => {
    expect(locationUrl('  https://maps.app.goo.gl/xY3k \n')).toBe(
      'https://maps.app.goo.gl/xY3k',
    );
  });

  it('preserves the link exactly rather than normalising it', () => {
    // The same string is handed to the clipboard, so a silently added trailing
    // slash would mean copy and open disagree about what the location is.
    expect(locationUrl('https://example.com')).toBe('https://example.com');
  });

  it('treats a venue name as plain text', () => {
    expect(locationUrl('Hall A, Grand Indonesia 2F')).toBeNull();
  });

  it('does not guess at a scheme-less domain', () => {
    expect(locationUrl('maps.app.goo.gl/xY3k')).toBeNull();
  });

  it('rejects non-http schemes', () => {
    expect(locationUrl('javascript:alert(1)')).toBeNull();
    expect(locationUrl('data:text/html,<b>hi</b>')).toBeNull();
    expect(locationUrl('mailto:organizer@example.com')).toBeNull();
  });

  it('treats blank and whitespace-only as unset', () => {
    expect(locationUrl('')).toBeNull();
    expect(locationUrl('   ')).toBeNull();
  });
});
