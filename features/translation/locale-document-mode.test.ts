import { describe, expect, it } from 'vitest';
import { isLocaleDocumentEditable, resolveLocaleDocumentMode, resolveLocaleRoomLocale } from './locale-document-mode';

describe('resolveLocaleDocumentMode', () => {
  it('uses the locale document for the source locale', () => {
    expect(
      resolveLocaleDocumentMode({
        activeLocale: 'ko',
        isSourceLocale: true,
        hasLiveRow: false,
      }),
    ).toEqual({
      isEditingScopedLocale: false,
      hasScopedLocaleLiveRow: false,
      shouldUseLocaleDocument: true,
    });
  });

  it('uses the resident locale document for an existing target', () => {
    expect(
      resolveLocaleDocumentMode({
        activeLocale: 'ja',
        isSourceLocale: false,
        hasLiveRow: true,
      }),
    ).toEqual({
      isEditingScopedLocale: true,
      hasScopedLocaleLiveRow: true,
      shouldUseLocaleDocument: true,
    });
  });

  it('does not open a room when the target locale document is missing', () => {
    expect(
      resolveLocaleDocumentMode({
        activeLocale: 'fr',
        isSourceLocale: false,
        hasLiveRow: false,
      }),
    ).toEqual({
      isEditingScopedLocale: true,
      hasScopedLocaleLiveRow: false,
      shouldUseLocaleDocument: false,
    });
  });

  it('uses the source room as the visible read-only fallback for a missing target', () => {
    expect(
      resolveLocaleRoomLocale({
        activeLocale: 'fr',
        sourceLocale: 'en',
        isSourceLocale: false,
        hasLiveRow: false,
        isSourceLocaleReady: true,
      }),
    ).toBe('en');
  });

  it('uses the selected locale room for source and existing target documents', () => {
    expect(
      resolveLocaleRoomLocale({
        activeLocale: 'en',
        sourceLocale: 'en',
        isSourceLocale: true,
        hasLiveRow: true,
        isSourceLocaleReady: true,
      }),
    ).toBe('en');
    expect(
      resolveLocaleRoomLocale({
        activeLocale: 'ko',
        sourceLocale: 'en',
        isSourceLocale: false,
        hasLiveRow: true,
        isSourceLocaleReady: true,
      }),
    ).toBe('ko');
  });
});

describe('isLocaleDocumentEditable', () => {
  const editableInput = {
    activeLocale: 'ko',
    shouldUseLocaleDocument: true,
    canEditActiveLocale: true,
    isSynced: true,
  };

  it('requires an admitted, synced locale document and edit permission', () => {
    expect(isLocaleDocumentEditable(editableInput)).toBe(true);
    expect(isLocaleDocumentEditable({ ...editableInput, activeLocale: null })).toBe(false);
    expect(isLocaleDocumentEditable({ ...editableInput, shouldUseLocaleDocument: false })).toBe(false);
    expect(isLocaleDocumentEditable({ ...editableInput, canEditActiveLocale: false })).toBe(false);
    expect(isLocaleDocumentEditable({ ...editableInput, isSynced: false })).toBe(false);
  });

  it('treats source and target titles as locale-owned once the exact room is admitted', () => {
    expect(isLocaleDocumentEditable(editableInput)).toBe(true);
  });
});
