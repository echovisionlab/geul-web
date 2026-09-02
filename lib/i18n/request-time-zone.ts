export const DEFAULT_TIME_ZONE = 'UTC';

export function resolveRequestTimeZone(value: string | null | undefined): string {
  const timeZone = value?.trim();
  if (!timeZone) {
    return DEFAULT_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(0);
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}
