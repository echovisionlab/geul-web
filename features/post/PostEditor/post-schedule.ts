import { getZonedDateTimeParts, zonedDateTimePartsToInstant } from '@/lib/utils/zoned-date-time';

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

export function instantToScheduleInput(instant: Date, timeZone: string): Date {
  const parts = getZonedDateTimeParts(instant, timeZone);
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
}

export function resolvePostSchedule(localDate: Date, timeZone: string, locale: string): PostScheduleResolution {
  const desired = {
    year: localDate.getFullYear(),
    month: localDate.getMonth() + 1,
    day: localDate.getDate(),
    hour: localDate.getHours(),
    minute: localDate.getMinutes(),
    second: 0,
  };
  const candidate = zonedDateTimePartsToInstant(desired, timeZone);

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
