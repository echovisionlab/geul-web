import type { AllSettings } from '@echovisionlab/geul-proto/secure/site_setting_pb.ts';
import type { OgImageConfigs, SiteSettingsView } from '@/lib/types/site-setting/config';
import { assetRefUrl, themedAssetRefUrl } from '@/lib/utils/asset-ref';

export function fromProtoAllSettings(proto: AllSettings): SiteSettingsView {
  const pub = proto.public;
  const runtime = (proto as AllSettings & { runtime?: { siteOrigin?: string } }).runtime;
  const loaderAssets = (pub?.loaderAssets ?? []).flatMap((loader) => {
    const url = assetRefUrl(loader.asset);
    return url ? [{ file_id: loader.fileId, url }] : [];
  });
  const loaderUrls = loaderAssets.map((loader) => loader.url);

  return {
    site_title: pub?.siteTitle ?? '',
    company_name: pub?.companyName ?? '',
    company_address: pub?.companyAddress ?? '',
    tax_id: pub?.taxId ?? '',
    site_origin: runtime?.siteOrigin ?? '',
    legal_email: pub?.legalEmail ?? '',
    support_email: pub?.supportEmail ?? '',
    privacy_email: pub?.privacyEmail ?? '',
    social_links: (pub?.socialLinks ?? {}) as Record<string, string>,
    logo_url: themedAssetRefUrl(pub?.logoLightAsset, pub?.logoDarkAsset),
    logo_light_url: assetRefUrl(pub?.logoLightAsset),
    logo_dark_url: assetRefUrl(pub?.logoDarkAsset),
    logo_email_url: assetRefUrl(pub?.logoEmailAsset),
    favicon_url: assetRefUrl(pub?.faviconAsset),
    loader_urls: loaderUrls,
    loader_assets: loaderAssets,
    site_og_background_url: assetRefUrl(pub?.siteOgBackgroundAsset),
    privacy_og_background_url: assetRefUrl(pub?.privacyOgBackgroundAsset),
    terms_og_background_url: assetRefUrl(pub?.termsOgBackgroundAsset),
    primary_color: pub?.primaryColor ?? '#b02d23',
    default_comments_enabled: pub?.defaultCommentsEnabled ?? true,
    homepage_page_id: pub?.homepagePageId ?? null,
    menu_header_id: pub?.menuHeaderId ?? null,
    menu_secondary_id: pub?.menuSecondaryId ?? null,
    menu_footer_id: pub?.menuFooterId ?? null,
    menu_avatar_dropdown_id: pub?.menuAvatarDropdownId ?? null,
    meta_description: pub?.metaDescription ?? '',
    google_analytics_id: pub?.googleAnalyticsId ?? null,
    og_image_config: (proto.ogImageConfig as unknown as OgImageConfigs) ?? null,
  };
}
