'use client';

import type { ReactNode } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { Box, Stack, Text } from '@mantine/core';
import { ActiveEditLocaleContentPreview } from '@/features/translation/ActiveEditLocaleContentPreview';
import { LocalizedRichTextFragmentEditor } from '@/features/translation/LocalizedRichTextFragmentEditor';
import type { PostBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import { getEditorBodyLoadingId, getEditorBodyReadyId } from '@/features/editor/lib/media-test-ids';
import { PageLoader } from '@/features/site/PageLoader';
import type { PostEditorBodyMode } from './body-mode';

interface PostEditorSession {
  provider: HocuspocusProvider;
  controller: PostBlockRoomTiptapController;
}

interface PostEditorBodyProps {
  bodyMode: PostEditorBodyMode;
  session: PostEditorSession | null;
  postId: string;
  userName: string;
  editable: boolean;
  showLabel: boolean;
  bodyLabel: string;
  activeLocale: string | null;
  activeLocaleLabel: string | null;
  hasLiveRow: boolean;
  contentPreview: string;
  previewLoading: boolean;
  isSourceLocale: boolean;
}

function EditorLoading({ postId }: { postId: string }) {
  return (
    <Box id={getEditorBodyLoadingId('post', postId)} pos="relative" mih={200}>
      <PageLoader size="md" />
    </Box>
  );
}

function ScopedLocaleBoundary({
  activeLocale,
  activeLocaleLabel,
  hasLiveRow,
  contentPreview,
  previewLoading,
  children,
}: Pick<
  PostEditorBodyProps,
  'activeLocale' | 'activeLocaleLabel' | 'hasLiveRow' | 'contentPreview' | 'previewLoading'
> & { activeLocaleLabel: string; children?: ReactNode }) {
  return (
    <ActiveEditLocaleContentPreview
      key={activeLocale ?? 'post-source'}
      localeLabel={activeLocaleLabel}
      hasLiveRow={hasLiveRow}
      contentPreview={contentPreview}
      loading={previewLoading}
    >
      {children}
    </ActiveEditLocaleContentPreview>
  );
}

export function PostEditorBody({
  bodyMode,
  session,
  postId,
  userName,
  editable,
  showLabel,
  bodyLabel,
  activeLocale,
  activeLocaleLabel,
  hasLiveRow,
  contentPreview,
  previewLoading,
  isSourceLocale,
}: PostEditorBodyProps) {
  let content: ReactNode;

  switch (bodyMode) {
    case 'missing-target-fallback': {
      if (!activeLocaleLabel) {
        content = <EditorLoading postId={postId} />;
        break;
      }
      content = (
        <ScopedLocaleBoundary
          activeLocale={activeLocale}
          activeLocaleLabel={activeLocaleLabel}
          hasLiveRow={hasLiveRow}
          contentPreview={contentPreview}
          previewLoading={previewLoading}
        >
          {session ? (
            <Box id={getEditorBodyReadyId('post', postId)} flex={1}>
              <LocalizedRichTextFragmentEditor
                key={`post-${postId}-${activeLocale ?? 'missing-target'}-source-fallback`}
                provider={session.provider}
                blockRoomController={session.controller}
                userName={userName}
                editable={false}
                entityId={postId}
                entityType={TranscodeEntityType.POST}
                allowNeutralBlockEdits={false}
                allowStructuralEdits={false}
              />
            </Box>
          ) : null}
        </ScopedLocaleBoundary>
      );
      break;
    }
    case 'locale-editor': {
      if (!session) {
        content = <EditorLoading postId={postId} />;
        break;
      }
      content = (
        <Box id={getEditorBodyReadyId('post', postId)} flex={1}>
          <LocalizedRichTextFragmentEditor
            key={`post-${postId}-${activeLocale ?? 'source'}`}
            provider={session.provider}
            blockRoomController={session.controller}
            userName={userName}
            editable={editable}
            entityId={postId}
            entityType={TranscodeEntityType.POST}
            allowNeutralBlockEdits={isSourceLocale}
            allowStructuralEdits={isSourceLocale}
            aiTarget={activeLocale && editable ? { type: 'post', id: postId, locale: activeLocale } : undefined}
          />
        </Box>
      );
      break;
    }
    case 'loading': {
      content = <EditorLoading postId={postId} />;
      break;
    }
  }

  return (
    <Stack gap={4} flex={1}>
      {showLabel ? (
        <Text size="xs" c="dimmed">
          {bodyLabel}
        </Text>
      ) : null}
      {content}
    </Stack>
  );
}
