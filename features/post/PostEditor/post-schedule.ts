import type { DateTimeValue } from '@/components/core/Input/DateTimeInput';
import { getZonedDateTimeParts, zonedDateTimeInputToInstant } from '@/lib/utils/zoned-date-time';

export interface PostScheduleResolution {
  instant: Date;
  timeZone: string;
  localLabel: string;
  utcLabel: string;
}

export function getIanaTimeZoneOptions(preferredTimeZone = 'UTC'): { value: string; label: string }[] {
  const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] })
    .supportedValuesOf;
  const values = supportedValuesOf?.('timeZone') ?? ['UTC'];
  return Array.from(new Set([preferredTimeZone, 'UTC', ...values])).map((value) => ({
    value,
    label: value.replaceAll('_', ' '),
  }));
}

/** Keep wall-clock values independent of the browser's own time zone and DST transitions. */
export function instantToScheduleInput(instant: Date, timeZone: string): DateTimeValue {
  const parts = getZonedDateTimeParts(instant, timeZone);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

export function resolvePostSchedule(
  localDate: DateTimeValue,
  timeZone: string,
  locale: string,
): PostScheduleResolution {
  const candidate = zonedDateTimeInputToInstant(`${localDate.date}T${localDate.time}`, timeZone);

  return {
    instant: candidate,
    timeZone,
    localLabel: new Intl.DateTimeFormat(locale, {
      timeZone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'shortOffset',
    }).format(candidate),
    utcLabel: candidate.toISOString(),
  };
}
