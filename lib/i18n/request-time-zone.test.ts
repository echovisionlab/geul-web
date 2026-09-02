import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME_ZONE, resolveRequestTimeZone } from './request-time-zone';

describe('resolveRequestTimeZone', () => {
  it('keeps a valid request-provided IANA time zone', () => {
    expect(resolveRequestTimeZone('Asia/Seoul')).toBe('Asia/Seoul');
  });

  it.each([null, undefined, '', 'Mars/Olympus_Mons'])('falls back to UTC for %s', (value) => {
    expect(resolveRequestTimeZone(value)).toBe(DEFAULT_TIME_ZONE);
  });
});
