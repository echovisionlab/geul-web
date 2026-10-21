'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { Extension, type Editor } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useEditorMediaRuntimeBinding } from '@/features/editor/hooks/useEditorMediaRuntimeBinding';
import type {
  EditorMediaRuntimeSnapshot,
  EditorMediaRuntimeStore,
} from '@/features/editor/lib/editor-media-runtime-store';
import { LinkCardView } from '@/features/media/ui/LinkCardView';
import { liveNodeView } from '../live-node-view';
import type { LinkPresentationLabels } from '../menus/map-external/LinkPresentationActions';
import { useExactTiptapNodeSelection } from '../useExactTiptapNodeSelection';
import { WireLinkCard } from '../wire-schema';
import {
  applyLinkPreview,
  findStandaloneLink,
  isolateLinkBlock,
  setLinkPresentation,
  type LinkPresentation,
} from './link-presentation';

export interface LinkPreviewSource {
  title: string;
  description: string;
  siteName: string;
  imageSource: string;
}

/** Entity-owned services: the server preview read and the thumbnail File import. */
export interface LinkPresentationRuntime {
  loadPreview: (url: string) => Promise<LinkPreviewSource | null>;
  importThumbnail?: (imageSource: string) => Promise<string | null>;
}

export interface TiptapLinkCardOptions {
  labels: LinkPresentationLabels;
  runtimeStore?: EditorMediaRuntimeStore;
}

interface LinkPresentationState {
  /** The link just pasted, until the author chooses or keeps editing. */
  pasted: { blockId: string; url: string } | null;
  /** Blocks whose preview is being read. */
  pending: readonly string[];
}

type LinkPresentationMeta = { pasted: LinkPresentationState['pasted'] } | { pending: string; active: boolean };

export const linkPresentationPluginKey = new PluginKey<LinkPresentationState>('linkPresentation');
const SINGLE_URL = /^https?:\/\/\S+$/iu;
const EMPTY_SNAPSHOT: EditorMediaRuntimeSnapshot = Object.freeze({});

export function getLinkPresentationState(state: EditorState): LinkPresentationState {
  return linkPresentationPluginKey.getState(state) ?? { pasted: null, pending: [] };
}

function setPending(editor: Editor, blockId: string, active: boolean) {
  if (!editor.isDestroyed) {
    editor.view.dispatch(
      editor.state.tr.setMeta(linkPresentationPluginKey, { pending: blockId, active } satisfies LinkPresentationMeta),
    );
  }
}

export function dismissPastedLink(editor: Editor) {
  if (!editor.isDestroyed && getLinkPresentationState(editor.state).pasted) {
    editor.view.dispatch(
      editor.state.tr.setMeta(linkPresentationPluginKey, { pasted: null } satisfies LinkPresentationMeta),
    );
  }
}

/**
 * Applies a chosen presentation and, for a card or video, reads the page's
 * preview and imports its image as the thumbnail File. A link pasted into
 * text moves to its own paragraph first. Refresh re-reads an existing preview.
 */
export async function chooseLinkPresentation(
  editor: Editor,
  runtime: LinkPresentationRuntime | undefined,
  target: { blockId: string; url: string },
  presentation: LinkPresentation,
  { refresh = false }: { refresh?: boolean } = {},
): Promise<boolean> {
  const blockId = presentation === 'link' ? target.blockId : isolateLinkBlock(editor, target.blockId, target.url);
  dismissPastedLink(editor);
  if (!blockId || !findStandaloneLink(editor.state, blockId)) {
    return presentation === 'link';
  }
  if (!setLinkPresentation(editor, blockId, presentation)) {
    return false;
  }
  const entry = findStandaloneLink(editor.state, blockId);
  const attrs = entry?.node.attrs ?? {};
  const hasPreview = Boolean(attrs.linkSiteName || attrs.linkDescription || attrs.linkThumbnailFileId);
  if (!runtime || !entry || presentation === 'link' || (hasPreview && !refresh)) {
    return true;
  }
  setPending(editor, blockId, true);
  try {
    const preview = await runtime.loadPreview(entry.url);
    if (!preview || editor.isDestroyed) {
      return true;
    }
    const thumbnailFileId =
      preview.imageSource && runtime.importThumbnail
        ? await runtime.importThumbnail(preview.imageSource).catch(() => null)
        : null;
    applyLinkPreview(editor, blockId, entry.url, {
      title: preview.title,
      description: preview.description,
      siteName: preview.siteName,
      ...(thumbnailFileId ? { thumbnailFileId } : {}),
    });
    return true;
  } finally {
    setPending(editor, blockId, false);
  }
}

