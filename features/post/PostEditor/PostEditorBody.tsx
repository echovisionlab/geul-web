'use client';
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
            editable={editable}
            entityId={postId}
            entityType={TranscodeEntityType.POST}
            allowNeutralBlockEdits={isSourceLocale}
            allowStructuralEdits={isSourceLocale}
            aiTarget={activeLocale && editable ? { type: 'post', id: postId, locale: activeLocale } : undefined}
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
      {content}
    </DsLayoutStack>
  );
}
