import { afterEach, describe, expect, it } from 'vitest';
import { getSubmissionDateRangeBounds } from './submission-date-range';

const previousTimezone = process.env.TZ;

afterEach(() => {
  if (previousTimezone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = previousTimezone;
  }
});

describe('getSubmissionDateRangeBounds', () => {
  it('turns picker calendar days into local midnight bounds, including the selected end day', () => {
    process.env.TZ = 'America/Los_Angeles';

    expect(getSubmissionDateRangeBounds(['2026-03-08', '2026-03-08'])).toEqual({
      dateFrom: '2026-03-08T08:00:00.000Z',
      dateTo: '2026-03-09T07:00:00.000Z',
    });
  });

  it('uses a Date picker value’s local calendar day and leaves open range ends absent', () => {
    process.env.TZ = 'America/Los_Angeles';
    const pickedDate = new Date(2026, 2, 8, 16);

    expect(getSubmissionDateRangeBounds([pickedDate, null])).toEqual({
      dateFrom: '2026-03-08T08:00:00.000Z',
      dateTo: undefined,
    });
  });

  it('ignores malformed picker values instead of sending an invalid timestamp', () => {
    expect(getSubmissionDateRangeBounds(['2026-02-30', 'not-a-date'])).toEqual({
      dateFrom: undefined,
      dateTo: undefined,
    });
  });
});
