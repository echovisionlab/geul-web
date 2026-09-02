'use client';

import type { ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalVideoView, type ExternalVideoViewProps } from '@/features/media/ExternalVideoView';
import { resolveStandaloneExternalVideoLink } from '@/features/media/standalone-external-video';
import { mediaContainerStyleToReact, resolveMediaContainerStyle } from '@/lib/media/shared';
import type { Block } from '@/lib/types/page-content';
import { DefaultBlockView } from './DefaultBlockView';

interface PublicRichTextBlockViewProps {
  block: Block;
  requestedLocale?: string;
  videoView?: ComponentType<ExternalVideoViewProps>;
}

export function PublicRichTextBlockView({
  block,
  requestedLocale,
  videoView: VideoView = ExternalVideoView,
}: PublicRichTextBlockViewProps) {
  const externalVideoLabels = useTranslations('editorCommon.editor.runtimeLabels.externalVideo');
  const externalVideo = resolveStandaloneExternalVideoLink(block, {
    youtubeTitle: externalVideoLabels('youtubeTitle'),
    vimeoTitle: externalVideoLabels('vimeoTitle'),
  });
  if (externalVideo) {
    return (
      <VideoView
        url={externalVideo.url}
        title={externalVideo.title}
        aspectRatio={externalVideo.aspectRatio}
        style={mediaContainerStyleToReact(
          resolveMediaContainerStyle(externalVideo.previewWidth, externalVideo.textAlignment),
        )}
      />
    );
  }

  return <DefaultBlockView block={block} requestedLocale={requestedLocale} />;
}
