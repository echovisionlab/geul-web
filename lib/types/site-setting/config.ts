import type { SocialLinks } from '@/lib/types/common/social-links';

// OG Image configuration for homepage (logo-centered, no title)
export interface HomeOgImageConfig {
  darkBackground: string;
  logo: {
    width: number;
    height: number;
  };
  // Fallback when no logo is set
  siteTitle: {
    fontSize: number;
    fontWeight: number;
    color: string;
  };
}

// OG Image configuration for content (post/page/work)
export interface ContentOgImageConfig {
  darkBackground: string;
  title: {
    maxLength: number;
    fontSizeThreshold: number;
    fontSizeLarge: number;
    fontSizeSmall: number;
    fontWeight: number;
    color: string;
    lineHeight: number;
    padding: { top: number; right: number; bottom: number; left: number };
  };
  logo: {
    width: number;
    height: number;
    position: { bottom: number; right: number };
  };
  siteTitle: {
    fontSize: number;
    fontWeight: number;
    color: string;
    opacity: number;
  };
}

// Combined OG Image configurations
export interface OgImageConfigs {
  home: HomeOgImageConfig;
  content: ContentOgImageConfig;
}

/** Values managed by the generic /admin/settings form and SetMany RPC. */
export interface SiteSettingsFormValues {
  // General
  site_title: string;

  // Company / Business Info
  company_name: string;
  company_address: string;
  tax_id: string;
  legal_email: string;
  support_email: string;
  privacy_email: string;
  social_links: SocialLinks;

  // Branding
  primary_color: string;

  // Reading
  default_comments_enabled: boolean;
  homepage_page_id: string | null;

  // Navigation Menus (references to menu table)
  menu_header_id: string | null;
  menu_secondary_id: string | null;
  menu_footer_id: string | null;
  menu_avatar_dropdown_id: string | null;

  // SEO
  meta_description: string;
  google_analytics_id: string | null;
}

/** Read-only asset projections returned by GetSettings. */
export interface SiteSettingsAssetView {
  logo_url: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  logo_email_url: string | null;
  favicon_url: string | null;
  loader_urls: string[];
  loader_assets: SiteLoaderAsset[];
  site_og_background_url: string | null;
  privacy_og_background_url: string | null;
  terms_og_background_url: string | null;
}

/** Read-only deployment configuration projected by GetSettings/Manifest. */
export interface SiteSettingsRuntimeView {
  site_origin: string;
}

/** Complete admin read model. It is never accepted as a generic mutation payload. */
export interface SiteSettingsView extends SiteSettingsFormValues, SiteSettingsAssetView, SiteSettingsRuntimeView {
  // OG Image
  og_image_config: OgImageConfigs | null;
}

export type SiteSettingsPatch = Partial<SiteSettingsFormValues>;

export const SITE_SETTINGS_FORM_KEYS = [
  'site_title',
  'company_name',
  'company_address',
  'tax_id',
  'legal_email',
  'support_email',
  'privacy_email',
  'social_links',
  'primary_color',
  'default_comments_enabled',
  'homepage_page_id',
  'menu_header_id',
  'menu_secondary_id',
  'menu_footer_id',
  'menu_avatar_dropdown_id',
  'meta_description',
  'google_analytics_id',
] as const satisfies readonly (keyof SiteSettingsFormValues)[];

export interface SiteLoaderAsset {
  file_id: string;
  url: string;
}

// Default values for all settings
export const DEFAULT_SITE_SETTINGS_FORM_VALUES: SiteSettingsFormValues = {
  // General
  site_title: '',

  // Company / Business Info
  company_name: '',
  company_address: '',
  tax_id: '',
  legal_email: '',
  support_email: '',
  privacy_email: '',
  social_links: {},

  // Branding
  primary_color: '#b02d23',

  // Reading
  default_comments_enabled: true,
  homepage_page_id: null,

  // Navigation Menus
  menu_header_id: null,
  menu_secondary_id: null,
  menu_footer_id: null,
  menu_avatar_dropdown_id: null,

  // SEO
  meta_description: '',
  google_analytics_id: null,
};

