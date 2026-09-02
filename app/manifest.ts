import type { MetadataRoute } from 'next';
import { getPublicSettings } from '@/lib/queries/manifest';
import { buildWebAppManifest } from '@/lib/utils/site-application-metadata';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getPublicSettings();

  return buildWebAppManifest({
    siteTitle: settings.site_title,
    primaryColor: settings.primary_color,
    faviconAssetSet: settings.favicon_asset_set,
  });
}
