'use client';

import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useTranslations } from 'next-intl';

import { Alert } from '@/components/core/Alert';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useOptionalEditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import {
  ConnectedMediaDownloadPolicyPanel,
  useEditorMediaDownloadPolicyRuntimeTarget,
} from '@/features/editor/components/ConnectedMediaDownloadPolicyPanel';
import { MediaProcessingSurface } from '@/features/editor/components/MediaProcessingSurface';
import { useBlockResize } from '@/features/editor/hooks/useBlockResize';
import { useMediaAspectRatio } from '@/features/media/useMediaAspectRatio';
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
import { MissingMediaView } from '@/features/media/ui/MissingMediaView';
import { ImageMediaView } from '@/features/media/ui/ImageMediaView';
import { resolveAudioViewModel } from '@/lib/media/audio-view-model';
import { formatMediaSize } from '@/lib/media/shared';
import { resolveVideoViewModel } from '@/lib/media/video-view-model';
import { isBlockId } from '@/lib/editor/block-id';
import { getFileTypeName } from '@/lib/utils/file-icon';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { FileBlockView, resolveFileBlockViewKind } from '../blocks/FileBlock/FileBlockView';
import { WireFile } from './wire-schema';
import { useFileBlockSettingsSlot, type FileBlockSettingsSlot } from './menus/file-block-settings-slot';
import { useExactTiptapNodeSelection } from './useExactTiptapNodeSelection';
import { useTiptapEditorEditable } from './useTiptapEditorEditable';

type FileNodeAttributes = Record<string, unknown>;

export interface TiptapFileNodeOptions {
  onActivate?: (blockId: string) => void;
  runtimeStore?: EditorMediaRuntimeStore;
  /** Where the selected block's settings render, beside the editor rather than inside it. */
  settingsSlot?: FileBlockSettingsSlot;
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
  settingsSlot,
}: NodeViewProps & TiptapFileNodeOptions) {
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const tMedia = useTranslations('editorCommon.media');
  const tMissing = useTranslations('mediaCommon.missing');
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
  const settingsElement = useFileBlockSettingsSlot(settingsSlot);
  const downloadPolicyTarget = useEditorMediaDownloadPolicyRuntimeTarget();
  const canResize = editorEditable && hasSource;
  const hasSettings =
    authoringMode?.allowNeutralBlockEdits === true ||
    authoringMode?.allowLocalizedBlockEdits === true ||
    Boolean(downloadPolicyTarget && hasSource && blockId);
  const media = useMediaAspectRatio();
  const storedWidth = Number(readString(attributes, 'width')) || 0;
  const storedHeight = Number(readString(attributes, 'height')) || 0;
  const aspectRatio =
    kind === 'image' || kind === 'video'
      ? storedWidth > 0 && storedHeight > 0
        ? storedWidth / storedHeight
        : media.aspectRatio
      : undefined;
  const resize = useBlockResize({
    containerRef,
    displaySize: readString(attributes, 'displaySize') || '100',
    aspectRatio,
    enabled: canResize,
    onResize: (displaySize) => {
      if (editor.isEditable) {
        updateAttributes({ displaySize: String(displaySize) });
      }
    },
  });
  const frameProps = {
    containerRef,
    displaySize: resize.widthPercent,
    aspectRatio,
    margin: resize.getMarginStyle(readString(attributes, 'textAlignment') as 'left' | 'center' | 'right'),
    allowResize: canResize,
    isResizing: resize.isDragging !== null,
    selected: authoringSelected,
    onResizeLeftPointerDown: resize.startResizeLeft,
    onResizeRightPointerDown: resize.startResizeRight,
    onResizeTopPointerDown: resize.startResizeTop,
    onResizeBottomPointerDown: resize.startResizeBottom,
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
  const attachment = durableAttributes.attachment as { missingAttachment?: { mediaKind?: string | number } } | null;
  if (attachment?.missingAttachment) {
    const mediaKind = attachment.missingAttachment.mediaKind;
    const missingKind =
      mediaKind === 'image' || mediaKind === 1
        ? 'image'
        : mediaKind === 'video' || mediaKind === 3
          ? 'video'
          : mediaKind === 'audio' || mediaKind === 2
            ? 'audio'
            : 'file';
    content = (
      <EditorMediaBlockFrame {...frameProps}>
        <MissingMediaView kind={missingKind} message={tMissing(`${missingKind}Deleted`)} caption={caption} />
      </EditorMediaBlockFrame>
    );
  } else if (!hasSource) {
    content = (
      <Alert tone="danger" title={tMedia('statuses.failed')}>
        <DsText size="sm">Invalid File block</DsText>
      </Alert>
    );
  } else if (processingStatus === 'failed') {
    content = (
      <Alert tone="danger" title={tMedia('statuses.failed')}>
        <DsText size="sm">{tMedia('statuses.failed')}</DsText>
      </Alert>
    );
  } else if (processingStatus && processingStatus !== 'ready' && processingStatus !== 'completed') {
    content = (
      <MediaProcessingSurface
        label={tMedia('statuses.processing')}
        accessibleLabel={name}
        tone="accent"
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
            <ImageMediaView
              src={buildManagedImageUrl(url || originalUrl, MANAGED_IMAGE_PRESET.CONTENT_IMAGE) ?? ''}
              alt={readString(attributes, 'alt') || name}
              caption={caption}
              onNaturalSize={media.onNaturalSize}
            />
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
              onNaturalSize={media.onNaturalSize}
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
      {authoringSelected && hasSettings && settingsElement
        ? createPortal(
            <DsLayoutStack gap="sm">
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
            </DsLayoutStack>,
            settingsElement,
          )
        : null}
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
          settingsSlot={nodeOptions.settingsSlot}
        />
      ));
    },
  });
}
