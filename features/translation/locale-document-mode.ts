export interface LocaleDocumentModeInput {
  activeLocale: string | null;
  isSourceLocale: boolean;
  hasLiveRow: boolean;
}

export interface LocaleDocumentMode {
  isEditingScopedLocale: boolean;
  hasScopedLocaleLiveRow: boolean;
  shouldUseLocaleDocument: boolean;
}

export interface LocaleRoomSelectionInput extends LocaleDocumentModeInput {
  sourceLocale: string | null;
  isSourceLocaleReady: boolean;
}

export interface LocaleDocumentEditabilityInput {
  activeLocale: string | null;
  shouldUseLocaleDocument: boolean;
  canEditActiveLocale: boolean;
  isSynced: boolean;
}

export function resolveLocaleDocumentMode({
  activeLocale,
  isSourceLocale,
  hasLiveRow,
}: LocaleDocumentModeInput): LocaleDocumentMode {
  const isEditingScopedLocale = Boolean(activeLocale) && !isSourceLocale;
  const hasScopedLocaleLiveRow = isEditingScopedLocale && hasLiveRow;

  return {
    isEditingScopedLocale,
    hasScopedLocaleLiveRow,
    shouldUseLocaleDocument: Boolean(activeLocale) && (isSourceLocale || hasLiveRow),
  };
}

export function resolveLocaleRoomLocale({
  activeLocale,
  sourceLocale,
  isSourceLocale,
  hasLiveRow,
  isSourceLocaleReady,
}: LocaleRoomSelectionInput): string | null {
  if (!isSourceLocaleReady || !activeLocale) {
    return null;
  }

  if (isSourceLocale || hasLiveRow) {
    return activeLocale;
  }

  return sourceLocale;
}

export function isLocaleDocumentEditable({
  activeLocale,
  shouldUseLocaleDocument,
  canEditActiveLocale,
  isSynced,
}: LocaleDocumentEditabilityInput): boolean {
  if (!activeLocale) {
    return false;
  }
  if (!shouldUseLocaleDocument) {
    return false;
  }
  if (!canEditActiveLocale) {
    return false;
  }
  if (!isSynced) {
    return false;
  }
  return true;
}
