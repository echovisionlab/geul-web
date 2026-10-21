import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { createBlockId } from '@/lib/editor/block-id';
import { resolveExternalVideo } from '@/lib/media/external-video';

/** A standalone paragraph link is shown as a link, a card or (for supported URLs) a video. */
export type LinkPresentation = 'link' | 'card' | 'video';

export interface StandaloneLinkBlock {
  blockId: string;
  /** Position of the root Block container. */
  containerPosition: number;
  /** Position of its content node: a paragraph or a linkCard/externalVideo atom. */
  contentPosition: number;
  node: ProseMirrorNode;
  url: string;
  label: string;
  presentation: LinkPresentation;
}

export interface LinkPreviewResult {
  title?: string;
  description?: string;
  siteName?: string;
  thumbnailFileId?: string;
}

const ATOM_PRESENTATION: Record<string, LinkPresentation> = { linkCard: 'card', externalVideo: 'video' };
const STANDALONE_ONLY_ATTRIBUTES = new Set(['url', 'label', 'sourceContent']);

/** The single link a paragraph holds: whitespace may surround it, other text may not. */
export function paragraphLink(paragraph: ProseMirrorNode): string | null {
  let href: string | null = null;
  let linked = false;
  let supported = paragraph.childCount > 0;
  paragraph.forEach((inline) => {
    const mark = inline.marks.find((candidate) => candidate.type.name === 'link');
    const candidate = typeof mark?.attrs.href === 'string' ? mark.attrs.href.trim() : '';
    if (!supported || !inline.isText) {
      supported = false;
    } else if (!(inline.text ?? '').trim()) {
      supported = !mark || !href || href === candidate;
    } else if (!candidate || (href && href !== candidate)) {
      supported = false;
    } else {
      href = candidate;
      linked = true;
    }
  });
  return supported && linked ? href : null;
}

export function findStandaloneLink(state: Pick<EditorState, 'doc'>, blockId: string): StandaloneLinkBlock | null {
  const group = state.doc.firstChild;
  if (!group || group.type.name !== 'blockGroup') {
    return null;
  }
  let found: StandaloneLinkBlock | null = null;
  let position = 1;
  group.forEach((container) => {
    const node = container.firstChild;
    if (!found && container.attrs.id === blockId && node && container.childCount === 1) {
      const presentation = ATOM_PRESENTATION[node.type.name];
      const url = presentation ? String(node.attrs.url ?? '').trim() : paragraphLink(node);
      if (url && (presentation || node.type.name === 'paragraph')) {
        found = {
          blockId,
          containerPosition: position,
          contentPosition: position + 1,
          node,
          url,
          label: presentation ? String(node.attrs.label ?? '').trim() || url : node.textContent.trim() || url,
          presentation: presentation ?? 'link',
        };
      }
    }
    position += container.nodeSize;
  });
  return found;
}

/** Choices in Notion's order: what the URL most likely wants first, the plain link last for media. */
export function availableLinkPresentations(url: string, schema: Schema): LinkPresentation[] {
  const card = schema.nodes.linkCard ? (['card'] as const) : [];
  if (schema.nodes.externalVideo && resolveExternalVideo(url)) {
    return ['video', ...card, 'link'];
  }
  return ['link', ...card];
}

function paragraphFrom(entry: StandaloneLinkBlock, schema: Schema, presentation: LinkPresentation): ProseMirrorNode {
  const paragraph = schema.nodes.paragraph!;
  if (entry.node.type.name === 'paragraph') {
    return paragraph.create({ ...entry.node.attrs, linkPresentation: presentation }, entry.node.content);
  }
  const attrs = Object.fromEntries(
    Object.entries(entry.node.attrs).filter(([name]) => !STANDALONE_ONLY_ATTRIBUTES.has(name)),
  );
  const source = Array.isArray(entry.node.attrs.sourceContent) ? entry.node.attrs.sourceContent : [];
  const content = source.length
    ? source.map((item: unknown) => schema.nodeFromJSON(item))
    : [schema.text(entry.label, [schema.marks.link!.create({ href: entry.url })])];
  return paragraph.create({ ...attrs, linkPresentation: presentation }, content);
}

