import { describe, expect, it } from 'vitest';
import { normalizeFormPasswordFieldValue } from './password-field';

describe('normalizeFormPasswordFieldValue', () => {
  it('keeps non-empty input as the next password value', () => {
    expect(
      normalizeFormPasswordFieldValue('next-password', {
        hadPassword: true,
        previousValue: '',
      }),
    ).toBe('next-password');
  });

  it('returns an explicit clear sentinel when a persisted password is cleared', () => {
    expect(
      normalizeFormPasswordFieldValue('', {
        hadPassword: true,
        previousValue: null,
      }),
    ).toBe('');
  });

  it('returns an explicit clear sentinel when a typed password is deleted', () => {
    expect(
      normalizeFormPasswordFieldValue('', {
        hadPassword: false,
        previousValue: 'temp-password',
      }),
    ).toBe('');
  });

  it('keeps untouched empty state as null when no password exists', () => {
    expect(
      normalizeFormPasswordFieldValue('', {
        hadPassword: false,
        previousValue: null,
      }),
    ).toBeNull();
  });
});
