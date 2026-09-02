'use client';

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
import { Group, Loader, Stack, Text, VisuallyHidden } from '@mantine/core';
import { IconButton } from '@/components/core/IconButton';
import { ImagePreviewFrame } from '@/components/core/ImageUpload';
import { Tooltip } from '@/components/core/Tooltip';

export type OgImagePreviewStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'superseded' | 'cancelled';

export interface OgImagePreviewViewModel {
  src?: string;
  sizes: string;
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

const statusColors: Record<OgImagePreviewStatus, string> = {
  queued: 'gray',
  processing: 'blue',
  ready: 'green',
  failed: 'red',
  superseded: 'yellow',
  cancelled: 'gray',
};

function GenerationStatusIcon({ status }: { status: OgImagePreviewStatus }) {
  const iconProps = {
    size: 14,
    stroke: 1.8,
    'aria-hidden': true,
  };

  switch (status) {
    case 'queued':
      return <IconClock {...iconProps} data-testid="og-generation-icon-queued" />;
    case 'processing':
      return <Loader size={14} type="oval" color="blue" data-testid="og-generation-icon-processing" aria-hidden />;
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
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap" data-testid="og-image-header">
        <Text size="xs" c="dimmed">
          {model.headerLabel}
        </Text>
        <Group gap={4} ml="auto" wrap="nowrap" data-testid="og-image-header-actions">
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
                <IconRefresh size={12} />
              </IconButton>
            </Tooltip>
          ) : null}
          {model.status && model.statusLabel ? (
            <Tooltip
              label={model.statusLabel}
              opened={statusTooltipOpened}
              events={{ hover: false, focus: false, touch: false }}
            >
              <Text
                component="span"
                c={statusColors[model.status]}
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
                style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
              >
                <GenerationStatusIcon status={model.status} />
              </Text>
            </Tooltip>
          ) : null}
        </Group>
      </Group>
      <ImagePreviewFrame
        src={model.src}
        alt={model.imageAlt}
        aspectRatio="1200 / 630"
        minHeight={120}
        background="var(--mantine-color-gray-1)"
        empty={
          <Text size="sm" c="dimmed">
            {model.emptyLabel}
          </Text>
        }
        renderImage={({ src, alt, style }) => <Image src={src} alt={alt} fill sizes={model.sizes} style={style} />}
      />
    </Stack>
  );
}
