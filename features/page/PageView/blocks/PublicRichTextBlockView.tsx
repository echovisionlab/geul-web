'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import type { ExternalVideoViewProps } from '@/features/media/ExternalVideoView';
import {
  resolveStandaloneExternalVideoLink,
  standaloneExternalVideoAspectRatio,
} from '@/features/media/standalone-external-video';
import { mediaContainerStyleToReact, resolveMediaContainerStyle } from '@/lib/media/shared';
import type { Block } from '@/lib/types/page-content';
import { DefaultBlockView } from './DefaultBlockView';
import { PublicDocumentBlock } from './PublicDocumentBlock';

const ExternalVideoView = dynamic(() =>
  import('@/features/media/ExternalVideoView').then((module) => module.ExternalVideoView),
);

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
      <PublicDocumentBlock id={block.id} kind="paragraph">
        <VideoView
          url={externalVideo.url}
          title={externalVideo.title}
          aspectRatio={externalVideo.aspectRatio}
          style={mediaContainerStyleToReact(
            resolveMediaContainerStyle(
              externalVideo.displaySize,
              externalVideo.textAlignment,
              standaloneExternalVideoAspectRatio(externalVideo),
            ),
          )}
        />
      </PublicDocumentBlock>
    );
  }

  return <DefaultBlockView block={block} requestedLocale={requestedLocale} />;
}
