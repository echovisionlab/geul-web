'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { SiteOgBackgroundUploader } from '@/features/site/SiteOgBackgroundUploader/SiteOgBackgroundUploader';
import { getSiteOgStatusAction, regenerateSiteOgImageAction } from '@/lib/actions/site-setting';
import { useOgImage } from '@/lib/hooks/useOgImage';
import { SITE_OG_TARGET_ID } from '@/lib/og-generation-targets';

interface SiteOgImagePanelProps {
  currentBackgroundUrl: string | null;
  automaticGenerationRunId?: string;
}

const SITE_OG_STATUS_QUERY_KEY = ['siteOgStatus'] as const;

export function SiteOgImagePanel({ currentBackgroundUrl, automaticGenerationRunId }: SiteOgImagePanelProps) {
  const tCommonNotifications = useTranslations('common.notifications');
  const queryClient = useQueryClient();
  const queryKey = SITE_OG_STATUS_QUERY_KEY;

  const status = useQuery({
    queryKey,
    queryFn: getSiteOgStatusAction,
  });
  const ogImage = useOgImage({
    entityType: 'site',
    entityId: SITE_OG_TARGET_ID,
    initialOgImageUrl: status.data?.data?.url,
    provider: null,
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
    mutationFn: regenerateSiteOgImageAction,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tCommonNotifications('ogGenerationRequested'), color: 'green' });
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
      <OgImagePreview
        src={ogImage.src}
        canRegenerate
        isRegenerating={regenerate.isPending || ogImage.isRegenerating}
        generationStatus={ogImage.status}
        generationError={ogImage.error}
        onRegenerate={() => regenerate.mutate()}
      />
      <SiteOgBackgroundUploader
        type="site_og_background"
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
