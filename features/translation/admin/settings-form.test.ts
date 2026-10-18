import { describe, expect, it } from 'vitest';
import {
  buildSettingsUpdateMutation,
  canonicalizeSettingsForm,
  mergeRefreshedSettingsForm,
  preserveSettingsEditsMadeDuringSave,
  settingsFormsEqual,
  toUpdateSettingsRequest,
} from './settings-form';

const baseline = { defaultLocale: 'en', protectedTerms: ['Photoshop', 'React Native'] };

describe('translation settings drafts', () => {
  it('treats blank and exact duplicate protected terms as a canonical no-op', () => {
    const form = canonicalizeSettingsForm({
      defaultLocale: 'en',
      protectedTerms: [' Photoshop', ' Photoshop', 'React Native', '  '],
    });
    expect(buildSettingsUpdateMutation(baseline, form)).toBeNull();
  });

  it('keeps a dirty field while adopting remote changes to untouched fields', () => {
    const incoming = { ...baseline, protectedTerms: ['Remote term'] };
    const merged = mergeRefreshedSettingsForm({ ...baseline, defaultLocale: 'ko' }, baseline, incoming);
    expect(merged).toEqual({ defaultLocale: 'ko', protectedTerms: ['Remote term'] });
    expect(settingsFormsEqual(merged, incoming)).toBe(false);
  });

  it('adopts the server value when the same field changed remotely', () => {
    const incoming = { ...baseline, defaultLocale: 'ja' };
    const merged = mergeRefreshedSettingsForm({ ...baseline, defaultLocale: 'ko' }, baseline, incoming);
    expect(merged).toEqual(incoming);
    expect(settingsFormsEqual(merged, incoming)).toBe(true);
  });

  it('preserves edits made during a save while adopting canonical values for untouched fields', () => {
    const submitted = { ...baseline, defaultLocale: 'ko' };
    expect(
      preserveSettingsEditsMadeDuringSave({ ...submitted, protectedTerms: ['Photoshop', 'draft term'] }, submitted, {
        defaultLocale: 'ja',
        protectedTerms: baseline.protectedTerms,
      }),
    ).toEqual({ defaultLocale: 'ja', protectedTerms: ['Photoshop', 'draft term'] });
  });

  it('sends only canonical protected terms with their observed baseline', () => {
    const mutation = buildSettingsUpdateMutation(
      baseline,
      canonicalizeSettingsForm({
        defaultLocale: 'en',
        protectedTerms: [' Photoshop ', 'Photoshop', 'photoshop', 'React Native'],
      }),
    );
    expect(toUpdateSettingsRequest(mutation!)).toEqual({
      settings: { defaultLocale: '', protectedTerms: ['Photoshop', 'photoshop', 'React Native'] },
      updateMask: { paths: ['protected_terms'] },
      baseSettings: baseline,
    });
  });

  it('builds independent touched-field patches from two stale settings forms', () => {
    const observed = { defaultLocale: 'en', protectedTerms: ['Observed term', 'Remove me'] };
    const localeEdit = buildSettingsUpdateMutation(observed, { ...observed, defaultLocale: 'ko' });
    const termsEdit = buildSettingsUpdateMutation(observed, {
      defaultLocale: 'en',
      protectedTerms: ['Observed term', 'Local addition'],
    });
    expect(localeEdit?.paths).toEqual(['default_locale']);
    expect(termsEdit?.paths).toEqual(['protected_terms']);
    expect(termsEdit?.baseline).toEqual(observed);
    expect(buildSettingsUpdateMutation(observed, { defaultLocale: 'en', protectedTerms: [] })?.paths).toEqual([
      'protected_terms',
    ]);
  });
});
