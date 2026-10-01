/** Coalesced changes retain their earliest observed baseline and latest desired values. */
export function mergeMetadataPatches<T extends object>(pending: T, next: T): T {
  const first = pending as Record<string, unknown>;
  const last = next as Record<string, unknown>;
  const observed = { ...(last.observed as object | undefined), ...(first.observed as object | undefined) };
  return { ...pending, ...next, ...(Object.keys(observed).length ? { observed } : {}) };
}
