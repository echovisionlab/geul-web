'use client';
import { VisuallyHidden, Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconRefresh,
} from '@tabler/icons-react';
import { Spinner as Loader } from '@/components/core/Display';
import { IconButton } from '@/components/core/IconButton';
import { ImagePreviewFrame, ImagePreviewHeader } from '@/components/core/ImageUpload';
import { Tooltip } from '@/components/core/Tooltip';
export type OgImagePreviewStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'superseded' | 'cancelled';
export interface OgImagePreviewViewModel {
  src?: string;
  sizes: string;
  aspectRatio: string;
  headerLabel: string;
  imageAlt: string;
  emptyLabel: string;
  actionLabel: string;
  showRegenerate: boolean;
  regenerateLoading: boolean;
  status?: OgImagePreviewStatus;
  statusLabel?: string;
  isFailure: boolean;
}
interface OgImagePreviewViewProps {
  model: OgImagePreviewViewModel;
  onRegenerate?: () => void;
}
const statusColors: Record<OgImagePreviewStatus, import('@/components/core/Typography').TextTone> = {
  queued: 'secondary',
  processing: 'accent',
  ready: 'positive',
  failed: 'danger',
  superseded: 'secondary',
  cancelled: 'secondary',
};
function GenerationStatusIcon({ status }: { status: OgImagePreviewStatus }) {
  const iconProps = {
    size: '1em',
    stroke: 1.8,
    'aria-hidden': true,
  };
  switch (status) {
    case 'queued':
      return <IconClock {...iconProps} data-testid="og-generation-icon-queued" />;
    case 'processing':
      return <Loader size="xs" tone="neutral" data-testid="og-generation-icon-processing" aria-hidden />;
    case 'ready':
      return <IconCircleCheck {...iconProps} data-testid="og-generation-icon-ready" />;
    case 'failed':
      return <IconAlertCircle {...iconProps} data-testid="og-generation-icon-failed" />;
    case 'superseded':
      return <IconArrowsExchange {...iconProps} data-testid="og-generation-icon-superseded" />;
    case 'cancelled':
      return <IconCircleX {...iconProps} data-testid="og-generation-icon-cancelled" />;
  }
}
export function OgImagePreviewView({ model, onRegenerate }: OgImagePreviewViewProps) {
  const [liveStatus, setLiveStatus] = useState('');
  const [statusTooltipOpened, setStatusTooltipOpened] = useState(false);
  useEffect(() => {
    setLiveStatus(model.statusLabel ?? '');
    setStatusTooltipOpened(false);
  }, [model.statusLabel]);
  return (
    <DsLayoutStack gap="xxs">
      <ImagePreviewHeader
        label={model.headerLabel}
        testId="og-image-header"
        actions={
          <DsLayoutInline gap="xxs" wrap="nowrap" data-testid="og-image-header-actions">
            <VisuallyHidden
              data-testid="og-generation-live-status"
              role="status"
              aria-live={model.isFailure ? 'assertive' : 'polite'}
              aria-atomic="true"
            >
              {liveStatus}
            </VisuallyHidden>
            {model.showRegenerate && onRegenerate ? (
              <Tooltip label={model.actionLabel}>
                <IconButton
                  emphasis="low"
                  size="xs"
                  onClick={onRegenerate}
                  loading={model.regenerateLoading}
                  aria-label={model.actionLabel}
                >
                  <IconRefresh size="1em" />
                </IconButton>
              </Tooltip>
            ) : null}
            {model.status && model.statusLabel ? (
              <Tooltip label={model.statusLabel} opened={statusTooltipOpened}>
                <DsText
                  align="center"
                  shrink={false}
                  as="span"
                  tone={statusColors[model.status]}
                  data-testid="og-generation-status-icon"
                  data-status={model.status}
                  role="img"
                  aria-label={model.statusLabel}
                  tabIndex={0}
                  onMouseEnter={() => setStatusTooltipOpened(true)}
                  onMouseLeave={() => setStatusTooltipOpened(false)}
                  onFocus={() => setStatusTooltipOpened(true)}
                  onBlur={() => setStatusTooltipOpened(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setStatusTooltipOpened(false);
                    }
                  }}
                >
                  <GenerationStatusIcon status={model.status} />
                </DsText>
              </Tooltip>
            ) : null}
          </DsLayoutInline>
        }
      />
      <ImagePreviewFrame
        src={model.src}
        alt={model.imageAlt}
        aspectRatio={model.aspectRatio}
        fit="contain"
        surface="muted"
        empty={
          <DsText size="xs" tone="secondary" align="center">
            {model.emptyLabel}
          </DsText>
        }
        renderImage={({ src, alt, style }) => <Image src={src} alt={alt} fill sizes={model.sizes} style={style} />}
      />
    </DsLayoutStack>
  );
}
