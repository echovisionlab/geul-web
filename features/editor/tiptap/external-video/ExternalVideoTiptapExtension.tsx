'use client';

import { useCallback, useMemo, type ComponentType } from 'react';
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import {
  EXTERNAL_VIDEO_ASPECT_RATIO_VALUES,
  EXTERNAL_VIDEO_PREVIEW_WIDTH_DEFAULT,
  EXTERNAL_VIDEO_PREVIEW_WIDTH_MAX_PERCENT,
  EXTERNAL_VIDEO_PREVIEW_WIDTH_MIN_PERCENT,
  type ExternalVideoAspectRatio,
} from '@echovisionlab/geul-common/media/block-schemas';
import {
  ExternalVideoEditorPreview,
  type ExternalVideoEditorPreviewLabels,
} from '@/features/editor/ExternalVideoEditorPreview';
import type { ExternalVideoViewProps } from '@/features/media/ExternalVideoView';
import {
  resolveStandaloneExternalVideoTitle,
  type ExternalVideoProviderTitleLabels,
} from '@/features/media/standalone-external-video';
import { resolveExternalVideo } from '@/lib/media/external-video';
import enMessages from '@/messages/en.json';
import { WireExternalVideo } from '../wire-schema';
import { useExactTiptapNodeSelection } from '../useExactTiptapNodeSelection';
import { useTiptapEditorEditable } from '../useTiptapEditorEditable';

const pluginKey = new PluginKey('externalVideo');

const TIPTAP_EXTERNAL_VIDEO_LABEL_KEYS = [
  'editLink',
  'showPreview',
  'aspectRatio',
  'automaticAspectRatio',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'youtubeTitle',
  'vimeoTitle',
] as const satisfies readonly (keyof TiptapExternalVideoLabels)[];

export interface TiptapExternalVideoLabels extends ExternalVideoEditorPreviewLabels, ExternalVideoProviderTitleLabels {}

export interface TiptapExternalVideoOptions {
  labels?: TiptapExternalVideoLabels;
  videoView?: ComponentType<ExternalVideoViewProps>;
}

export interface TiptapStandaloneExternalVideo {
  blockId: string;
  /** Position of the durable Block container. */
  blockPosition: number;
  /** Position of the editor-only externalVideo atom inside the container. */
  nodePosition: number;
  node: ProseMirrorNode;
  url: string;
  title: string;
  previewWidth: string;
  textAlignment: 'left' | 'center' | 'right';
  aspectRatio: ExternalVideoAspectRatio;
}

export interface TiptapExternalVideoLayout {
  previewWidth?: string;
  textAlignment?: 'left' | 'center' | 'right';
  aspectRatio?: ExternalVideoAspectRatio;
}

export interface TiptapExternalVideoSource {
  url: string;
  label: string;
}

interface RootParagraphBlock {
  blockId: string;
  blockPosition: number;
  paragraphPosition: number;
  paragraph: ProseMirrorNode;
}

interface StandaloneParagraphVideo extends RootParagraphBlock {
  url: string;
  label: string;
}