export const DEFAULT_SITE_SETTINGS_VIEW: SiteSettingsView = {
  ...DEFAULT_SITE_SETTINGS_FORM_VALUES,
  site_origin: '',
  logo_url: null,
  logo_light_url: null,
  logo_dark_url: null,
  logo_email_url: null,
  favicon_url: null,
  loader_urls: [],
  loader_assets: [],
  site_og_background_url: null,
  privacy_og_background_url: null,
  terms_og_background_url: null,
  og_image_config: null,
};

// Public settings that are safe to expose to the client
// Excludes admin-only fields
export type PublicSettingKey =
  | 'site_title'
  | 'company_name'
  | 'company_address'
  | 'tax_id'
  | 'site_origin'
  | 'legal_email'
  | 'support_email'
  | 'privacy_email'
  | 'social_links'
  | 'logo_url'
  | 'logo_light_url'
  | 'logo_dark_url'
  | 'logo_email_url'
  | 'favicon_url'
  | 'loader_urls'
  | 'site_og_background_url'
  | 'privacy_og_background_url'
  | 'terms_og_background_url'
  | 'primary_color'
  | 'default_comments_enabled'
  | 'homepage_page_id'
  | 'menu_header_id'
  | 'menu_secondary_id'
  | 'menu_footer_id'
  | 'menu_avatar_dropdown_id'
  | 'meta_description'
  | 'google_analytics_id';
export type PublicSettings = Pick<SiteSettingsView, PublicSettingKey>;

// Default public settings
export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  site_title: DEFAULT_SITE_SETTINGS_VIEW.site_title,
  company_name: DEFAULT_SITE_SETTINGS_VIEW.company_name,
  company_address: DEFAULT_SITE_SETTINGS_VIEW.company_address,
  tax_id: DEFAULT_SITE_SETTINGS_VIEW.tax_id,
  site_origin: DEFAULT_SITE_SETTINGS_VIEW.site_origin,
  legal_email: DEFAULT_SITE_SETTINGS_VIEW.legal_email,
  support_email: DEFAULT_SITE_SETTINGS_VIEW.support_email,
  privacy_email: DEFAULT_SITE_SETTINGS_VIEW.privacy_email,
  social_links: DEFAULT_SITE_SETTINGS_VIEW.social_links,
  logo_url: DEFAULT_SITE_SETTINGS_VIEW.logo_url,
  logo_light_url: DEFAULT_SITE_SETTINGS_VIEW.logo_light_url,
  logo_dark_url: DEFAULT_SITE_SETTINGS_VIEW.logo_dark_url,
  logo_email_url: DEFAULT_SITE_SETTINGS_VIEW.logo_email_url,
  favicon_url: DEFAULT_SITE_SETTINGS_VIEW.favicon_url,
  loader_urls: DEFAULT_SITE_SETTINGS_VIEW.loader_urls,
  site_og_background_url: DEFAULT_SITE_SETTINGS_VIEW.site_og_background_url,
  privacy_og_background_url: DEFAULT_SITE_SETTINGS_VIEW.privacy_og_background_url,
  terms_og_background_url: DEFAULT_SITE_SETTINGS_VIEW.terms_og_background_url,
  primary_color: DEFAULT_SITE_SETTINGS_VIEW.primary_color,
  default_comments_enabled: DEFAULT_SITE_SETTINGS_VIEW.default_comments_enabled,
  homepage_page_id: DEFAULT_SITE_SETTINGS_VIEW.homepage_page_id,
  menu_header_id: DEFAULT_SITE_SETTINGS_VIEW.menu_header_id,
  menu_secondary_id: DEFAULT_SITE_SETTINGS_VIEW.menu_secondary_id,
  menu_footer_id: DEFAULT_SITE_SETTINGS_VIEW.menu_footer_id,
  menu_avatar_dropdown_id: DEFAULT_SITE_SETTINGS_VIEW.menu_avatar_dropdown_id,
  meta_description: DEFAULT_SITE_SETTINGS_VIEW.meta_description,
  google_analytics_id: DEFAULT_SITE_SETTINGS_VIEW.google_analytics_id,
};
