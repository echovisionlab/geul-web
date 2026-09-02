import { afterEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { instantToZonedDateTimeInput } from '@/lib/utils/zoned-date-time';

const originalTimeZone = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTimeZone;
});

function renderEventDateTime(instant: Date, eventTimeZone: string): string {
  return renderToString(
    <MantineProvider env="test">
      <DateTimePicker label="Starts at" value={instantToZonedDateTimeInput(instant, eventTimeZone)} />
    </MantineProvider>,
  );
}

describe('program event date-time SSR', () => {
  it('produces identical markup when the server and browser have different local time zones', () => {
    const instant = new Date('2026-08-29T02:01:00.000Z');

    process.env.TZ = 'UTC';
    const serverMarkup = renderEventDateTime(instant, 'UTC');
    process.env.TZ = 'Asia/Seoul';
    const browserMarkup = renderEventDateTime(instant, 'UTC');

    expect(serverMarkup).toBe(browserMarkup);
    expect(serverMarkup).toContain('29/08/2026 02:01');
  });
});
