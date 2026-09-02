'use client';

import { useCallback, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { useOptionalEditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { ConnectedMediaDownloadPolicyPanel } from '@/features/editor/components/ConnectedMediaDownloadPolicyPanel';
import { MediaProcessingSurface } from '@/features/editor/components/MediaProcessingSurface';
import { useBlockResize } from '@/features/editor/hooks/useBlockResize';
import { useEditorMediaRuntimeBinding } from '@/features/editor/hooks/useEditorMediaRuntimeBinding';
import type {
  EditorMediaRuntimeSnapshot,
  EditorMediaRuntimeStore,
} from '@/features/editor/lib/editor-media-runtime-store';
import { EditorMediaBlockFrame } from '@/features/editor/ui/EditorMediaBlockShell';
import { FileBlockMetadataFields } from '@/features/editor/ui/FileBlockMetadataFields';
import { AudioMediaView } from '@/features/media/AudioMediaView';
import { VideoMediaView } from '@/features/media/VideoMediaView';
import { AttachmentMediaView } from '@/features/media/ui/AttachmentMediaView';
import { ImageMediaView } from '@/features/media/ui/ImageMediaView';
import { resolveAudioViewModel } from '@/lib/media/audio-view-model';
import { formatMediaSize } from '@/lib/media/shared';
import { resolveVideoViewModel } from '@/lib/media/video-view-model';
import { isBlockId } from '@/lib/editor/block-id';
import { getFileTypeName } from '@/lib/utils/file-icon';
import { FileBlockView, resolveFileBlockViewKind } from '../blocks/FileBlock/FileBlockView';
import { WireFile } from './wire-schema';
import { useExactTiptapNodeSelection } from './useExactTiptapNodeSelection';
import { useTiptapEditorEditable } from './useTiptapEditorEditable';

type FileNodeAttributes = Record<string, unknown>;

export interface TiptapFileNodeOptions {
  onActivate?: (blockId: string) => void;
  runtimeStore?: EditorMediaRuntimeStore;
}

const EMPTY_RUNTIME_SNAPSHOT: EditorMediaRuntimeSnapshot = Object.freeze({});

function readString(attributes: FileNodeAttributes, name: string): string {
  return String(attributes[name] ?? '');
}

function getParentBlockId({ editor, getPos }: Pick<NodeViewProps, 'editor' | 'getPos'>): string {
  const position = getPos();
  if (typeof position !== 'number') {
    return '';
  }
  return String(editor.state.doc.resolve(position).parent.attrs.id ?? '');
}

function TiptapFileBlockNodeView({
  editor,
  getPos,
  node,
  updateAttributes,
  runtimeStore,
}: NodeViewProps & TiptapFileNodeOptions) {
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const tMedia = useTranslations('editorCommon.media');
  const durableAttributes = node.attrs as FileNodeAttributes;
  const fileId = readString(durableAttributes, 'fileId');
  const blockId = getParentBlockId({ editor, getPos });
  const delivery = useEditorMediaRuntimeBinding({ blockId, fileId, runtimeStore });
  const subscribeRuntime = useCallback(
    (listener: () => void) => runtimeStore?.subscribe(blockId, listener) ?? (() => {}),
    [blockId, runtimeStore],
  );
  const getRuntimeSnapshot = useCallback(
    () => runtimeStore?.getSnapshot(blockId, fileId) ?? EMPTY_RUNTIME_SNAPSHOT,
    [blockId, fileId, runtimeStore],
  );
  const runtime = useSyncExternalStore(subscribeRuntime, getRuntimeSnapshot, getRuntimeSnapshot);
  const attributes: FileNodeAttributes = {
    ...durableAttributes,
    ...runtime.file,
  };
  const mimeType = readString(attributes, 'mimeType').trim().toLowerCase();
  const url = readString(attributes, 'url');
  const originalUrl = readString(attributes, 'originalUrl');
  const hlsUrl = readString(attributes, 'hlsUrl');
  const thumbnailUrl = readString(attributes, 'thumbnailUrl');
  const name = readString(attributes, 'name') || readString(attributes, 'fileName') || tCommon('labels.file');
  const caption = readString(attributes, 'caption');
  const processingStatus = readString(attributes, 'processingStatus').trim().toLowerCase();
  const editorEditable = useTiptapEditorEditable(editor);
  const authoringMode = useOptionalEditorAuthoringMode();
  const exactNodeSelected = useExactTiptapNodeSelection({ editor, getPos });
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSource = isBlockId(fileId);
  const kind = resolveFileBlockViewKind({
    hasSource,
    mimeType,
    isLoadingMime: Boolean(hasSource && !mimeType && delivery.isLoading),
  });
  const authoringSelected = editorEditable && exactNodeSelected;
  const resize = useBlockResize({
    containerRef,
    previewWidth: readString(attributes, 'previewWidth') || '100',
    enabled: editorEditable && hasSource,
    onResize: (previewWidth) => {
      if (editor.isEditable) {
        updateAttributes({ previewWidth: String(previewWidth) });
      }
    },
  });
  const frameProps = {
    containerRef,
    widthPercent: resize.widthPercent,
    margin: resize.getMarginStyle(readString(attributes, 'textAlignment') as 'left' | 'center' | 'right'),
    allowResize: editorEditable && hasSource,
    isResizing: resize.isDragging !== null,
    selected: authoringSelected,
    onResizeLeftPointerDown: resize.startResizeLeft,
    onResizeRightPointerDown: resize.startResizeRight,
    onResizeLeftKeyDown: resize.onResizeKeyDown,
    onResizeRightKeyDown: resize.onResizeKeyDown,
    onResizeBlur: resize.onResizeBlur,
    resizeMin: resize.minWidth,
    resizeMax: resize.maxWidth,
  };
  const sizeText = formatMediaSize(readString(attributes, 'size'));
  const size = readString(attributes, 'size');
  const processingProgress = Math.max(0, Math.min(100, Number(readString(attributes, 'processingProgress')) || 0));

  let content: ReactNode;
  if (!hasSource) {
    content = (
      <Alert tone="danger" title={tMedia('statuses.failed')}>
        <Text size="sm">Invalid File block</Text>
      </Alert>
    );
  } else if (processingStatus === 'failed') {
    content = (
      <Alert tone="danger" title={tMedia('statuses.failed')}>
        <Text size="sm">{tMedia('statuses.failed')}</Text>
      </Alert>
    );
  } else if (processingStatus && processingStatus !== 'ready' && processingStatus !== 'completed') {
    content = (
      <MediaProcessingSurface
        label={tMedia('statuses.processing')}
        color="blue"
        progress={processingProgress}
        pending
        minHeight={mimeType.startsWith('image/') || mimeType.startsWith('video/') ? 132 : 88}
      />
    );
  } else {
    content = (
      <FileBlockView
        kind={kind}
        emptyTitle=""
        emptyDescription=""
        loadingLabel={tCommon('states.loading')}
        emptyInteractive={false}
        imageView={
          <EditorMediaBlockFrame {...frameProps}>
            <ImageMediaView src={url || originalUrl} alt={readString(attributes, 'alt') || name} caption={caption} />
          </EditorMediaBlockFrame>
        }
        audioView={
          <EditorMediaBlockFrame {...frameProps} suppressStaticTextSelection>
            <AudioMediaView
              model={resolveAudioViewModel({
                fileId,
                url,
                originalUrl,
                hlsUrl,
                waveformUrl: readString(attributes, 'waveformUrl'),
                caption,
                name,
                size,
                processingStatus,
                duration: readString(attributes, 'duration'),
              })}
            />
          </EditorMediaBlockFrame>
        }
        videoView={
          <EditorMediaBlockFrame {...frameProps} suppressStaticTextSelection>
            <VideoMediaView
              model={resolveVideoViewModel({
                fileId,
                url: originalUrl || url,
                hlsUrl,
                thumbnailUrl,
                caption,
                name,
                size,
                processingStatus,
                duration: readString(attributes, 'duration'),
              })}
            />
          </EditorMediaBlockFrame>
        }
        fileView={
          <EditorMediaBlockFrame {...frameProps} suppressStaticTextSelection>
            <AttachmentMediaView
              title={<span className="attachment-title">{name}</span>}
              meta={[getFileTypeName(mimeType), sizeText].filter(Boolean).join(' · ')}
              caption={caption}
            />
          </EditorMediaBlockFrame>
        }
      />
    );
  }

  return (
    <NodeViewWrapper
      className="editor-block-content tiptap-file-node"
      data-content-type="file"
      data-file-block=""
      data-file-kind={kind}
      data-file-state={processingStatus || kind}
      data-selected={authoringSelected || undefined}
      contentEditable={false}
    >
      {content}
      {authoringSelected ? (
        <>
          <FileBlockMetadataFields
            labels={{
              name: tCommonLabels('name'),
              alt: tCommonLabels('description'),
              caption: tCommonLabels('caption'),
              captionPlaceholder: tCommonLabels('caption'),
            }}
            mimeType={mimeType}
            name={readString(durableAttributes, 'name')}
            alt={readString(durableAttributes, 'alt')}
            caption={caption}
            allowNameEdit={authoringMode?.allowNeutralBlockEdits === true}
            allowLocalizedEdit={authoringMode?.allowLocalizedBlockEdits === true}
            onNameChange={(value) => updateAttributes({ name: value })}
            onAltChange={(value) => updateAttributes({ alt: value })}
            onCaptionChange={(value) => updateAttributes({ caption: value })}
          />
          <ConnectedMediaDownloadPolicyPanel fileId={fileId} blockId={blockId} blockType="file" />
        </>
      ) : null}
    </NodeViewWrapper>
  );
}

export function createTiptapFileNode(options: TiptapFileNodeOptions = {}) {
  return WireFile.extend<TiptapFileNodeOptions>({
    addOptions() {
      return options;
    },
    addNodeView() {
      const nodeOptions = this.options;
      return ReactNodeViewRenderer((props) => (
        <TiptapFileBlockNodeView
          {...props}
          onActivate={nodeOptions.onActivate}
          runtimeStore={nodeOptions.runtimeStore}
        />
      ));
    },
  });
}
