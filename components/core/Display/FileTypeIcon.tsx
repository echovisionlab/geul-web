import { IconFile, IconFileMusic, IconFileText, IconFileTypePdf, IconPhoto, IconVideo } from '@tabler/icons-react';

export interface FileTypeIconProps {
  file: { mimeType: string };
  size?: 'inline' | 'compact' | 'preview';
}

export function FileTypeIcon({ file, size = 'compact' }: FileTypeIconProps) {
  const iconSize = size === 'inline' ? '1em' : size === 'compact' ? 48 : 64;
  if (file.mimeType.startsWith('image/')) {
    return <IconPhoto size={iconSize} stroke={1.25} aria-hidden />;
  }
  if (file.mimeType.startsWith('audio/')) {
    return <IconFileMusic size={iconSize} stroke={1.25} aria-hidden />;
  }
  if (file.mimeType.startsWith('video/')) {
    return <IconVideo size={iconSize} stroke={1.25} aria-hidden />;
  }
  if (file.mimeType === 'application/pdf') {
    return <IconFileTypePdf size={iconSize} stroke={1.25} aria-hidden />;
  }
  if (file.mimeType.startsWith('text/') || file.mimeType.includes('document')) {
    return <IconFileText size={iconSize} stroke={1.25} aria-hidden />;
  }
  return <IconFile size={iconSize} stroke={1.25} aria-hidden />;
}
