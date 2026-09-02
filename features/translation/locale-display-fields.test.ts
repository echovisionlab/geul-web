import { describe, expect, it } from 'vitest';
import {
  canEditLocaleDocumentField,
  resolveLocaleDocumentDisplayField,
  resolveResidentLocaleField,
} from './locale-display-fields';

describe('resolveLocaleDocumentDisplayField', () => {
  it('keeps a synced empty locale-document value instead of falling back', () => {
    expect(
      resolveLocaleDocumentDisplayField({
        shouldUseLocaleDocument: true,
        isLocaleDocumentSynced: true,
        localeDocumentValue: '',
        loadingFallbackValue: 'Original title',
        outsideLocaleDocumentValue: 'Original title',
      }),
    ).toBe('');
  });

  it('uses the loading fallback while the locale document is still syncing', () => {
    expect(
      resolveLocaleDocumentDisplayField({
        shouldUseLocaleDocument: true,
        isLocaleDocumentSynced: false,
        localeDocumentValue: '',
        loadingFallbackValue: 'Initial title',
        outsideLocaleDocumentValue: 'Query title',
      }),
    ).toBe('Initial title');
  });

  it('uses the active non-locale-document value outside locale-document mode', () => {
    expect(
      resolveLocaleDocumentDisplayField({
        shouldUseLocaleDocument: false,
        isLocaleDocumentSynced: false,
        localeDocumentValue: 'Ignored live title',
        loadingFallbackValue: 'Initial title',
        outsideLocaleDocumentValue: 'Preview title',
      }),
    ).toBe('Preview title');
  });

  it('preserves an existing target room explicit empty value', () => {
    expect(
      resolveResidentLocaleField({
        isSourceLocale: false,
        hasLiveRow: true,
        sourceValue: 'Source subject',
        localizedValue: '',
      }),
    ).toBe('');
  });

  it('uses source fallback only while a target locale row is missing', () => {
    expect(
      resolveResidentLocaleField({
        isSourceLocale: false,
        hasLiveRow: false,
        sourceValue: 'Source subject',
        localizedValue: '',
      }),
    ).toBe('Source subject');
  });

  it('keeps locale-owned metadata read-only until the exact room is synced', () => {
    expect(
      canEditLocaleDocumentField({
        hasPermission: true,
        shouldUseLocaleDocument: true,
        isLocaleDocumentSynced: false,
      }),
    ).toBe(false);
    expect(
      canEditLocaleDocumentField({
        hasPermission: true,
        shouldUseLocaleDocument: true,
        isLocaleDocumentSynced: true,
      }),
    ).toBe(true);
  });
});
