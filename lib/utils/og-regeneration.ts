export function normalizeOgRegenerationLocale(locale: string | null | undefined): string | null {
  const normalized = locale?.trim();
  return normalized || null;
}
