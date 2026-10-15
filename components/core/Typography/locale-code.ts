/** UI notation only. API values, locale matching and language tags keep their original values. */
export function formatLocaleCode(code: string): string {
  return code.trim().replaceAll('_', '-').toUpperCase();
}
