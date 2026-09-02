export function normalizeProtectedTerms(terms: readonly string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}
