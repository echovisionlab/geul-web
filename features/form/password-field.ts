export function normalizeFormPasswordFieldValue(
  nextValue: string,
  options: {
    hadPassword: boolean;
    previousValue: string | null | undefined;
  },
): string | null {
  if (nextValue !== '') {
    return nextValue;
  }

  if (options.hadPassword || (options.previousValue ?? '') !== '') {
    // Empty string is the explicit "clear persisted password" sentinel.
    return '';
  }

  return null;
}
