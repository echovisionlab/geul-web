export function getBoundedOgFailureReason(errorCode?: string): string {
  const normalizedCode = errorCode?.trim();
  return normalizedCode && /^[A-Za-z0-9_.-]{1,64}$/.test(normalizedCode)
    ? `OG generation failed (${normalizedCode})`
    : 'OG generation failed';
}
