/**
 * Shared MIME utilities.
 *
 * Keep alias/canonicalization logic in one place so all upload entry points
 * (editor, dropzone, generic upload hooks) enforce the same policy.
 */

const MIME_ALIAS_MAP: Readonly<Record<string, string>> = {
  // Video aliases
  'video/x-quicktime': 'video/quicktime',
  'video/avi': 'video/x-msvideo',
  'video/x-avi': 'video/x-msvideo',
  'video/msvideo': 'video/x-msvideo',
  'application/x-matroska': 'video/x-matroska',
  'video/matroska': 'video/x-matroska',
  'video/mkv': 'video/x-matroska',
  'video/x-mkv': 'video/x-matroska',

  // Audio aliases
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/x-aac': 'audio/aac',
  'audio/m4a': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/mp4a-latm': 'audio/mp4',
  'audio/mp3': 'audio/mpeg',
  'audio/x-flac': 'audio/flac',
  'audio/x-aiff': 'audio/aiff',
  'application/ogg': 'audio/ogg',

  // Image aliases
  'image/jpg': 'image/jpeg',
  'image/x-png': 'image/png',
  'image/vnd.microsoft.icon': 'image/x-icon',

  // Document/archive aliases
  'application/x-zip-compressed': 'application/zip',
};

/**
 * Normalize MIME by removing parameters (e.g. `; charset=utf-8`) and lower-casing.
 */
function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';')[0]?.toLowerCase().trim() ?? '';
}

/**
 * Convert MIME aliases to canonical MIME values.
 */
export function canonicalizeMimeType(mimeType: string): string {
  const normalized = normalizeMimeType(mimeType);
  return MIME_ALIAS_MAP[normalized] ?? normalized;
}

/**
 * Create a Set of canonical MIME strings for O(1) validation checks.
 */
export function createCanonicalMimeSet(mimeTypes: readonly string[]): Set<string> {
  return new Set(mimeTypes.map(canonicalizeMimeType).filter(Boolean));
}

/**
 * Check whether a MIME is allowed using a canonical MIME set.
 */
export function isMimeAllowedInSet(mimeType: string, allowedCanonicalMimeSet: ReadonlySet<string>): boolean {
  const canonicalMime = canonicalizeMimeType(mimeType);
  return canonicalMime !== '' && allowedCanonicalMimeSet.has(canonicalMime);
}
