import { describe, it, expect } from 'vitest';
import { EVENT_SLUG_MAX_LENGTH, slugify } from './eventStore';

describe('slugify', () => {
  it('turns an event name into a dashed slug', () => {
    expect(slugify('Mini League Event September')).toBe(
      'mini-league-event-september',
    );
  });

  it('collapses runs of punctuation and spaces into one dash', () => {
    expect(slugify('Late Night Live — 29 Juli!!')).toBe(
      'late-night-live-29-juli',
    );
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  ...Deck training...  ')).toBe('deck-training');
  });

  it('keeps accented letters as their base letter', () => {
    expect(slugify('Café Tourney')).toBe('cafe-tourney');
  });

  it('returns empty for a name with nothing slug-worthy in it', () => {
    // Real data has a blank event name, so callers must handle this.
    expect(slugify('')).toBe('');
    expect(slugify('!!!')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('caps length and never ends on a dash after truncating', () => {
    const slug = slugify('a'.repeat(70) + ' ' + 'b'.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(EVENT_SLUG_MAX_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('is idempotent, so re-saving an unchanged slug is a no-op', () => {
    const once = slugify('Pitmonster GYM');
    expect(slugify(once)).toBe(once);
  });

  it('matches the shape the events_slug_check constraint enforces', () => {
    const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const name of [
      'Mini Tourney Tanggal Merah',
      'Gangga Monster Ler Gym',
      'Event 2026-08-26',
      'Deck training',
    ]) {
      expect(slugify(name)).toMatch(pattern);
    }
  });
});
