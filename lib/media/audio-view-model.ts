import { resolveAudioPlaybackHydration, type AudioPlaybackSource } from '@echovisionlab/geul-common/media/hydration';
import type { Block } from '@/lib/types/page-content';
import { buildAudioMediaHydrationAttrs, type MediaHydrationDomAttrs } from './hydration';
import {
  formatMediaSize,
  getBlockPropString,
  mediaContainerStyleToReact,
  resolveMediaContainerStyle,
  resolveMediaDisplayName,
} from './shared';
import { resolveMediaStatusDisplay, resolveMediaUploadStage } from './status';
import { type WaveformPeaks } from './waveform-sidecar';

export interface AudioViewModelInput {
  fileId?: string;
  url?: string;
  originalUrl?: string;
  hlsUrl?: string;
  waveformUrl?: string;
  spectrogramUrl?: string;
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
  waveformData?: WaveformPeaks;
  previewWidth?: string;
  textAlignment?: string;
}

export interface AudioActionLink {
  key: 'download-original';
  label: string;
  href: string;
  download?: boolean;
  target?: '_blank';
  rel?: 'noreferrer';
}

export interface AudioViewModel {
  title: string;
  caption: string;
  sizeText: string;
  playbackUrl: string;
  playbackSource: AudioPlaybackSource | null;
  originalUrl: string;
  hlsUrl: string;
  isReady: boolean;
  statusLabel: string | null;
  statusTone: string;
  actions: AudioActionLink[];
  durationSeconds: number;
  waveformData?: WaveformPeaks;
  waveformUrl: string;
  spectrogramUrl: string;
  entityType: string;
  entityId: string;
  shareToken: string;
  containerStyle?: React.CSSProperties;
  domAttrs: MediaHydrationDomAttrs;
}

export function resolveAudioViewModel(input: AudioViewModelInput): AudioViewModel {
  const access = resolveAudioPlaybackHydration({
    originalUrl: input.originalUrl || input.url,
    hlsUrl: input.hlsUrl,
  });

  const actions: AudioActionLink[] = [];

  const containerStyle = mediaContainerStyleToReact(
    resolveMediaContainerStyle(input.previewWidth, input.textAlignment),
  );
  const domAttrs = {
    ...buildAudioMediaHydrationAttrs({
      fileId: input.fileId,
      entityType: input.entityType,
      entityId: input.entityId,
      playbackUrl: access.playbackUrl,
      playbackSource: access.playbackSource,
      originalUrl: access.originalUrl,
      hlsUrl: access.hlsUrl,
      waveformUrl: input.waveformUrl,
      spectrogramUrl: input.spectrogramUrl,
    }),
    'data-media-name': input.name || '',
  };

  const progressNum = parseInt(input.processingProgress || '0', 10) || 0;
  const statusDisplay = resolveMediaStatusDisplay({
    status: input.processingStatus || '',
    progress: progressNum,
    stage: resolveMediaUploadStage({
      status: input.processingStatus,
      uploadStage: input.uploadStage,
    }),
    idleBehavior: access.playbackUrl ? 'ready' : 'null',
  });
  const effectiveStatusLabel =
    (input.processingStatus === 'completed' || input.processingStatus === 'ready') && !access.playbackUrl
      ? null
      : statusDisplay.label;
  const effectiveStatusTone =
    (input.processingStatus === 'completed' || input.processingStatus === 'ready') && !access.playbackUrl
      ? 'gray'
      : statusDisplay.color;
  const isReady =
    (input.processingStatus ? input.processingStatus === 'completed' || input.processingStatus === 'ready' : true) &&
    !!access.playbackUrl;
  return {
    title: resolveMediaDisplayName({
      name: input.name,
      fallback: 'Untitled audio',
    }),
    caption: (input.caption || '').trim(),
    sizeText: formatMediaSize(input.size),
    playbackUrl: access.playbackUrl,
    playbackSource: access.playbackSource,
    originalUrl: access.originalUrl,
    hlsUrl: access.hlsUrl,
    isReady,
    statusLabel: effectiveStatusLabel,
    statusTone: effectiveStatusTone,
    actions,
    durationSeconds: parseFloat(input.duration || '0') || 0,
    waveformData: input.waveformData,
    waveformUrl: input.waveformUrl || '',
    spectrogramUrl: input.spectrogramUrl || '',
    entityType: input.entityType || '',
    entityId: input.entityId || '',
    shareToken: input.shareToken || '',
    containerStyle,
    domAttrs,
  };
}

export function resolveAudioViewModelFromBlock(block: Pick<Block, 'props'>): AudioViewModel {
  return resolveAudioViewModel({
    fileId: getBlockPropString(block.props, 'fileId'),
    url: getBlockPropString(block.props, 'url'),
    originalUrl: getBlockPropString(block.props, 'originalUrl'),
    hlsUrl: getBlockPropString(block.props, 'hlsUrl'),
    waveformUrl: getBlockPropString(block.props, 'waveformUrl'),
    spectrogramUrl: getBlockPropString(block.props, 'spectrogramUrl'),
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
