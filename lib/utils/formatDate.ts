import { DEFAULT_LOCALE } from '@/lib/i18n/locale';

function formatDate(date: Date | string | null | undefined, locale: string, timeZone: string): string | null {
  if (!date) {
    return null;
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  };

  return new Date(date).toLocaleDateString(locale, defaultOptions);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  date: Date | string | null | undefined,
  locale: string = DEFAULT_LOCALE,
  timeZone = 'UTC',
): string | null {
  if (!date) {
    return null;
  }

  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffDay > 7) {
    return formatDate(date, locale, timeZone);
  } else if (diffDay >= 1) {
    return rtf.format(-diffDay, 'day');
  } else if (diffHour >= 1) {
    return rtf.format(-diffHour, 'hour');
  } else if (diffMin >= 1) {
    return rtf.format(-diffMin, 'minute');
  }
  return rtf.format(-diffSec, 'second');
}