/**
 * Records the presentation on the durable Paragraph. The external-video
 * plugin then projects a card or video atom, and a plain link stays text.
 */
export function setLinkPresentation(editor: Editor, blockId: string, presentation: LinkPresentation): boolean {
  const entry = findStandaloneLink(editor.state, blockId);
  if (!entry || !editor.isEditable || !availableLinkPresentations(entry.url, editor.schema).includes(presentation)) {
    return false;
  }
  if (entry.presentation === presentation && entry.node.attrs.linkPresentation === presentation) {
    return true;
  }
  editor.view.dispatch(
    editor.state.tr.replaceWith(
      entry.contentPosition,
      entry.contentPosition + entry.node.nodeSize,
      paragraphFrom(entry, editor.schema, presentation),
    ),
  );
  return true;
}

/**
 * Writes a fetched preview onto the block when it still presents the same
 * URL. A bare-URL label takes the page title; an authored label is kept.
 */
export function applyLinkPreview(editor: Editor, blockId: string, url: string, preview: LinkPreviewResult): boolean {
  const entry = findStandaloneLink(editor.state, blockId);
  if (!entry || entry.url !== url || entry.presentation === 'link' || !editor.isEditable) {
    return false;
  }
  const title = preview.title?.trim();
  const label = title && entry.label === entry.url ? title : entry.label;
  const attrs = {
    ...entry.node.attrs,
    linkSiteName: preview.siteName?.trim() ?? entry.node.attrs.linkSiteName,
    linkDescription: preview.description?.trim() ?? entry.node.attrs.linkDescription,
    ...(preview.thumbnailFileId === undefined ? {} : { linkThumbnailFileId: preview.thumbnailFileId }),
    label,
    sourceContent: [{ type: 'text', text: label, marks: [{ type: 'link', attrs: { href: entry.url } }] }],
  };
  editor.view.dispatch(editor.state.tr.setNodeMarkup(entry.contentPosition, undefined, attrs));
  return true;
}

/**
 * Moves a link pasted into other text to its own paragraph below, as Notion
 * does when it becomes a card or video. A paragraph holding only that link
 * is used as is. Returns the Block ID of the paragraph holding the link.
 */
export function isolateLinkBlock(editor: Editor, blockId: string, url: string): string | null {
  if (findStandaloneLink(editor.state, blockId)?.url === url) {
    return blockId;
  }
  const group = editor.state.doc.firstChild;
  let containerPosition = 1;
  let container: ProseMirrorNode | null = null;
  group?.forEach((candidate, offset) => {
    if (!container && candidate.attrs.id === blockId) {
      container = candidate;
      containerPosition = 1 + offset;
    }
  });
  const paragraph = (container as ProseMirrorNode | null)?.firstChild;
  if (!container || paragraph?.type.name !== 'paragraph') {
    return null;
  }
  const paragraphStart = containerPosition + 2;
  const linked: { from: number; to: number }[] = [];
  paragraph.forEach((inline, offset) => {
    if (inline.marks.some((mark) => mark.type.name === 'link' && mark.attrs.href === url)) {
      const from = paragraphStart + offset;
      const previous = linked.at(-1);
      if (previous?.to === from) {
        previous.to = from + inline.nodeSize;
      } else {
        linked.push({ from, to: from + inline.nodeSize });
      }
    }
  });
  const range = linked.at(-1);
  if (!range) {
    return null;
  }
  const isolatedId = createBlockId();
  const transaction = editor.state.tr.insert(
    containerPosition + (container as ProseMirrorNode).nodeSize,
    editor.schema.nodes.blockContainer!.create(
      { id: isolatedId },
      editor.schema.nodes.paragraph!.create(null, editor.state.doc.slice(range.from, range.to).content),
    ),
  );
  transaction.delete(range.from, range.to);
  editor.view.dispatch(transaction);
  return isolatedId;
}
