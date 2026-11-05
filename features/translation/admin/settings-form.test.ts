import { describe, expect, it } from 'vitest';
import {
  buildSettingsUpdateMutation,
  mergeRefreshedSettingsForm,
  preserveSettingsEditsMadeDuringSave,
  settingsFormsEqual,
  toUpdateSettingsRequest,
} from './settings-form';

const baseline = { defaultLocale: 'en' };

describe('translation settings drafts', () => {
  it('sends nothing when the default locale is unchanged', () => {
    expect(buildSettingsUpdateMutation(baseline, { defaultLocale: 'en' })).toBeNull();
  });

  it('keeps a local edit when the server value did not change', () => {
    const merged = mergeRefreshedSettingsForm({ defaultLocale: 'ko' }, baseline, baseline);
    expect(merged).toEqual({ defaultLocale: 'ko' });
    expect(settingsFormsEqual(merged, baseline)).toBe(false);
  });

  it('adopts the server value when the default locale changed remotely', () => {
    const incoming = { defaultLocale: 'ja' };
    const merged = mergeRefreshedSettingsForm({ defaultLocale: 'ko' }, baseline, incoming);
    expect(merged).toEqual(incoming);
    expect(settingsFormsEqual(merged, incoming)).toBe(true);
  });

  it('preserves an edit made during a save and otherwise adopts the saved value', () => {
    const submitted = { defaultLocale: 'ko' };
    expect(preserveSettingsEditsMadeDuringSave({ defaultLocale: 'fr' }, submitted, { defaultLocale: 'ko' })).toEqual({
      defaultLocale: 'fr',
    });
    expect(preserveSettingsEditsMadeDuringSave(submitted, submitted, { defaultLocale: 'ko' })).toEqual(submitted);
  });

  it('masks the default locale in the update request', () => {
    const mutation = buildSettingsUpdateMutation(baseline, { defaultLocale: 'ko' });
    expect(toUpdateSettingsRequest(mutation!)).toEqual({
      settings: { defaultLocale: 'ko' },
      updateMask: { paths: ['default_locale'] },
    });
  });
});
