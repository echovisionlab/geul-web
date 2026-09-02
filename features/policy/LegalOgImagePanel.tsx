'use client';

import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { SiteOgBackgroundUploader } from '@/features/site/SiteOgBackgroundUploader/SiteOgBackgroundUploader';
import {
  getLegalOgImageAction,
  regenerateLegalOgImageAction,
  type LegalOgEntityType,
} from '@/lib/actions/site-setting';
import { useOgImage } from '@/lib/hooks/useOgImage';
import { useOgGenerationLookupSignal } from '@/lib/hooks/useOgGenerationLookupSignal';
import { LEGAL_OG_TARGET_IDS } from '@/lib/og-generation-targets';
import type { OgGenerationLookupSignal, OgGenerationRunSignal } from '@/lib/types/og-generation';

interface LegalOgImagePanelProps {
  entityType: LegalOgEntityType;
  locale: string;
  currentBackgroundUrl: string | null;
  sourceTitleGeneration?: OgGenerationLookupSignal | null;
  translationGenerationRun?: OgGenerationRunSignal | null;
}

function assetTypeForEntity(entityType: LegalOgEntityType) {
  return entityType === 'privacy' ? 'privacy_og_background' : 'terms_og_background';
}

export function LegalOgImagePanel({
  entityType,
  locale,
  currentBackgroundUrl,
  sourceTitleGeneration,
  translationGenerationRun,
}: LegalOgImagePanelProps) {
  const tCommonLabels = useTranslations('common.labels');
  const tCommonNotifications = useTranslations('common.notifications');
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['legalOgImage', entityType, locale] as const, [entityType, locale]);

  const status = useQuery({
    queryKey,
    queryFn: () => getLegalOgImageAction(entityType, locale),
  });
  const ogImage = useOgImage({
    entityType,
    entityId: LEGAL_OG_TARGET_IDS[entityType],
    initialOgImageUrl: status.data?.data?.url,
    locale,
    provider: null,
  });
  useOgGenerationLookupSignal(translationGenerationRun, locale, ogImage.trackLatest);
  useOgGenerationLookupSignal(sourceTitleGeneration, locale, ogImage.trackLatest);
  useEffect(() => {
    if (ogImage.readyGenerationId) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [ogImage.readyGenerationId, queryClient, queryKey]);

  const regenerate = useMutation({
    mutationFn: (request: { locale: string; targetKey: string }) =>
      regenerateLegalOgImageAction(entityType, request.locale),
    onSuccess: (result, request) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tCommonNotifications('ogGenerationRequested'), color: 'green' });
      ogImage.trackRequestedGeneration(result.generationId, request.targetKey);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return (
    <SectionCard>
      <Stack gap="md">
        <SectionHeader title={tCommonLabels('ogImage')} />
        <MediaPreviewGrid>
          <OgImagePreview
            src={ogImage.src}
            canRegenerate
            isRegenerating={regenerate.isPending || ogImage.isRegenerating}
            generationStatus={ogImage.status}
            generationError={ogImage.error}
            onRegenerate={() => regenerate.mutate({ locale, targetKey: ogImage.targetKey })}
          />
          <SiteOgBackgroundUploader
            type={assetTypeForEntity(entityType)}
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
      </Stack>
    </SectionCard>
  );
}
