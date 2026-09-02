import { describe, expect, it } from 'vitest';
import {
  getZonedDateTimeParts,
  instantToZonedDateTimeInput,
  zonedDateTimeInputToInstant,
  zonedDateTimePartsToInstant,
} from './zoned-date-time';

describe('zoned date-time conversion', () => {
  it('formats the same instant as a stable wall-clock string in the requested zone', () => {
    const instant = new Date('2026-08-29T02:01:00.000Z');

    expect(instantToZonedDateTimeInput(instant, 'UTC')).toBe('2026-08-29 02:01:00');
    expect(instantToZonedDateTimeInput(instant, 'Asia/Seoul')).toBe('2026-08-29 11:01:00');
  });

  it('resolves a wall-clock string to the matching UTC instant', () => {
    const instant = zonedDateTimeInputToInstant('2026-08-29 11:01:00', 'Asia/Seoul');

    expect(instant.toISOString()).toBe('2026-08-29T02:01:00.000Z');
  });

  it('round-trips instants through zones with daylight-saving offsets', () => {
    const instant = new Date('2026-12-15T14:15:30.000Z');
    const value = instantToZonedDateTimeInput(instant, 'America/New_York');

    expect(value).toBe('2026-12-15 09:15:30');
    expect(zonedDateTimeInputToInstant(value, 'America/New_York')).toEqual(instant);
  });

  it('rejects local times that fall in a daylight-saving gap', () => {
    expect(() => zonedDateTimeInputToInstant('2026-03-08 02:30:00', 'America/New_York')).toThrow('does not exist');
  });

  it('shares the same conversion boundary with post scheduling', () => {
    const parts = getZonedDateTimeParts(new Date('2026-08-05T06:30:00.000Z'), 'Asia/Seoul');

    expect(parts).toEqual({ year: 2026, month: 8, day: 5, hour: 15, minute: 30, second: 0 });
    expect(zonedDateTimePartsToInstant(parts, 'Asia/Seoul').toISOString()).toBe('2026-08-05T06:30:00.000Z');
  });
});
