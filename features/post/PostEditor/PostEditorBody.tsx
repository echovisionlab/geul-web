'use client';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import type { EditorSnapshot } from '@/features/editor/editor-snapshot';
import { TiptapSnapshot } from '@/features/editor/tiptap/TiptapSnapshot';
import { EditorSnapshotHandoff } from '@/features/editor/EditorSnapshotHandoff';
import { LayoutInset as DsLayoutInset, LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import type { ReactNode } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
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
  snapshot?: EditorSnapshot;
  roomReady?: boolean;
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
    <div style={{ position: 'relative', minHeight: 200 }} id={getEditorBodyLoadingId('post', postId)}>
      <PageLoader size="md" />
    </div>
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
> & {
  activeLocaleLabel: string;
  children?: ReactNode;
}) {
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
  snapshot,
  roomReady,
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
  const canEditBody = editable && snapshot?.editable !== false;
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
            <DsLayoutInset space="none" id={getEditorBodyReadyId('post', postId)} flexible>
              <LocalizedRichTextFragmentEditor
                accessibleLabel={bodyLabel}
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
            </DsLayoutInset>
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
        <DsLayoutInset space="none" id={getEditorBodyReadyId('post', postId)} flexible>
          <LocalizedRichTextFragmentEditor
            accessibleLabel={bodyLabel}
            key={`post-${postId}-${activeLocale ?? 'source'}`}
            provider={session.provider}
            blockRoomController={session.controller}
            userName={userName}
            editable={canEditBody}
            entityId={postId}
            entityType={TranscodeEntityType.POST}
            allowNeutralBlockEdits={isSourceLocale}
            allowStructuralEdits={isSourceLocale}
          />
        </DsLayoutInset>
      );
      break;
    }
    case 'loading': {
      content = <EditorLoading postId={postId} />;
      break;
    }
  }
  return (
    <DsLayoutStack gap="xxs" flexible>
      {showLabel ? (
        <DsText size="xs" tone="secondary">
          {bodyLabel}
        </DsText>
      ) : null}
      {snapshot?.content && (!activeLocale || snapshot.locale === activeLocale) ? (
        <EditorSnapshotHandoff
          key={snapshot.locale}
          media={snapshot.blockMedia}
          ready={Boolean(roomReady && session)}
          editable={canEditBody}
          snapshot={
            <ContentBlockMediaRuntimeProvider items={snapshot.blockMedia ?? []}>
              <TiptapSnapshot
                content={snapshot.content}
                blocks={snapshot.blocks}
                locale={snapshot.locale}
                label={bodyLabel}
              />
            </ContentBlockMediaRuntimeProvider>
          }
        >
          {content}
        </EditorSnapshotHandoff>
      ) : (
        content
      )}
    </DsLayoutStack>
  );
}
