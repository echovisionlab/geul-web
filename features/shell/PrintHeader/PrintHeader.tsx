'use client';

import { useComputedColorScheme } from '@mantine/core';
import { PrintHeaderView } from '@/features/shell/ui/PrintHeader';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { toCdnUrl } from '@/lib/utils/file-url';
import { selectThemeAssetUrl } from '@/lib/utils/theme-asset';

export function PrintHeader() {
  const { settings } = useSiteSettings();
  const colorScheme = useComputedColorScheme('light');
  const logoUrl = selectThemeAssetUrl(colorScheme, {
    lightUrl: settings.logo_light_url,
    darkUrl: settings.logo_dark_url,
    fallbackUrl: settings.logo_url,
  });

  return (
    <PrintHeaderView
      logoSrc={logoUrl ? toCdnUrl(logoUrl) : null}
      logoAlt={settings.site_title || 'Site logo'}
      companyName={settings.company_name || settings.site_title}
      taxId={settings.tax_id || null}
    />
  );
}
