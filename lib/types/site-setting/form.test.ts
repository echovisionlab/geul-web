import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_SETTINGS_VIEW, type SiteSettingsView } from '@/lib/types/site-setting/config';
import {
  isSiteSettingsPatch,
  resolveSiteSettingsFormRefresh,
  toSiteSettingsFormValues,
} from '@/lib/types/site-setting/form';

function settings(overrides: Partial<SiteSettingsView> = {}): SiteSettingsView {
  return {
    ...DEFAULT_SITE_SETTINGS_VIEW,
    site_title: 'Example Studio',
    logo_light_url: 'https://cdn.example.com/logo-old.svg',
    loader_urls: ['https://cdn.example.com/loader-old.gif'],
    ...overrides,
  };
}

describe('site settings form boundary', () => {
  it('projects only writable values from the admin read model', () => {
    const values = toSiteSettingsFormValues(settings());

    expect(values).toMatchObject({
      site_title: 'Example Studio',
      primary_color: '#b02d23',
    });
    expect(values).not.toHaveProperty('logo_light_url');
    expect(values).not.toHaveProperty('loader_urls');
    expect(values).not.toHaveProperty('loader_assets');
    expect(values).not.toHaveProperty('og_image_config');
  });

  it('keeps dirty writable values when an asset refresh changes only derived projections', () => {
    const initialView = settings();
    const baseline = toSiteSettingsFormValues(initialView);
    const current = { ...baseline, site_title: 'Unsaved title' };
    const refreshedView = settings({
      logo_light_url: 'https://cdn.example.com/logo-new.svg',
      loader_urls: ['https://cdn.example.com/loader-new.gif'],
    });

    expect(resolveSiteSettingsFormRefresh(current, baseline, refreshedView)).toEqual({
      baseline,
      values: current,
      shouldReplaceValues: false,
    });
  });

  it('adopts refreshed writable values when the form is pristine', () => {
    const initialView = settings();
    const baseline = toSiteSettingsFormValues(initialView);
    const refreshedView = settings({ site_title: 'Updated elsewhere' });
    const refreshed = resolveSiteSettingsFormRefresh(baseline, baseline, refreshedView);

    expect(refreshed.shouldReplaceValues).toBe(true);
    expect(refreshed.values.site_title).toBe('Updated elsewhere');
    expect(refreshed.baseline).toEqual(refreshed.values);
  });

  it('accepts only defined writable settings from a SetMany patch', () => {
    expect(isSiteSettingsPatch({ site_title: 'Allowed' })).toBe(true);
    expect(isSiteSettingsPatch({ future_setting: 'not-writable' })).toBe(false);
    expect(isSiteSettingsPatch({ site_title: undefined })).toBe(false);
    expect(isSiteSettingsPatch(null)).toBe(false);
    expect(isSiteSettingsPatch([])).toBe(false);
  });
});
