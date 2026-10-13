import { describe, expect, it } from 'vitest';
import { instantToScheduleInput, resolvePostSchedule } from './post-schedule';

describe('post schedule time-zone conversion', () => {
  it('persists the UTC instant for the selected IANA zone', () => {
    const localInput = { date: '2026-08-05', time: '15:30' };
    const result = resolvePostSchedule(localInput, 'Asia/Seoul', 'en');

    expect(result.instant.toISOString()).toBe('2026-08-05T06:30:00.000Z');
    expect(result.timeZone).toBe('Asia/Seoul');
    expect(result.localLabel).toContain('2026');
  });

  it('round-trips a stored UTC instant to a wall-clock input', () => {
    const input = instantToScheduleInput(new Date('2026-12-15T14:15:00.000Z'), 'America/New_York');

    expect(input).toEqual({ date: '2026-12-15', time: '09:15' });
  });

  it('preserves a selected zone time even when that wall time is a gap in the browser zone', () => {
    const input = { date: '2026-03-08', time: '02:30' };
    const result = resolvePostSchedule(input, 'Asia/Seoul', 'en');
    expect(result.instant.toISOString()).toBe('2026-03-07T17:30:00.000Z');
    expect(instantToScheduleInput(result.instant, 'Asia/Seoul')).toEqual(input);
  });

  it('rejects a DST gap instead of silently changing the requested wall time', () => {
    const missingTime = { date: '2026-03-08', time: '02:30' };

    expect(() => resolvePostSchedule(missingTime, 'America/New_York', 'en')).toThrow('does not exist');
  });
});
