interface ResolveLocaleDocumentDisplayFieldInput {
  shouldUseLocaleDocument: boolean;
  isLocaleDocumentSynced: boolean;
  localeDocumentValue: string;
  loadingFallbackValue: string;
  outsideLocaleDocumentValue: string;
}

export function resolveLocaleDocumentDisplayField({
  shouldUseLocaleDocument,
  isLocaleDocumentSynced,
  localeDocumentValue,
  loadingFallbackValue,
  outsideLocaleDocumentValue,
}: ResolveLocaleDocumentDisplayFieldInput): string {
  if (!shouldUseLocaleDocument) {
    return outsideLocaleDocumentValue;
  }

  if (isLocaleDocumentSynced) {
    // After sync, an empty locale-document field is an intentional value.
    return localeDocumentValue;
  }

  return loadingFallbackValue;
}

interface ResolveResidentLocaleFieldInput {
  isSourceLocale: boolean;
  hasLiveRow: boolean;
  sourceValue: string;
  localizedValue: string;
}

/** Selects the value that owns the active room without treating an explicit empty target as missing. */
export function resolveResidentLocaleField({
  isSourceLocale,
  hasLiveRow,
  sourceValue,
  localizedValue,
}: ResolveResidentLocaleFieldInput): string {
  return isSourceLocale || !hasLiveRow ? sourceValue : localizedValue;
}

interface CanEditLocaleDocumentFieldInput {
  hasPermission: boolean;
  shouldUseLocaleDocument: boolean;
  isLocaleDocumentSynced: boolean;
}

/** Locale-owned metadata is writable only after the exact room has reached sync. */
export function canEditLocaleDocumentField({
  hasPermission,
  shouldUseLocaleDocument,
  isLocaleDocumentSynced,
}: CanEditLocaleDocumentFieldInput): boolean {
  return hasPermission && shouldUseLocaleDocument && isLocaleDocumentSynced;
}
