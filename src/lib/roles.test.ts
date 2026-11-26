import { describe, expect, it } from 'vitest';
import { describeRoleError, looksLikeEmail, normalizeEmail } from './roles';
import { isAppRole } from './auth';

describe('normalizeEmail', () => {
  it('trims and lowercases so it matches the table constraint', () => {
    expect(normalizeEmail('  Someone@Gmail.COM ')).toBe('someone@gmail.com');
  });
});

describe('looksLikeEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(looksLikeEmail('a.b@example.co.id')).toBe(true);
  });
  it('rejects obvious typos', () => {
    expect(looksLikeEmail('someone@gmail')).toBe(false);
    expect(looksLikeEmail('someone gmail.com')).toBe(false);
    expect(looksLikeEmail('')).toBe(false);
  });
});

describe('isAppRole', () => {
  it('only accepts the two roles', () => {
    expect(isAppRole('admin')).toBe(true);
    expect(isAppRole('organizer')).toBe(true);
    expect(isAppRole('player')).toBe(false);
    expect(isAppRole(null)).toBe(false);
  });
});

describe('describeRoleError', () => {
  it('surfaces the last-admin guard', () => {
    expect(
      describeRoleError(new Error('At least one admin must remain.')),
    ).toBe('At least one admin must remain.');
  });
  it('falls back to a generic message', () => {
    expect(describeRoleError(new Error('boom'))).toMatch(/didn't go through/);
  });
});
