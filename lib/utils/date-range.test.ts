import { describe, expect, it } from 'vitest';
import { formatDateTimeRange } from './date-range';

const options = { locale: 'en-US', timeZone: 'Asia/Seoul' };

describe('formatDateTimeRange', () => {
  it('states a same-day range once, without seconds', () => {
    expect(formatDateTimeRange(new Date('2026-10-18T11:00:00Z'), new Date('2026-10-18T13:00:00Z'), options)).toMatch(
      /^Oct 18, 2026, 8:00\s?–\s?10:00\sPM$/,
    );
  });

  it('keeps both dates when the range crosses days and drops times for all-day ranges', () => {
    expect(
      formatDateTimeRange(new Date('2026-10-17T15:00:00Z'), new Date('2026-10-19T15:00:00Z'), {
        ...options,
        allDay: true,
      }),
    ).toMatch(/^Oct 18\s?–\s?20, 2026$/);
  });
});