export class UnsupportedTiptapExternalVideoError extends Error {
  constructor(reason: string) {
    super(`Tiptap external-video is unsupported: ${reason}`);
    this.name = 'UnsupportedTiptapExternalVideoError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireExternalVideoLabels(value: unknown, source: string): TiptapExternalVideoLabels {
  if (!isRecord(value)) {
    throw new UnsupportedTiptapExternalVideoError(`missing ${source}`);
  }
  for (const key of TIPTAP_EXTERNAL_VIDEO_LABEL_KEYS) {
    if (typeof value[key] !== 'string' || !value[key].trim()) {
      throw new UnsupportedTiptapExternalVideoError(`missing ${source}.${key}`);
    }
  }
  return {
    editLink: value.editLink as string,
    showPreview: value.showPreview as string,
    aspectRatio: value.aspectRatio as string,
    automaticAspectRatio: value.automaticAspectRatio as string,
    alignLeft: value.alignLeft as string,
    alignCenter: value.alignCenter as string,
    alignRight: value.alignRight as string,
    youtubeTitle: value.youtubeTitle as string,
    vimeoTitle: value.vimeoTitle as string,
  };
}

/** Compatibility default; production editors inject labels for the current locale. */
export const DEFAULT_TIPTAP_EXTERNAL_VIDEO_LABELS = {
  editLink: enMessages.editorCommon.editor.link.edit,
  showPreview: 'Show preview',
  aspectRatio: enMessages.pageEditor.externalVideo.aspectRatioLabel,
  automaticAspectRatio: enMessages.pageEditor.externalVideo.aspectRatioAuto,
  alignLeft: enMessages.editorCommon.editor.formatting.alignLeft,
  alignCenter: enMessages.editorCommon.editor.formatting.alignCenter,
  alignRight: enMessages.editorCommon.editor.formatting.alignRight,
  youtubeTitle: enMessages.editorCommon.editor.runtimeLabels.externalVideo.youtubeTitle,
  vimeoTitle: enMessages.editorCommon.editor.runtimeLabels.externalVideo.vimeoTitle,
} satisfies TiptapExternalVideoLabels;

function normalizePreviewWidth(value: unknown): string {
  const parsed = Number.parseInt(String(value ?? EXTERNAL_VIDEO_PREVIEW_WIDTH_DEFAULT), 10);
  return String(
    Math.max(
      EXTERNAL_VIDEO_PREVIEW_WIDTH_MIN_PERCENT,
      Math.min(
        EXTERNAL_VIDEO_PREVIEW_WIDTH_MAX_PERCENT,
        Number.isFinite(parsed) ? parsed : Number.parseInt(EXTERNAL_VIDEO_PREVIEW_WIDTH_DEFAULT, 10),
      ),
    ),
  );
}

function normalizeAlignment(value: unknown): TiptapStandaloneExternalVideo['textAlignment'] {
  return value === 'center' || value === 'right' ? value : 'left';
}

function normalizeAspectRatio(value: unknown): ExternalVideoAspectRatio {
  return typeof value === 'string' && (EXTERNAL_VIDEO_ASPECT_RATIO_VALUES as readonly string[]).includes(value)
    ? (value as ExternalVideoAspectRatio)
    : 'auto';
}

function sourceLinkHref(paragraph: ProseMirrorNode): string | null {
  let href: string | null = null;
  let hasLinkedText = false;
  let supported = true;
  paragraph.forEach((inline) => {
    if (!supported) {
      return;
    }
    if (!inline.isText) {
      supported = false;
      return;
    }
    const text = inline.text ?? '';
    const link = inline.marks.find((mark) => mark.type.name === 'link');
    if (!text.trim()) {
      if (link) {
        const candidate = typeof link.attrs.href === 'string' ? link.attrs.href.trim() : '';
        if (!candidate || (href && href !== candidate)) {
          supported = false;
        } else {
          href = candidate;
        }
      }
      return;
    }
    if (!link) {
      supported = false;
      return;
    }
    const candidate = typeof link.attrs.href === 'string' ? link.attrs.href.trim() : '';
    if (!candidate || (href && href !== candidate)) {
      supported = false;
      return;
    }
    href = candidate;
    hasLinkedText = true;
  });
  return supported && hasLinkedText ? href : null;
}

function rootParagraphBlocks(state: Pick<EditorState, 'doc'>): RootParagraphBlock[] {
  const blockGroup = state.doc.firstChild;
  if (!blockGroup || blockGroup.type.name !== 'blockGroup') {
    return [];
  }
  const blocks: RootParagraphBlock[] = [];
  let blockPosition = 1;
  blockGroup.forEach((blockContainer) => {
    const paragraph = blockContainer.firstChild;
    const blockId = typeof blockContainer.attrs.id === 'string' ? blockContainer.attrs.id : '';
    if (blockId && blockContainer.childCount === 1 && paragraph?.type.name === 'paragraph') {
      blocks.push({
        blockId,
        blockPosition,
        paragraphPosition: blockPosition + 1,
        paragraph,
      });
    }
    blockPosition += blockContainer.nodeSize;
  });
  return blocks;
}

function standaloneParagraphVideo(block: RootParagraphBlock): StandaloneParagraphVideo | null {
  const url = sourceLinkHref(block.paragraph);
  if (!url || !resolveExternalVideo(url)) {
    return null;
  }
  return {
    ...block,
    url,
    label: block.paragraph.textContent.trim() || url,
  };
}

function externalVideoAttributes(video: StandaloneParagraphVideo): Record<string, unknown> {
  return {
    ...video.paragraph.attrs,
    url: video.url,
    label: video.label,
    sourceContent: video.paragraph.content.toJSON(),
  };
}

function getTiptapStandaloneExternalVideosFromState(
  state: Pick<EditorState, 'doc'>,
  providerTitleLabels?: ExternalVideoProviderTitleLabels,
): TiptapStandaloneExternalVideo[] {
  const blockGroup = state.doc.firstChild;
  if (!blockGroup || blockGroup.type.name !== 'blockGroup') {
    return [];
  }
  const entries: TiptapStandaloneExternalVideo[] = [];
  let blockPosition = 1;
  blockGroup.forEach((blockContainer) => {
    const node = blockContainer.firstChild;
    const blockId = typeof blockContainer.attrs.id === 'string' ? blockContainer.attrs.id : '';
    const url = node?.type.name === 'externalVideo' && typeof node.attrs.url === 'string' ? node.attrs.url.trim() : '';
    const resolved = url ? resolveExternalVideo(url) : null;
    if (blockId && node && resolved) {
      const label = typeof node.attrs.label === 'string' ? node.attrs.label.trim() : '';
      entries.push({
        blockId,
        blockPosition,
        nodePosition: blockPosition + 1,
        node,
        url,
        title: resolveStandaloneExternalVideoTitle(label || url, url, resolved.provider, providerTitleLabels),
        previewWidth: normalizePreviewWidth(node.attrs.previewWidth),
        textAlignment: normalizeAlignment(node.attrs.textAlignment),
        aspectRatio: normalizeAspectRatio(node.attrs.aspectRatio),
      });
    }
    blockPosition += blockContainer.nodeSize;
  });
  return entries;
}

export function getTiptapStandaloneExternalVideos(
  view: EditorView,
  providerTitleLabels?: ExternalVideoProviderTitleLabels,
): TiptapStandaloneExternalVideo[] {
  return getTiptapStandaloneExternalVideosFromState(view.state, providerTitleLabels);
}

export function assertTiptapExternalVideoSupport(editor: Pick<Editor, 'schema'>): void {
  const externalVideo = editor.schema.nodes.externalVideo;
  const paragraph = editor.schema.nodes.paragraph;
  const missing = [
    !editor.schema.nodes.doc && 'doc',
    !editor.schema.nodes.blockGroup && 'blockGroup',
    !editor.schema.nodes.blockContainer && 'blockContainer',
    !externalVideo && 'externalVideo',
    !paragraph && 'paragraph',
    !editor.schema.marks.link && 'link mark',
    !externalVideo?.spec.attrs?.url && 'externalVideo.url',
    !externalVideo?.spec.attrs?.label && 'externalVideo.label',
    !externalVideo?.spec.attrs?.sourceContent && 'externalVideo.sourceContent',
    !paragraph?.spec.attrs?.previewWidth && 'paragraph.previewWidth',
    !paragraph?.spec.attrs?.aspectRatio && 'paragraph.aspectRatio',
  ].filter(Boolean);
  if (missing.length) {
    throw new UnsupportedTiptapExternalVideoError(`missing ${missing.join(', ')}`);
  }
}

function isPreviewSelected(view: EditorView, entry: TiptapStandaloneExternalVideo): boolean {
  return (
    view.state.selection instanceof NodeSelection &&
    (view.state.selection.from === entry.blockPosition || view.state.selection.from === entry.nodePosition)
  );
}

function findSelectedExternalVideo(view: EditorView): TiptapStandaloneExternalVideo | null {
  if (!(view.state.selection instanceof NodeSelection)) {
    return null;
  }
  return getTiptapStandaloneExternalVideos(view).find((entry) => isPreviewSelected(view, entry)) ?? null;
}

function externalVideoSourceContent(url: string, label: string) {
  return [{ type: 'text', text: label, marks: [{ type: 'link', attrs: { href: url } }] }];
}

/** Updates the atom in place so editing its link never tears down the media NodeView. */
export function updateTiptapExternalVideoSource(
  editor: Editor,
  source: TiptapExternalVideoSource,
  blockId?: string,
): boolean {
  const entry = getTiptapStandaloneExternalVideos(editor.view).find(
    (candidate) => candidate.blockId === blockId || (!blockId && isPreviewSelected(editor.view, candidate)),
  );
  const url = source.url.trim();
  if (!entry || !editor.isEditable || !resolveExternalVideo(url)) {
    return false;
  }
  const label = source.label.trim() || url;
  const attrs = {
    ...entry.node.attrs,
    url,
    label,
    sourceContent: externalVideoSourceContent(url, label),
  };
  editor.view.dispatch(editor.state.tr.setNodeMarkup(entry.nodePosition, undefined, attrs).scrollIntoView());
  return true;
}

/** Persists layout on the editor atom; the Block Room codec writes it to Paragraph props. */
export function updateTiptapExternalVideoLayout(
  editor: Editor,
  layout: TiptapExternalVideoLayout,
  blockId?: string,
): boolean {
  const entry = getTiptapStandaloneExternalVideos(editor.view).find(
    (candidate) => candidate.blockId === blockId || (!blockId && isPreviewSelected(editor.view, candidate)),
  );
  if (!entry || !editor.isEditable) {
    return false;
  }
  const attrs = {
    ...entry.node.attrs,
    ...(layout.previewWidth === undefined ? {} : { previewWidth: normalizePreviewWidth(layout.previewWidth) }),
    ...(layout.textAlignment === undefined ? {} : { textAlignment: normalizeAlignment(layout.textAlignment) }),
    ...(layout.aspectRatio === undefined ? {} : { aspectRatio: normalizeAspectRatio(layout.aspectRatio) }),
  };
  editor.view.dispatch(editor.state.tr.setNodeMarkup(entry.nodePosition, undefined, attrs).scrollIntoView());
  return true;
}

function findParagraphBlockById(editor: Editor, blockId: string): RootParagraphBlock | null {
  return rootParagraphBlocks(editor.state).find((block) => block.blockId === blockId) ?? null;
}

function findCurrentParagraphBlock(editor: Editor): RootParagraphBlock | null {
  const position = editor.state.selection.from;
  return (
    rootParagraphBlocks(editor.state).find(
      (block) =>
        position >= block.paragraphPosition + 1 &&
        position <= block.paragraphPosition + block.paragraph.content.size + 1,
    ) ?? null
  );
}

/** Inserts the Geul atom while retaining the exact source link in node attrs. */
export function replaceParagraphWithTiptapExternalVideo(
  editor: Editor,
  input: { url: string; label: string },
  fallbackBlockId?: string,
): boolean {
  const url = input.url.trim();
  const externalVideo = editor.schema.nodes.externalVideo;
  const link = editor.schema.marks.link;
  if (!editor.isEditable || !externalVideo || !link || !resolveExternalVideo(url)) {
    return false;
  }
  const target = fallbackBlockId ? findParagraphBlockById(editor, fallbackBlockId) : findCurrentParagraphBlock(editor);
  if (!target) {
    return false;
  }
  const label = input.label.trim() || url;
  const node = externalVideo.create({
    ...target.paragraph.attrs,
    url,
    label,
    sourceContent: externalVideoSourceContent(url, label),
  });
  const transaction = editor.state.tr.replaceWith(
    target.paragraphPosition,
    target.paragraphPosition + target.paragraph.nodeSize,
    node,
  );
  transaction.setSelection(NodeSelection.create(transaction.doc, target.paragraphPosition)).scrollIntoView();
  editor.view.dispatch(transaction);
  editor.view.focus();
  return true;
}

function promotionTransaction(state: EditorState) {
  const externalVideo = state.schema.nodes.externalVideo;
  if (!externalVideo) {
    return null;
  }
  const videos = rootParagraphBlocks(state)
    .map(standaloneParagraphVideo)
    .filter((video): video is StandaloneParagraphVideo => video !== null);
  if (!videos.length) {
    return null;
  }
  const transaction = state.tr;
  for (const video of videos.reverse()) {
    transaction.replaceWith(
      video.paragraphPosition,
      video.paragraphPosition + video.paragraph.nodeSize,
      externalVideo.create(externalVideoAttributes(video)),
    );
  }
  return transaction.setMeta('addToHistory', false);
}

function handleExternalVideoPaste(view: EditorView, event: ClipboardEvent): boolean {
  if (!view.editable) {
    return false;
  }
  const url = event.clipboardData?.getData('text/plain').trim() ?? '';
  if (!url || url.includes('\n') || !resolveExternalVideo(url)) {
    return false;
  }
  const block = rootParagraphBlocks(view.state).find(
    (candidate) =>
      view.state.selection.from >= candidate.paragraphPosition + 1 &&
      view.state.selection.to <= candidate.paragraphPosition + candidate.paragraph.content.size + 1,
  );
  const externalVideo = view.state.schema.nodes.externalVideo;
  const link = view.state.schema.marks.link;
  if (!block || !externalVideo || !link || (block.paragraph.content.size > 0 && view.state.selection.empty)) {
    return false;
  }
  const sourceContent = [{ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }];
  const node = externalVideo.create({ ...block.paragraph.attrs, url, label: url, sourceContent });
  const transaction = view.state.tr.replaceWith(
    block.paragraphPosition,
    block.paragraphPosition + block.paragraph.nodeSize,
    node,
  );
  transaction.setSelection(NodeSelection.create(transaction.doc, block.paragraphPosition)).scrollIntoView();
  view.dispatch(transaction);
  return true;
}

function TiptapExternalVideoNodeView({
  editor,
  getPos,
  node,
  updateAttributes,
  labels,
  videoView,
}: NodeViewProps & { labels: TiptapExternalVideoLabels; videoView?: ComponentType<ExternalVideoViewProps> }) {
  const editorEditable = useTiptapEditorEditable(editor);
  const exactNodeSelected = useExactTiptapNodeSelection({ editor, getPos });
  const url = typeof node.attrs.url === 'string' ? node.attrs.url.trim() : '';
  const resolved = resolveExternalVideo(url);
  const rawLabel = typeof node.attrs.label === 'string' ? node.attrs.label.trim() : '';
  const title = resolved
    ? resolveStandaloneExternalVideoTitle(rawLabel || url, url, resolved.provider, labels)
    : rawLabel || url;
  const video = useMemo(
    () => ({
      url,
      title,
      previewWidth: normalizePreviewWidth(node.attrs.previewWidth),
      textAlignment: normalizeAlignment(node.attrs.textAlignment),
      aspectRatio: normalizeAspectRatio(node.attrs.aspectRatio),
    }),
    [node.attrs.aspectRatio, node.attrs.previewWidth, node.attrs.textAlignment, title, url],
  );
  const select = useCallback(() => {
    const position = getPos();
    if (
      !editor.isEditable ||
      typeof position !== 'number' ||
      editor.state.doc.nodeAt(position)?.type.name !== 'externalVideo'
    ) {
      return;
    }
    editor.commands.setNodeSelection(position);
    editor.view.focus();
  }, [editor, getPos]);
  const canSelect = useCallback(() => editor.isEditable, [editor]);
  const updatePreviewWidth = useCallback(
    (previewWidth: string) => {
      if (editor.isEditable) {
        updateAttributes({ previewWidth: normalizePreviewWidth(previewWidth) });
      }
    },
    [editor, updateAttributes],
  );

  return (
    <NodeViewWrapper
      className="editor-block-content tiptap-external-video-node"
      data-content-type="externalVideo"
      data-tiptap-external-video-widget="true"
      data-external-video-node=""
      contentEditable={false}
    >
      <ExternalVideoEditorPreview
        mode="preview"
        video={video}
        labels={labels}
        videoView={videoView}
        editable={editorEditable}
        selected={editorEditable && exactNodeSelected}
        canSelect={canSelect}
        onSelect={select}
        onShowPreview={select}
        onPreviewWidthChange={updatePreviewWidth}
      />
    </NodeViewWrapper>
  );
}

/**
 * Geul-owned external-video atom. It follows Tiptap's native atom-node model,
 * while the Block Room codec preserves the existing Paragraph-link contract.
 */
export function createTiptapExternalVideoExtension(options: TiptapExternalVideoOptions = {}) {
  const labels = requireExternalVideoLabels(options.labels, 'TiptapExternalVideoOptions.labels');
  return WireExternalVideo.extend<TiptapExternalVideoOptions>({
    addOptions() {
      return { labels, videoView: options.videoView };
    },
    addGlobalAttributes() {
      return [
        {
          types: ['paragraph'],
          attributes: {
            previewWidth: { default: Number(EXTERNAL_VIDEO_PREVIEW_WIDTH_DEFAULT) },
            aspectRatio: { default: 'auto' as ExternalVideoAspectRatio },
          },
        },
      ];
    },
    onCreate() {
      assertTiptapExternalVideoSupport(this.editor);
    },
    addNodeView() {
      const nodeOptions = this.options;
      return ReactNodeViewRenderer((props) => (
        <TiptapExternalVideoNodeView
          {...props}
          labels={requireExternalVideoLabels(nodeOptions.labels, 'TiptapExternalVideoOptions.labels')}
          videoView={nodeOptions.videoView}
        />
      ));
    },
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: pluginKey,
          appendTransaction: (transactions, _previous, state) => {
            const shouldPromote = transactions.some(
              (transaction) => transaction.docChanged || transaction.getMeta(pluginKey) === 'refresh',
            );
            if (!shouldPromote) {
              return null;
            }
            return promotionTransaction(state);
          },
          props: {
            handleTextInput: (view) => Boolean(findSelectedExternalVideo(view)),
            handlePaste: (view, event) => handleExternalVideoPaste(view, event),
          },
          view: (view) => {
            queueMicrotask(() => {
              if (!view.isDestroyed) {
                view.dispatch(view.state.tr.setMeta(pluginKey, 'refresh'));
              }
            });
            return {};
          },
        }),
      ];
    },
  });
}
