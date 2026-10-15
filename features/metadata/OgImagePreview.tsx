'use client';

import { useTranslations } from 'next-intl';
import type { OgGenerationUiStatus } from '@/lib/types/og-generation';
import { OG_IMAGE_CSS_ASPECT_RATIO } from '@/lib/constants/og-image';
import { OgImagePreviewView, type OgImagePreviewViewModel } from './ui/OgImagePreviewView';

interface OgImagePreviewProps {
  src?: string;
  canRegenerate?: boolean;
  isRegenerating?: boolean;
  generationStatus?: OgGenerationUiStatus;
  generationError?: string;
  onRegenerate?: () => void;
  sizes?: string;
}

export function OgImagePreview({
  src,
  canRegenerate = false,
  isRegenerating = false,
  generationStatus,
  generationError,
  onRegenerate,
  sizes = '50vw',
}: OgImagePreviewProps) {
  const t = useTranslations('ogImagePreview');
  const tCommonLabels = useTranslations('common.labels');
  const active = generationStatus === 'queued' || generationStatus === 'processing';
  const displayedStatus = generationStatus ?? (generationError ? 'failed' : src ? 'ready' : undefined);
  const isFailure = displayedStatus === 'failed' || displayedStatus === 'cancelled';
  const localizedStatus = displayedStatus ? t(`statuses.${displayedStatus}`) : undefined;
  const statusLabel = localizedStatus ? [localizedStatus, generationError].filter(Boolean).join(': ') : generationError;
  const model: OgImagePreviewViewModel = {
    src,
    sizes,
    aspectRatio: OG_IMAGE_CSS_ASPECT_RATIO,
    headerLabel: tCommonLabels('ogImage'),
    imageAlt: t('alt'),
    emptyLabel: t('empty'),
    actionLabel: t('actions.regenerate'),
    showRegenerate: Boolean(canRegenerate && onRegenerate),
    regenerateLoading: isRegenerating || active,
    status: displayedStatus,
    statusLabel,
    isFailure,
  };

  return <OgImagePreviewView model={model} onRegenerate={onRegenerate} />;
}
