import { formatDateTimeInZone, type DateTimeDisplay, type DateTimeValue } from './format';

export interface DateTimeProps {
  value: DateTimeValue | null | undefined;
  locale: string;
  timeZone: string;
  display?: DateTimeDisplay;
  options?: Intl.DateTimeFormatOptions;
  fallback?: string;
}

export function DateTime({ value, locale, timeZone, display = 'date', options, fallback = '-' }: DateTimeProps) {
  if (value == null) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return <time dateTime={date.toISOString()}>{formatDateTimeInZone(date, locale, timeZone, display, options)}</time>;
}
