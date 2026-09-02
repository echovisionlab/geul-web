'use client';

import type { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { IconFile, IconFileMusic, IconFileText, IconFileTypePdf, IconPhoto, IconVideo } from '@tabler/icons-react';
import { Image } from '@mantine/core';
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

export function FileTypeIcon({ file, size = 48 }: { file: Pick<FilePreviewFile, 'mimeType'>; size?: number }) {
  if (file.mimeType.startsWith('image/')) {
    return <IconPhoto size={size} stroke={1.25} aria-hidden />;
  }
  if (file.mimeType.startsWith('audio/')) {
    return <IconFileMusic size={size} stroke={1.25} aria-hidden />;
  }
  if (file.mimeType.startsWith('video/')) {
    return <IconVideo size={size} stroke={1.25} aria-hidden />;
  }
  if (file.mimeType === 'application/pdf') {
    return <IconFileTypePdf size={size} stroke={1.25} aria-hidden />;
  }
  if (file.mimeType.startsWith('text/') || file.mimeType.includes('document')) {
    return <IconFileText size={size} stroke={1.25} aria-hidden />;
  }
  return <IconFile size={size} stroke={1.25} aria-hidden />;
}

/** Pure shared preview for resolved File projections. */
export function FilePreview({ file, compact = false }: { file: FilePreviewFile; compact?: boolean }) {
  const source = file.inlineUrl ?? file.downloadUrl;
  if (file.mimeType.startsWith('audio/') || file.mimeType.startsWith('video/')) {
    if (!file.playbackUrl && !source) {
      return <FileTypeIcon file={file} size={compact ? 48 : 64} />;
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
    return <FileTypeIcon file={file} size={compact ? 48 : 64} />;
  }
  if (file.mimeType.startsWith('image/')) {
    return <Image src={source} alt={displayName(file)} fit="contain" mah={compact ? 220 : 360} />;
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
  return <FileTypeIcon file={file} size={compact ? 48 : 64} />;
}
