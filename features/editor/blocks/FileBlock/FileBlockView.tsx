import type { HTMLAttributes, ReactNode } from 'react';
import { IconPaperclip } from '@tabler/icons-react';
import { Loader, Stack, Text } from '@mantine/core';
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
  emptyInteractionProps?: HTMLAttributes<HTMLDivElement>;
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
  emptyInteractionProps,
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
      <EditorMediaBlockFrame widthPercent={100} allowResize={false} suppressStaticTextSelection>
        <Stack align="center" justify="center" gap="xs" mih={88}>
          <Loader size="sm" />
          <Text c="dimmed" size="sm">
            {loadingLabel}
          </Text>
        </Stack>
      </EditorMediaBlockFrame>
    );
  }

  const { onKeyDown, ...interactionProps } = emptyInteractionProps ?? {};
  return (
    <EditorMediaBlockFrame widthPercent={100} allowResize={false} suppressStaticTextSelection>
      <div
        className="attachment-block attachment-block--empty"
        contentEditable={false}
        {...interactionProps}
        onClick={emptyInteractive ? onActivate : undefined}
        onKeyDown={
          emptyInteractive
            ? (event) => {
                onKeyDown?.(event);
                if (!event.defaultPrevented && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  onActivate?.();
                }
              }
            : undefined
        }
        role={emptyInteractive ? 'button' : undefined}
        tabIndex={emptyInteractive ? 0 : undefined}
        aria-disabled={emptyInteractive ? undefined : true}
      >
        <Stack gap="xs" style={{ width: '100%' }}>
          <UploadPlaceholder
            icon={<IconPaperclip size={24} stroke={1.5} />}
            title={emptyTitle}
            description={emptyDescription}
            minHeight={88}
            radius={0}
            interactive={emptyInteractive}
            dropActive={isDropActive}
          />
        </Stack>
      </div>
    </EditorMediaBlockFrame>
  );
}
