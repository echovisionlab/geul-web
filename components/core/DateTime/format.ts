export type DateTimeDisplay = 'date' | 'dateTime' | 'time';
export type DateTimeValue = Date | string | number;

export function formatDateTimeInZone(
  value: DateTimeValue,
  locale: string,
  timeZone: string,
  display: DateTimeDisplay,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(value);
  const resolvedOptions = { ...options, timeZone };

  switch (display) {
    case 'date':
      return date.toLocaleDateString(locale, resolvedOptions);
    case 'time':
      return date.toLocaleTimeString(locale, resolvedOptions);
    case 'dateTime':
      return date.toLocaleString(locale, resolvedOptions);
  }
}
