'use client';

import { LayoutGrid as DsLayoutGrid } from '@/components/core/Layout';
import { SettingsGroup } from '@/components/core/Section';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { PageLoader } from '@/features/site/PageLoader';
import { SiteAssetUploader } from '@/features/site/SiteAssetUploader/SiteAssetUploader';
import { SiteLoaderAssetsUploader } from '@/features/site/SiteLoaderAssetsUploader/SiteLoaderAssetsUploader';
import { SiteSettingsForm } from '@/features/site/SiteSettingsForm/SiteSettingsForm';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { listAllPublishedPagesAdminAction } from '@/lib/actions/admin';
import { updateSiteSettingsAction } from '@/lib/actions/site-setting';
import { listMenus } from '@/lib/queries/menu-browser';
import { getAllSiteSettings } from '@/lib/queries/site-setting-browser';
import type { SiteSettingsPatch, SiteSettingsView } from '@/lib/types/site-setting/config';

// Light and dark variants sit side by side from the sm breakpoint.
const DISPLAY_LOGO_SLOTS = ['logo_full_light', 'logo_full_dark', 'logo_symbol_light', 'logo_symbol_dark'] as const;
const EMAIL_LOGO_SLOTS = ['logo_email_light', 'logo_email_dark'] as const;
type LogoSlot = (typeof DISPLAY_LOGO_SLOTS)[number] | (typeof EMAIL_LOGO_SLOTS)[number];

function LogoSlotGrid({
  slots,
  settings,
  bindings,
  onSuccess,
}: {
  slots: readonly LogoSlot[];
  settings: SiteSettingsView;
  bindings: SiteSettingsPageBindings;
  onSuccess: () => void;
}) {
  return (
    <DsLayoutGrid columns={{ base: 1, sm: 2 }} columnGap="lg" rowGap="lg">
      {slots.map((type) => (
        <SiteAssetUploader
          key={type}
          bindings={bindings.asset}
          type={type}
          currentUrl={settings[`${type}_url`]}
          onSuccess={onSuccess}
        />
      ))}
    </DsLayoutGrid>
  );
}

export interface SiteSettingsPageBindings {
  getSettings: typeof getAllSiteSettings;
  getPages: typeof listAllPublishedPagesAdminAction;
  getMenus: typeof listMenus;
  update: typeof updateSiteSettingsAction;
  asset?: import('@/features/site/site-asset-bindings').SiteAssetBindings;
  loader?: import('@/features/site/SiteLoaderAssetsUploader/SiteLoaderAssetsUploader').SiteLoaderBindings;
}
const defaultBindings: SiteSettingsPageBindings = {
  getSettings: getAllSiteSettings,
  getPages: listAllPublishedPagesAdminAction,
  getMenus: listMenus,
  update: updateSiteSettingsAction,
};
export default function SiteSettingsPage({ bindings = defaultBindings }: { bindings?: SiteSettingsPageBindings } = {}) {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminSettings.site');
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['siteSettings', 'all'],
    queryFn: bindings.getSettings,
  });
  const { data: settings, isLoading } = settingsQuery;
  const pagesQuery = useQuery({
    queryKey: ['pages', 'admin', 'published'],
    queryFn: async () => unwrapQueryResult(await bindings.getPages()),
  });
  const { data: pages = [] } = pagesQuery;
  const menusQuery = useQuery({
    queryKey: ['menus', 'list'],
    queryFn: bindings.getMenus,
  });
  const { data: menus = [] } = menusQuery;

  const updateSettings = useMutation({
    mutationFn: bindings.update,
    onError: (error) => notifications.show({ message: error.message, tone: 'danger' }),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('notifications.saved'), tone: 'positive' });
      void queryClient.invalidateQueries({ queryKey: ['siteSettings'] });
    },
  });

  if (settingsQuery.isError || menusQuery.isError || pagesQuery.isError) {
    return <QueryErrorAlert queries={[settingsQuery, menusQuery, pagesQuery]} />;
  }

  if (isLoading || pagesQuery.isLoading || menusQuery.isLoading || !settings) {
    return <PageLoader />;
  }

  const refreshSettings = () => {
    void queryClient.invalidateQueries({ queryKey: ['siteSettings'] });
  };

  const handleSubmit = async (patch: SiteSettingsPatch): Promise<boolean> => {
    const result = await updateSettings.mutateAsync(patch);
    return !result.error;
  };

  return (
    <SiteSettingsForm
      settings={settings}
      saving={updateSettings.isPending}
      onSubmit={handleSubmit}
      pages={pages.map((page) => ({
        value: page.id,
        label: page.title || tCommon('states.untitled'),
      }))}
      menus={menus.map((menu) => ({ value: menu.id, label: menu.name }))}
      branding={
        <>
          <SettingsGroup
            title={tPage('sections.branding.logos')}
            description={tPage('sections.branding.logosDescription')}
          >
            <LogoSlotGrid
              slots={DISPLAY_LOGO_SLOTS}
              settings={settings}
              bindings={bindings}
              onSuccess={refreshSettings}
            />
          </SettingsGroup>
          <SettingsGroup
            title={tPage('sections.branding.emailLogos')}
            description={tPage('sections.branding.emailLogosDescription')}
          >
            <LogoSlotGrid
              slots={EMAIL_LOGO_SLOTS}
              settings={settings}
              bindings={bindings}
              onSuccess={refreshSettings}
            />
          </SettingsGroup>
          <SettingsGroup title={tPage('sections.branding.iconsAndLoader')}>
            <SiteAssetUploader
              bindings={bindings.asset}
              type="favicon"
              currentUrl={settings.favicon_url}
              onSuccess={refreshSettings}
            />
            <SiteLoaderAssetsUploader
              bindings={bindings.loader}
              assets={settings.loader_assets}
              onSuccess={refreshSettings}
            />
          </SettingsGroup>
        </>
      }
    />
  );
}
