'use client';

import type { ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { ExternalVideoView, type ExternalVideoViewProps } from '@/features/media/ExternalVideoView';
import type { BlockCanvasPreviewProps } from '../types';
import { parseExternalVideoProps, type ExternalVideoProps } from './schema';

interface ExternalVideoCanvasPreviewProps extends BlockCanvasPreviewProps<ExternalVideoProps> {
  videoView?: ComponentType<ExternalVideoViewProps>;
}

export function ExternalVideoCanvasPreview({
  props,
  videoView: VideoView = ExternalVideoView,
}: ExternalVideoCanvasPreviewProps) {
  const t = useTranslations('pageEditor.externalVideo');
  const parsed = parseExternalVideoProps(props);

  if (!parsed.url.trim()) {
    return <Text c="dimmed">{t('emptyPreview')}</Text>;
  }

  return (
    <VideoView
      url={parsed.url}
      title={parsed.caption.trim() || t('playerTitle')}
      caption={parsed.caption}
      aspectRatio={parsed.aspectRatio}
    />
  );
}
