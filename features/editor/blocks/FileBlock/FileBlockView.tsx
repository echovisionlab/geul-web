import { SupportingText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import type { ReactNode } from 'react';
import { IconPaperclip } from '@tabler/icons-react';

import { Spinner as Loader } from '@/components/core/Display';
import { UploadPlaceholder } from '@/components/core/ImageUpload';
import { EditorMediaBlockFrame } from '@/features/editor/ui/EditorMediaBlockShell';

export type FileBlockViewKind = 'empty' | 'loading' | 'image' | 'audio' | 'video' | 'file';

export interface FileBlockViewProps {
  kind: FileBlockViewKind;
  emptyTitle: string;
  emptyDescription: string;
  loadingLabel: string;
  isDropActive?: boolean;
  onActivate?: () => void;
  emptyInteractive?: boolean;
  imageView?: ReactNode;
  audioView?: ReactNode;
  videoView?: ReactNode;
  fileView?: ReactNode;
}

export function resolveFileBlockViewKind(input: {
  hasSource: boolean;
  mimeType: string;
  isLoadingMime: boolean;
}): FileBlockViewKind {
  if (!input.hasSource) {
    return 'empty';
  }
  const mimeType = input.mimeType.trim().toLowerCase();
  if ((!mimeType || mimeType === 'application/octet-stream') && input.isLoadingMime) {
    return 'loading';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  return 'file';
}

export function FileBlockView({
  kind,
  emptyTitle,
  emptyDescription,
  loadingLabel,
  isDropActive = false,
  onActivate,
  emptyInteractive = true,
  imageView,
  audioView,
  videoView,
  fileView,
}: FileBlockViewProps) {
  if (kind === 'image') {
    return imageView;
  }
  if (kind === 'audio') {
    return audioView;
  }
  if (kind === 'video') {
    return videoView;
  }
  if (kind === 'file') {
    return fileView;
  }

  if (kind === 'loading') {
    return (
      <EditorMediaBlockFrame displaySize={100} allowResize={false} suppressStaticTextSelection>
        <div style={{ minHeight: 88 }}>
          <DsLayoutStack align="center" justify="center" gap="xs">
            <Loader size="sm" />
            <SupportingText tone="secondary">{loadingLabel}</SupportingText>
          </DsLayoutStack>
        </div>
      </EditorMediaBlockFrame>
    );
  }

  return (
    <EditorMediaBlockFrame displaySize={100} allowResize={false} suppressStaticTextSelection>
      <div className="attachment-block attachment-block--empty" contentEditable={false}>
        <DsLayoutStack gap="xs" fill="inline">
          <UploadPlaceholder
            icon={<IconPaperclip size={24} stroke={1.5} />}
            title={emptyTitle}
            description={emptyDescription}
            minHeight={88}
            interactive={emptyInteractive}
            dropActive={isDropActive}
            onPress={onActivate}
          />
        </DsLayoutStack>
      </div>
    </EditorMediaBlockFrame>
  );
}
