'use client';

import { useMemo } from 'react';
import {
  DateTime as CoreDateTime,
  formatDateTimeInZone,
  type DateTimeProps as CoreDateTimeProps,
  type DateTimeValue,
} from '@/components/core/DateTime';
import { useLocale } from '@/lib/providers/LocaleProvider';
import { useRequestTimeZone } from '@/lib/providers/RequestTimeZoneProvider';

export interface DateTimeProps extends Omit<CoreDateTimeProps, 'locale' | 'timeZone'> {
  timeZone?: string;
}

export function useDateTimeFormatter(timeZoneOverride?: string) {
  const locale = useLocale();
  const requestTimeZone = useRequestTimeZone();
  const timeZone = timeZoneOverride ?? requestTimeZone;

  return useMemo(
    () => ({
      date: (value: DateTimeValue, options?: Intl.DateTimeFormatOptions) =>
        formatDateTimeInZone(value, locale, timeZone, 'date', options),
      dateTime: (value: DateTimeValue, options?: Intl.DateTimeFormatOptions) =>
        formatDateTimeInZone(value, locale, timeZone, 'dateTime', options),
      time: (value: DateTimeValue, options?: Intl.DateTimeFormatOptions) =>
        formatDateTimeInZone(value, locale, timeZone, 'time', options),
      timeZone,
    }),
    [locale, timeZone],
  );
}

export function DateTime({ timeZone: timeZoneOverride, ...props }: DateTimeProps) {
  const locale = useLocale();
  const requestTimeZone = useRequestTimeZone();

  return <CoreDateTime {...props} locale={locale} timeZone={timeZoneOverride ?? requestTimeZone} />;
}
