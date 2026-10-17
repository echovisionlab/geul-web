'use client';

import { PrintHeaderView } from '@/features/shell/ui/PrintHeader';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { toCdnUrl } from '@/lib/utils/file-url';

export function PrintHeader() {
  const { settings } = useSiteSettings();
  // Paper is always light, whatever the screen theme.
  const logoUrl = settings.logo_full_light_url;

  return (
    <PrintHeaderView
      logoSrc={logoUrl ? toCdnUrl(logoUrl) : null}
      logoAlt={settings.site_title || 'Site logo'}
      companyName={settings.company_name || settings.site_title}
      taxId={settings.tax_id || null}
    />
  );
}
