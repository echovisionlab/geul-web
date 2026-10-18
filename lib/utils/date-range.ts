/**
 * A date or date-time range in one locale phrase. `Intl.DateTimeFormat#formatRange` drops the parts
 * both ends share, so a same-day event reads "Oct 18, 2026, 8:00 – 10:00 PM" instead of two full stamps.
 */
export function formatDateTimeRange(
  start: Date,
  end: Date | null,
  { locale, timeZone, allDay = false }: { locale: string; timeZone: string; allDay?: boolean },
): string {
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    ...(allDay ? {} : { timeStyle: 'short' }),
    timeZone,
  });
  return end && end.getTime() !== start.getTime() ? format.formatRange(start, end) : format.format(start);
}
