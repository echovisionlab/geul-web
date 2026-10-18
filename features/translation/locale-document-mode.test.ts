import { describe, expect, it } from 'vitest';
import { isLocaleDocumentEditable } from './locale-document-mode';

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
});

it('retains admitted local editability during a transient disconnect', () => {
  expect(
    isLocaleDocumentEditable({
      activeLocale: 'en',
      shouldUseLocaleDocument: true,
      canEditActiveLocale: true,
      isSynced: false,
      isReady: true,
    }),
  ).toBe(true);
  expect(
    isLocaleDocumentEditable({
      activeLocale: 'en',
      shouldUseLocaleDocument: true,
      canEditActiveLocale: false,
      isSynced: false,
      isReady: true,
    }),
  ).toBe(false);
});
