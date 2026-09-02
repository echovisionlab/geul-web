import { describe, expect, it } from 'vitest';
import { COMMON_TIMEZONES, getTimezoneLabel } from './timezone';

describe('timezone utilities', () => {
  it('keeps common timezone options available for user selection', () => {
    expect(COMMON_TIMEZONES).toContainEqual({
      value: 'Asia/Seoul',
      label: 'Asia/Seoul (KST)',
      country: 'KR',
      offset: '+09:00',
    });
    expect(COMMON_TIMEZONES.at(-1)).toEqual({
      value: 'UTC',
      label: 'UTC',
      country: '',
      offset: '+00:00',
    });
  });

  it('returns a known timezone label or the raw timezone', () => {
    expect(getTimezoneLabel('Europe/London')).toBe('Europe/London (GMT/BST)');
    expect(getTimezoneLabel('Mars/Olympus_Mons')).toBe('Mars/Olympus_Mons');
  });
});
