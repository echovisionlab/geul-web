import { describe, expect, it } from 'vitest';
import { instantToScheduleInput, resolvePostSchedule } from './post-schedule';

describe('post schedule time-zone conversion', () => {
  it('persists the UTC instant for the selected IANA zone', () => {
    const localInput = new Date(2026, 7, 5, 15, 30, 47);
    const result = resolvePostSchedule(localInput, 'Asia/Seoul', 'en');

    expect(result.instant.toISOString()).toBe('2026-08-05T06:30:00.000Z');
    expect(result.timeZone).toBe('Asia/Seoul');
    expect(result.localLabel).toContain('2026');
  });

  it('round-trips a stored UTC instant to a wall-clock input', () => {
    const input = instantToScheduleInput(new Date('2026-12-15T14:15:00.000Z'), 'America/New_York');

    expect(input.getFullYear()).toBe(2026);
    expect(input.getMonth()).toBe(11);
    expect(input.getDate()).toBe(15);
    expect(input.getHours()).toBe(9);
    expect(input.getMinutes()).toBe(15);
  });

  it('rejects a DST gap instead of silently changing the requested wall time', () => {
    const missingTime = new Date(2026, 2, 8, 2, 30);

    expect(() => resolvePostSchedule(missingTime, 'America/New_York', 'en')).toThrow('does not exist');
  });
});
