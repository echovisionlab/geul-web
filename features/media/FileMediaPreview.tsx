'use client';

import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { AudioPlayer } from './AudioPlayer';
import { VideoPlayer } from './VideoPlayer';

export interface FileMediaPreviewSource {
  fileId: string;
  name: string;
  mimeType: string;
  originalUrl?: string;
  hlsUrl?: string;
  posterUrl?: string;
  waveformUrl?: string;
  durationSeconds?: number;
  processingStatus?: MediaProcessingStatus;
}

export function FileMediaPreview({ source }: { source: FileMediaPreviewSource }) {
  const hasPlayableSource = Boolean(source.hlsUrl || source.originalUrl);
  const isReady =
    source.processingStatus === MediaProcessingStatus.READY ||
    ((source.processingStatus === undefined || source.processingStatus === MediaProcessingStatus.UNSPECIFIED) &&
      hasPlayableSource);
  const isProcessing = source.processingStatus === MediaProcessingStatus.PROCESSING;
  if (source.mimeType.startsWith('audio/')) {
    return (
      <div data-file-media-preview="audio" style={{ width: '100%' }}>
        <AudioPlayer
          src={source.originalUrl ?? ''}
          hlsSrc={source.hlsUrl}
          name={source.name}
          isReady={isReady}
          duration={source.durationSeconds}
          waveformUrl={source.waveformUrl}
        />
      </div>
    );
  }

  if (source.mimeType.startsWith('video/')) {
    return (
      <div data-file-media-preview="video" style={{ width: '100%' }}>
        <VideoPlayer
          hlsSrc={source.hlsUrl}
          src={source.originalUrl}
          poster={source.posterUrl}
          isReady={isReady}
          isProcessing={isProcessing}
          duration={source.durationSeconds}
        />
      </div>
    );
  }

  return null;
}
