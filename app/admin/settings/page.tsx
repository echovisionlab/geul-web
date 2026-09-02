'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PageLoader } from '@/features/site/PageLoader';
import { SiteAssetUploader } from '@/features/site/SiteAssetUploader/SiteAssetUploader';
import { SiteLoaderAssetsUploader } from '@/features/site/SiteLoaderAssetsUploader/SiteLoaderAssetsUploader';
import { SiteOgImagePanel } from '@/features/site/SiteOgImagePanel/SiteOgImagePanel';
import { SiteSettingsForm } from '@/features/site/SiteSettingsForm/SiteSettingsForm';
import { listAllPublishedPagesAdminAction } from '@/lib/actions/admin';
import { updateSiteSettingsAction } from '@/lib/actions/site-setting';
import { listMenus } from '@/lib/queries/menu-browser';
import { getAllSiteSettings } from '@/lib/queries/site-setting-browser';
import type { SiteSettingsPatch } from '@/lib/types/site-setting/config';

export default function AdminSettingsPage() {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminSettings.site');
  const queryClient = useQueryClient();
  const [ogGenerationRunId, setOgGenerationRunId] = useState<string>();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['siteSettings', 'all'],
    queryFn: getAllSiteSettings,
  });
  const { data: pages = [] } = useQuery({
    queryKey: ['pages', 'admin', 'published'],
    queryFn: listAllPublishedPagesAdminAction,
  });
  const { data: menus = [] } = useQuery({
    queryKey: ['menus', 'list'],
    queryFn: listMenus,
  });

  const updateSettings = useMutation({
    mutationFn: updateSiteSettingsAction,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('notifications.saved'), color: 'green' });
      if (result.ogGenerationRunId) {
        setOgGenerationRunId(result.ogGenerationRunId);
      }
      void queryClient.invalidateQueries({ queryKey: ['siteSettings'] });
    },
  });

  if (isLoading || !settings) {
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
        <Stack gap="md">
          <SiteAssetUploader
            type="logo_light"
            currentUrl={settings.logo_light_url ?? settings.logo_url}
            onSuccess={(runId) => {
              if (runId) {
                setOgGenerationRunId(runId);
              }
              refreshSettings();
            }}
          />
          <SiteAssetUploader type="logo_dark" currentUrl={settings.logo_dark_url} onSuccess={refreshSettings} />
          <SiteAssetUploader type="logo_email" currentUrl={settings.logo_email_url} onSuccess={refreshSettings} />
          <SiteAssetUploader type="favicon" currentUrl={settings.favicon_url} onSuccess={refreshSettings} />
          <SiteLoaderAssetsUploader assets={settings.loader_assets} onSuccess={refreshSettings} />
          <SiteOgImagePanel
            currentBackgroundUrl={settings.site_og_background_url}
            automaticGenerationRunId={ogGenerationRunId}
          />
        </Stack>
      }
    />
  );
}
