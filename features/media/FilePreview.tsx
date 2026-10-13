'use client';

import { MediaImage } from '@/components/core/MediaImage';
import type { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { FileTypeIcon } from '@/components/core/Display/FileTypeIcon';
export { FileTypeIcon } from '@/components/core/Display/FileTypeIcon';

import { FileMediaPreview } from './FileMediaPreview';

export interface FilePreviewFile {
  id: string;
  fileName: string;
  extension: string;
  mimeType: string;
  inlineUrl?: string;
  downloadUrl?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  waveformUrl?: string;
  durationSeconds?: number;
  processingStatus?: MediaProcessingStatus;
}

function displayName(file: FilePreviewFile): string {
  return file.extension ? `${file.fileName}.${file.extension}` : file.fileName;
}

/** Pure shared preview for resolved File projections. */
export function FilePreview({ file, compact = false }: { file: FilePreviewFile; compact?: boolean }) {
  const source = file.inlineUrl ?? file.downloadUrl;
  if (file.mimeType.startsWith('audio/') || file.mimeType.startsWith('video/')) {
    if (!file.playbackUrl && !source) {
      return <FileTypeIcon file={file} size={compact ? 'compact' : 'preview'} />;
    }
    return (
      <FileMediaPreview
        source={{
          fileId: file.id,
          name: displayName(file),
          mimeType: file.mimeType,
          originalUrl: source,
          hlsUrl: file.playbackUrl,
          posterUrl: file.thumbnailUrl,
          waveformUrl: file.waveformUrl,
          durationSeconds: file.durationSeconds,
          processingStatus: file.processingStatus,
        }}
      />
    );
  }
  if (!source) {
    return <FileTypeIcon file={file} size={compact ? 'compact' : 'preview'} />;
  }
  if (file.mimeType.startsWith('image/')) {
    return <MediaImage src={source} alt={displayName(file)} fit="contain" maxHeight={compact ? 220 : 360} />;
  }
  if (file.mimeType === 'application/pdf') {
    return (
      <iframe
        src={source}
        title={displayName(file)}
        sandbox=""
        referrerPolicy="no-referrer"
        style={{ width: '100%', height: compact ? 240 : 'min(70vh, 720px)', border: 0 }}
      />
    );
  }
  return <FileTypeIcon file={file} size={compact ? 'compact' : 'preview'} />;
}
