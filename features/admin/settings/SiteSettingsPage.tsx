'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { PageLoader } from '@/features/site/PageLoader';
import { SiteAssetUploader } from '@/features/site/SiteAssetUploader/SiteAssetUploader';
import { SiteLoaderAssetsUploader } from '@/features/site/SiteLoaderAssetsUploader/SiteLoaderAssetsUploader';
import { SiteOgImagePanel } from '@/features/site/SiteOgImagePanel/SiteOgImagePanel';
import { SiteSettingsForm } from '@/features/site/SiteSettingsForm/SiteSettingsForm';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { listAllPublishedPagesAdminAction } from '@/lib/actions/admin';
import { updateSiteSettingsAction } from '@/lib/actions/site-setting';
import { listMenus } from '@/lib/queries/menu-browser';
import { getAllSiteSettings } from '@/lib/queries/site-setting-browser';
import type { SiteSettingsPatch } from '@/lib/types/site-setting/config';

export interface SiteSettingsPageBindings {
  getSettings: typeof getAllSiteSettings;
  getPages: typeof listAllPublishedPagesAdminAction;
  getMenus: typeof listMenus;
  update: typeof updateSiteSettingsAction;
  asset?: import('@/features/site/site-asset-bindings').SiteAssetBindings;
  loader?: import('@/features/site/SiteLoaderAssetsUploader/SiteLoaderAssetsUploader').SiteLoaderBindings;
  og?: import('@/features/site/SiteOgImagePanel/SiteOgImagePanel').SiteOgImageBindings;
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
  const [ogGenerationRunId, setOgGenerationRunId] = useState<string>();
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
      if (result.ogGenerationRunId) {
        setOgGenerationRunId(result.ogGenerationRunId);
      }
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
        <DsLayoutStack gap="md">
          <SiteAssetUploader
            bindings={bindings.asset}
            type="logo_light"
            currentUrl={settings.logo_light_url ?? settings.logo_url}
            onSuccess={(runId) => {
              if (runId) {
                setOgGenerationRunId(runId);
              }
              refreshSettings();
            }}
          />
          <SiteAssetUploader
            bindings={bindings.asset}
            type="logo_dark"
            currentUrl={settings.logo_dark_url}
            onSuccess={refreshSettings}
          />
          <SiteAssetUploader
            bindings={bindings.asset}
            type="logo_email"
            currentUrl={settings.logo_email_url}
            onSuccess={refreshSettings}
          />
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
          <SiteOgImagePanel
            bindings={bindings.og}
            currentBackgroundUrl={settings.site_og_background_url}
            automaticGenerationRunId={ogGenerationRunId}
          />
        </DsLayoutStack>
      }
    />
  );
}
