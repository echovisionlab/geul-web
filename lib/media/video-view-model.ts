import type { Block } from '@/lib/types/page-content';
import { buildVideoMediaHydrationAttrs, type MediaHydrationDomAttrs } from './hydration';
import {
  formatMediaSize,
  getBlockPropString,
  looksLikeHlsUrl,
  mediaContainerStyleToReact,
  normalizeHydrationUrl,
  resolveMediaContainerStyle,
  resolveMediaDisplayName,
} from './shared';
import { resolveMediaStatusDisplay, resolveMediaUploadStage } from './status';

export interface VideoViewModelInput {
  fileId?: string;
  url?: string;
  hlsUrl?: string;
  thumbnailUrl?: string;
  clientThumbnail?: string;
  caption?: string;
  name?: string;
  size?: string;
  entityType?: string;
  entityId?: string;
  shareToken?: string;
  processingStatus?: string;
  processingProgress?: string;
  uploadStage?: string;
  duration?: string;
  previewWidth?: string;
  textAlignment?: string;
}

export interface VideoViewModel {
  title: string;
  caption: string;
  sizeText: string;
  playbackUrl: string;
  originalUrl: string;
  hlsUrl: string;
  posterUrl: string;
  isReady: boolean;
  isProcessing: boolean;
  isFailed: boolean;
  durationSeconds: number;
  statusLabel: string | null;
  statusTone: string;
  entityType: string;
  entityId: string;
  shareToken: string;
  containerStyle?: React.CSSProperties;
  domAttrs: MediaHydrationDomAttrs;
}

export function resolveVideoViewModel(input: VideoViewModelInput): VideoViewModel {
  const rawUrl = normalizeHydrationUrl(input.url);
  const hlsUrl = normalizeHydrationUrl(input.hlsUrl) || (looksLikeHlsUrl(rawUrl) ? rawUrl : '');
  const playbackUrl = hlsUrl;
  const posterUrl = normalizeHydrationUrl(input.thumbnailUrl) || normalizeHydrationUrl(input.clientThumbnail);
  const progressNum = parseInt(input.processingProgress || '0', 10) || 0;
  const statusDisplay = resolveMediaStatusDisplay({
    status: input.processingStatus || '',
    progress: progressNum,
    stage: resolveMediaUploadStage({
      status: input.processingStatus,
      uploadStage: input.uploadStage,
    }),
  });
  const hasPlayableSource = !!hlsUrl;
  const isReady = input.processingStatus
    ? (input.processingStatus === 'completed' || input.processingStatus === 'ready') && hasPlayableSource
    : hasPlayableSource;
  const effectiveStatusLabel =
    (input.processingStatus === 'completed' || input.processingStatus === 'ready') && !hasPlayableSource
      ? null
      : statusDisplay.label;
  const effectiveStatusTone =
    (input.processingStatus === 'completed' || input.processingStatus === 'ready') && !hasPlayableSource
      ? 'gray'
      : statusDisplay.color;

  return {
    title: resolveMediaDisplayName({
      name: input.name,
      fallback: 'Untitled video',
    }),
    caption: (input.caption || '').trim(),
    sizeText: formatMediaSize(input.size),
    playbackUrl,
    originalUrl: rawUrl,
    hlsUrl,
    posterUrl,
    isReady,
    isProcessing: input.processingStatus === 'processing',
    isFailed: input.processingStatus === 'failed',
    durationSeconds: parseFloat(input.duration || '0') || 0,
    statusLabel: effectiveStatusLabel,
    statusTone: effectiveStatusTone,
    entityType: input.entityType || '',
    entityId: input.entityId || '',
    shareToken: input.shareToken || '',
    containerStyle: mediaContainerStyleToReact(resolveMediaContainerStyle(input.previewWidth, input.textAlignment)),
    domAttrs: {
      ...buildVideoMediaHydrationAttrs({
        fileId: input.fileId,
        entityType: input.entityType,
        entityId: input.entityId,
        originalUrl: rawUrl,
        hlsUrl,
        posterUrl,
      }),
      'data-media-name': input.name || '',
    },
  };
}

export function resolveVideoViewModelFromBlock(block: Pick<Block, 'props'>): VideoViewModel {
  return resolveVideoViewModel({
    fileId: getBlockPropString(block.props, 'fileId'),
    url: getBlockPropString(block.props, 'url'),
    hlsUrl: getBlockPropString(block.props, 'hlsUrl'),
    thumbnailUrl: getBlockPropString(block.props, 'thumbnailUrl'),
    clientThumbnail: getBlockPropString(block.props, 'clientThumbnail'),
    caption: getBlockPropString(block.props, 'caption'),
    name: getBlockPropString(block.props, 'name'),
    size: getBlockPropString(block.props, 'size'),
    entityType: getBlockPropString(block.props, 'entityType'),
    entityId: getBlockPropString(block.props, 'entityId'),
    shareToken: getBlockPropString(block.props, 'shareToken'),
    processingStatus: getBlockPropString(block.props, 'processingStatus'),
    processingProgress: getBlockPropString(block.props, 'processingProgress'),
    uploadStage: getBlockPropString(block.props, 'uploadStage'),
    duration: getBlockPropString(block.props, 'duration'),
    previewWidth: getBlockPropString(block.props, 'previewWidth', '100'),
    textAlignment: getBlockPropString(block.props, 'textAlignment', 'left'),
  });
}
