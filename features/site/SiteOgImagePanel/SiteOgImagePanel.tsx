'use client';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { PageLoader } from '@/features/site/PageLoader';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { getSiteOgStatusAction, regenerateSiteOgImageAction } from '@/lib/actions/site-setting';
import { useOgImage } from '@/lib/hooks/useOgImage';
import { SITE_OG_TARGET_ID } from '@/lib/og-generation-targets';

// The background uploader (drop zone, cropper, upload pipeline) loads with the panel, not with the route,
// so the OG settings page's first load carries only the preview.
const SiteOgBackgroundUploader = dynamic(
  () =>
    import('@/features/site/SiteOgBackgroundUploader/SiteOgBackgroundUploader').then(
      (module) => module.SiteOgBackgroundUploader,
    ),
  { loading: () => <PageLoader placement="flow" /> },
);

export interface SiteOgImageBindings {
  status: typeof getSiteOgStatusAction;
  regenerate: typeof regenerateSiteOgImageAction;
  read: import('@/lib/hooks/useOgImage').OgImageReadBindings;
  asset: import('@/features/site/site-asset-bindings').SiteAssetBindings;
}
interface SiteOgImagePanelProps {
  bindings?: SiteOgImageBindings;
  currentBackgroundUrl: string | null;
  automaticGenerationRunId?: string;
}

const SITE_OG_STATUS_QUERY_KEY = ['siteOgStatus'] as const;

export function SiteOgImagePanel({ currentBackgroundUrl, automaticGenerationRunId, bindings }: SiteOgImagePanelProps) {
  const tCommonNotifications = useTranslations('common.notifications');
  const queryClient = useQueryClient();
  const queryKey = SITE_OG_STATUS_QUERY_KEY;

  const status = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await (bindings?.status ?? getSiteOgStatusAction)();
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    },
  });
  const ogImage = useOgImage({
    entityType: 'site',
    entityId: SITE_OG_TARGET_ID,
    initialOgImageUrl: status.data?.data?.url,
    provider: null,
    readBindings: bindings?.read,
  });

  useEffect(() => {
    if (automaticGenerationRunId) {
      void ogImage.trackLatest();
    }
  }, [automaticGenerationRunId, ogImage.trackLatest]);

  useEffect(() => {
    if (ogImage.readyGenerationId) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [ogImage.readyGenerationId, queryClient, queryKey]);

  const regenerate = useMutation({
    mutationFn: bindings?.regenerate ?? regenerateSiteOgImageAction,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tCommonNotifications('ogGenerationRequested'), tone: 'positive' });
      if (result.generationId) {
        ogImage.trackGeneration(result.generationId);
      } else {
        void ogImage.trackLatest();
      }
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return (
    <MediaPreviewGrid>
      <AuthoringExtension kind="generation">
        {status.isPending ? (
          <PageLoader placement="flow" />
        ) : (
          <>
            <QueryErrorAlert queries={[status]} />
            {status.data && (
              <OgImagePreview
                src={ogImage.src}
                canRegenerate
                isRegenerating={regenerate.isPending || ogImage.isRegenerating}
                generationStatus={ogImage.status}
                generationError={ogImage.error}
                onRegenerate={() => regenerate.mutate()}
              />
            )}
          </>
        )}
      </AuthoringExtension>
      <SiteOgBackgroundUploader
        type="site_og_background"
        bindings={bindings?.asset}
        currentUrl={currentBackgroundUrl}
        onSuccess={(runId) => {
          if (runId) {
            void ogImage.trackLatest();
          }
          queryClient.invalidateQueries({ queryKey });
          queryClient.invalidateQueries({ queryKey: ['siteSettings'] });
        }}
      />
    </MediaPreviewGrid>
  );
}
