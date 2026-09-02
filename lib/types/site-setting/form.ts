import {
  SITE_SETTINGS_FORM_KEYS,
  type SiteSettingsFormValues,
  type SiteSettingsView,
} from '@/lib/types/site-setting/config';
import { extractChangedFields } from '@/lib/utils/form-diff';

const SITE_SETTINGS_FORM_KEY_SET = new Set<string>(SITE_SETTINGS_FORM_KEYS);

export function isSiteSettingsPatch(value: unknown): value is Partial<SiteSettingsFormValues> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([key, settingValue]) => SITE_SETTINGS_FORM_KEY_SET.has(key) && settingValue !== undefined,
  );
}

export function toSiteSettingsFormValues(settings: SiteSettingsView): SiteSettingsFormValues {
  return {
    site_title: settings.site_title,
    company_name: settings.company_name,
    company_address: settings.company_address,
    tax_id: settings.tax_id,
    legal_email: settings.legal_email,
    support_email: settings.support_email,
    privacy_email: settings.privacy_email,
    social_links: settings.social_links,
    primary_color: settings.primary_color,
    default_comments_enabled: settings.default_comments_enabled,
    homepage_page_id: settings.homepage_page_id,
    menu_header_id: settings.menu_header_id,
    menu_secondary_id: settings.menu_secondary_id,
    menu_footer_id: settings.menu_footer_id,
    menu_avatar_dropdown_id: settings.menu_avatar_dropdown_id,
    meta_description: settings.meta_description,
    google_analytics_id: settings.google_analytics_id,
  };
}

export interface SiteSettingsFormRefresh {
  baseline: SiteSettingsFormValues;
  values: SiteSettingsFormValues;
  shouldReplaceValues: boolean;
}

/**
 * Refresh derived asset projections without discarding a dirty writable form.
 * Pristine forms may adopt concurrently updated writable settings.
 */
export function resolveSiteSettingsFormRefresh(
  currentValues: SiteSettingsFormValues,
  baseline: SiteSettingsFormValues | null,
  incoming: SiteSettingsView,
): SiteSettingsFormRefresh {
  const incomingValues = toSiteSettingsFormValues(incoming);
  const isDirty = baseline !== null && Object.keys(extractChangedFields(baseline, currentValues)).length > 0;

  if (baseline && isDirty) {
    return {
      baseline,
      values: currentValues,
      shouldReplaceValues: false,
    };
  }

  return {
    baseline: incomingValues,
    values: incomingValues,
    shouldReplaceValues: true,
  };
}