function linkPresentationPlugin() {
  let pastedUrl: string | null = null;
  return new Plugin<LinkPresentationState>({
    key: linkPresentationPluginKey,
    state: {
      init: () => ({ pasted: null, pending: [] }),
      apply(transaction, value) {
        const meta = transaction.getMeta(linkPresentationPluginKey) as LinkPresentationMeta | undefined;
        if (meta && 'pending' in meta) {
          const pending = value.pending.filter((id) => id !== meta.pending);
          return { ...value, pending: meta.active ? [...pending, meta.pending] : pending };
        }
        if (meta && 'pasted' in meta) {
          return { ...value, pasted: meta.pasted };
        }
        // Typing or any other edit keeps the link as it is, like Notion's menu.
        return transaction.docChanged && value.pasted && !transaction.getMeta('appendedTransaction')
          ? { ...value, pasted: null }
          : value;
      },
    },
    props: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain').trim() ?? '';
        pastedUrl = view.editable && SINGLE_URL.test(text) ? text : null;
        return false;
      },
      handleKeyDown(view, event) {
        if (event.key === 'Escape' && getLinkPresentationState(view.state).pasted) {
          view.dispatch(view.state.tr.setMeta(linkPresentationPluginKey, { pasted: null }));
          return true;
        }
        return false;
      },
    },
    view: () => ({
      update(view, previous) {
        const url = pastedUrl;
        if (!url || view.state.doc.eq(previous.doc)) {
          return;
        }
        pastedUrl = null;
        const { $from } = view.state.selection;
        const blockId = String($from.depth >= 2 ? ($from.node(2)?.attrs.id ?? '') : '');
        if (!blockId || $from.depth > 3) {
          return;
        }
        const entry = findStandaloneLink(view.state, blockId);
        const transaction = view.state.tr.setMeta(linkPresentationPluginKey, {
          pasted: { blockId, url },
        } satisfies LinkPresentationMeta);
        // A pasted video is already projected; select it so its menu offers the choices.
        if (entry && entry.url === url && entry.presentation !== 'link') {
          transaction.setSelection(NodeSelection.create(view.state.doc, entry.contentPosition));
        }
        queueMicrotask(() => {
          if (!view.isDestroyed) {
            view.dispatch(transaction);
          }
        });
      },
    }),
  });
}

function getParentBlockId(editor: Editor, getPos: NodeViewProps['getPos']): string {
  const position = getPos();
  return typeof position === 'number' ? String(editor.state.doc.resolve(position).parent.attrs.id ?? '') : '';
}

/** The stored thumbnail File's delivery URL for a card or video atom in the editor. */
export function useEditorLinkThumbnail(
  editor: Editor,
  getPos: NodeViewProps['getPos'],
  fileId: string,
  runtimeStore?: EditorMediaRuntimeStore,
): string | null {
  const blockId = getParentBlockId(editor, getPos);
  useEditorMediaRuntimeBinding({ blockId, fileId, runtimeStore });
  const subscribe = useCallback(
    (listener: () => void) => runtimeStore?.subscribe(blockId, listener) ?? (() => {}),
    [blockId, runtimeStore],
  );
  const snapshot = useCallback(
    () => (fileId ? (runtimeStore?.getSnapshot(blockId, fileId) ?? EMPTY_SNAPSHOT) : EMPTY_SNAPSHOT),
    [blockId, fileId, runtimeStore],
  );
  const runtime = useSyncExternalStore(subscribe, snapshot, snapshot);
  const url = runtime.file?.thumbnailUrl || runtime.file?.url;
  return typeof url === 'string' && url ? url : null;
}

function usePreviewPending(editor: Editor, blockId: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      editor.on('transaction', listener);
      return () => {
        editor.off('transaction', listener);
      };
    },
    [editor],
  );
  return useSyncExternalStore(
    subscribe,
    () => getLinkPresentationState(editor.state).pending.includes(blockId),
    () => false,
  );
}

function TiptapLinkCardNodeView({ editor, getPos, node, labels, runtimeStore }: NodeViewProps & TiptapLinkCardOptions) {
  const url = String(node.attrs.url ?? '');
  const label = String(node.attrs.label ?? '');
  const blockId = getParentBlockId(editor, getPos);
  const thumbnailUrl = useEditorLinkThumbnail(
    editor,
    getPos,
    String(node.attrs.linkThumbnailFileId ?? ''),
    runtimeStore,
  );
  const pending = usePreviewPending(editor, blockId);
  const selected = useExactTiptapNodeSelection({ editor, getPos });
  return (
    <NodeViewWrapper
      data-link-card-node=""
      data-selected={selected ? '' : undefined}
      contentEditable={false}
      draggable={false}
    >
      <LinkCardView
        url={url}
        title={label === url ? '' : label}
        description={String(node.attrs.linkDescription ?? '')}
        siteName={String(node.attrs.linkSiteName ?? '')}
        thumbnailUrl={thumbnailUrl}
        loadingLabel={pending ? labels.loadingPreview : undefined}
        interactive={false}
      />
    </NodeViewWrapper>
  );
}

/** Card projection of a standalone paragraph link. */
export function createTiptapLinkCardExtension(options: TiptapLinkCardOptions) {
  return WireLinkCard.extend<TiptapLinkCardOptions>({
    addOptions() {
      return options;
    },
    addNodeView() {
      const nodeOptions = this.options;
      return ReactNodeViewRenderer(
        liveNodeView(this.name, nodeOptions, (props, current) => (
          <TiptapLinkCardNodeView {...props} labels={current.labels} runtimeStore={current.runtimeStore} />
        )),
      );
    },
  });
}

/**
 * Notices a single pasted URL and opens the link / card / video choice. It
 * runs before Markdown paste, which inserts the link, and never handles the
 * paste itself.
 */
export const LinkPresentationPaste = Extension.create({
  name: 'linkPresentationPaste',
  priority: 950,
  addProseMirrorPlugins() {
    return [linkPresentationPlugin()];
  },
});
