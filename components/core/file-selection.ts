/** The picker and drag/drop paths use exactly the same content policy. */
export type FileSelectionReason = 'too-large' | 'invalid-type';
export function fileSelectionReason(file: File, accept?: string, maxSize?: number): FileSelectionReason | null {
  if (maxSize !== undefined && file.size > maxSize) {
    return 'too-large';
  }
  if (!accept) {
    return null;
  }
  const allowed = accept.split(',').some((raw) => {
    const value = raw.trim().toLowerCase();
    if (!value) {
      return false;
    }
    if (value.startsWith('.')) {
      return file.name.toLowerCase().endsWith(value);
    }
    if (value.endsWith('/*')) {
      return file.type.toLowerCase().startsWith(value.slice(0, -1));
    }
    return file.type.toLowerCase() === value;
  });
  return allowed ? null : 'invalid-type';
}
