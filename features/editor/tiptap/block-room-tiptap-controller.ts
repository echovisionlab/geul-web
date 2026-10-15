import { Extension, type Editor, type JSONContent } from '@tiptap/core';
import { markLocalAuthorOrigin } from '@/lib/collab/local-author-origin';
import * as Y from 'yjs';
import { TextSelection } from '@tiptap/pm/state';
import { relativeBlockPoint, resolveRelativeBlockPoint } from './block-room-text-positions';
import { roomLocaleRole } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { LocalizedRichTextDocument } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  createBlockRoomProseMirrorBridge,
  type BlockRoomProseMirrorBridge,
  type ProseMirrorBlockDescriptor,
} from './block-room-prosemirror-bridge';
import {
  contentBlockProfileForRichTextProfile,
  profileSupportsParagraphExternalVideo,
} from '@/features/editor/contract/block-registry';
import { documentToTiptap, parseDocument, splitPayload } from './block-room-tiptap-codec';
import { applyTiptapBlockPayload } from './block-room-tiptap-mutation-writer';
import { planTiptapStructure, type PreviousTiptapBlock } from './block-room-tiptap-structure-plan';
import { richTextProseMirrorAdapterForProtoCase } from './block-room-prosemirror-registry';
import { createTiptapEditorGeneration, type TiptapEditorGeneration } from './editor-generation';
import {
  stopCapturingBlockRoomUndo,
  attachBlockRoomEditor,
  attachBlockRoomLocalUndoOrigin,
  redoBlockRoom,
  undoBlockRoom,
} from '@/lib/collab/interactive-mutation-undo';

/** Post-first Tiptap controller backed only by typed Block-room mutations. */

/**
 * The mounted ProseMirror view, or null. Tiptap throws on `editor.view` before the view mounts
 * (`immediatelyRender: false`) and after it is torn down, which happens while a locale switch
 * replaces the editor; the controller must observe both states without throwing.
 */
function mountedView(editor: Editor | null | undefined): Editor['view'] | null {
  if (!editor || editor.isDestroyed) {
    return null;
  }
  try {
    const view = editor.view;
    // Before mount Tiptap returns a proxy whose mount-dependent members throw; `dom` proves a view.
    return view.dom && !view.isDestroyed ? view : null;
  } catch {
    return null;
  }
}

function isComposing(editor: Editor | null | undefined): boolean {
  return mountedView(editor)?.composing === true;
}

export class PostBlockRoomTiptapController {
  readonly #bridge: BlockRoomProseMirrorBridge;
  readonly #paragraphExternalVideo: boolean;
  #applyingRoom = false;
  #connected = false;
  #emptyParagraphId: string | null = null;
  #editorGeneration: TiptapEditorGeneration | null = null;
  #previousDescriptors: readonly ProseMirrorBlockDescriptor[];

  #composition: PostBlockRoomTiptapController | null = null;
  #pendingIds = new Set<string>();
  #pendingFull = false;
  readonly projectionStats = { incremental: 0, full: 0, projectedBlocks: 0, buffered: 0 };

  readonly extension: Extension;

  constructor(bridge: BlockRoomProseMirrorBridge) {
    this.#bridge = bridge;
    const profile = contentBlockProfileForRichTextProfile(bridge.richTextProfile);
    this.#paragraphExternalVideo = profile ? profileSupportsParagraphExternalVideo(profile) : false;
    this.#previousDescriptors = bridge.readBlocks();
    if (typeof bridge.transactionOrigin === 'object' && bridge.transactionOrigin !== null) {
      markLocalAuthorOrigin(bridge.transactionOrigin);
    }
    const applyTransaction = (before: ProseMirrorNode, after: ProseMirrorNode) => {
      if (this.#applyingRoom) {
        return;
      }
      const editor = this.#editorGeneration?.current();
      if (isComposing(editor)) {
        this.#startComposition();
      }
      if (this.#composition) {
        const shadow = this.#composition;
        shadow.#applyEditorChange(before, after);
        const update = Y.encodeStateAsUpdate(shadow.#bridge.document, Y.encodeStateVector(this.#bridge.document));
        // Composition edits are the author's own; the origin is registered as local author intent
        // because Yjs reports every applyUpdate transaction as remote.
        Y.applyUpdate(this.#bridge.document, update, this.#bridge.transactionOrigin);
        return;
      }
      this.#applyEditorChange(before, after);
    };
    this.extension = Extension.create({
      name: 'postBlockRoom',
      priority: 1_100,
      addKeyboardShortcuts() {
        return {
          'Mod-z': () => undoBlockRoom(bridge.document),
          'Mod-Shift-z': () => redoBlockRoom(bridge.document),
          'Mod-y': () => redoBlockRoom(bridge.document),
        };
      },
      onTransaction({ editor, transaction, appendedTransactions }) {
        if (transaction.docChanged || appendedTransactions.some((appended) => appended.docChanged)) {
          // Tiptap has already applied plugin-appended transactions to the state.
          applyTransaction(transaction.before, editor.state.doc);
        }
      },
    });
  }

  get initialContent(): JSONContent {
    return this.#projectDocument(this.#previousDescriptors);
  }

  get paragraphExternalVideo(): boolean {
    return this.#paragraphExternalVideo;
  }

  get canChangeStructure(): boolean {
    return roomLocaleRole(this.#bridge.document) === 'source';
  }

  get locale(): string {
    return this.#bridge.locale;
  }

  get connected(): boolean {
    return this.#connected;
  }

  getLocalizedDocumentSnapshot(): LocalizedRichTextDocument {
    return this.#bridge.readLocalizedRichTextDocument();
  }

  getText(): string {
    return this.#editorGeneration?.current()?.getText() ?? '';
  }

  connect(editor: Editor): () => void {
    if (this.#connected) {
      throw new Error('Post Block-room controller is already connected.');
    }
    this.#connected = true;
    const editorGeneration = createTiptapEditorGeneration(editor);
    this.#editorGeneration = editorGeneration;
    const detachEditor = attachBlockRoomEditor(this.#bridge.document, editor);
    const detachUndoOrigin = attachBlockRoomLocalUndoOrigin(
      this.#bridge.document,
      this.#bridge.transactionOrigin,
      () => editorGeneration.current()?.isEditable === true,
    );
    let active = true;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const startComposition = () => this.#startComposition();
    const beforeRoomTransaction = () => {
      if (isComposing(editorGeneration.current())) {
        this.#startComposition();
      }
    };
    this.#bridge.document.on('beforeTransaction', beforeRoomTransaction);
    const endComposition = () => {
      clearTimeout(flushTimer);
      // Run after ProseMirror's compositionend DOM observer microtask.
      flushTimer = setTimeout(() => {
        const current = editorGeneration.current();
        if (!active || !current || isComposing(current)) {
          return;
        }
        const selection = this.#composition
          ? captureRelativeSelection(current, this.#composition.#bridge.document)
          : null;
        if (this.#composition) {
          this.#composition.#bridge.document.destroy();
        }
        this.#composition = null;
        const ids = this.#pendingFull ? null : this.#pendingIds;
        this.#projectRemote(current, this.#previousDescriptors, ids, selection);
        this.#pendingIds = new Set();
        this.#pendingFull = false;
        stopCapturingBlockRoomUndo(this.#bridge.document);
      }, 0);
    };
    // Composition listeners follow the view's lifetime: attach on mount, detach on unmount.
    let compositionDom: HTMLElement | null = null;
    const attachCompositionListeners = () => {
      const dom = mountedView(editor)?.dom ?? null;
      if (!dom || dom === compositionDom) {
        return;
      }
      detachCompositionListeners();
      compositionDom = dom;
      dom.addEventListener('compositionstart', startComposition);
      dom.addEventListener('compositionend', endComposition);
    };
    const detachCompositionListeners = () => {
      compositionDom?.removeEventListener('compositionstart', startComposition);
      compositionDom?.removeEventListener('compositionend', endComposition);
      compositionDom = null;
    };
    const flushPendingAfterMount = () => {
      const current = editorGeneration.current();
      if (!active || !current || !this.#pendingFull || this.#composition || !mountedView(current)) {
        return;
      }
      this.#pendingFull = false;
      this.#pendingIds = new Set();
      this.#projectRemote(current, this.#previousDescriptors, null);
    };
    attachCompositionListeners();
    editor.on('mount', attachCompositionListeners);
    editor.on('mount', flushPendingAfterMount);
    editor.on('unmount', detachCompositionListeners);
    const unsubscribe = this.#bridge.observeChanges((blocks, ids) => {
      if (blocks.length === 0 && this.#previousDescriptors.length > 0) {
        this.#emptyParagraphId = null;
      }
      this.#previousDescriptors = blocks;
      if (!active || this.#applyingRoom || this.#editorGeneration !== editorGeneration) {
        return;
      }
      const current = editorGeneration.current();
      // Tiptap reports an unmounted editor as destroyed; queue until it mounts (a real destroy
      // disconnects this controller, which drops the queue).
      if (!current || !mountedView(current)) {
        // No view yet (or it is being replaced): project the whole room once it mounts.
        this.#pendingFull = true;
        return;
      }
      if (isComposing(current) || this.#composition) {
        // compositionstart snapshots before any remote changes enter the room.
        this.projectionStats.buffered += 1;
        if (ids === null) {
          this.#pendingFull = true;
        } else {
          for (const id of ids) {
            this.#pendingIds.add(id);
          }
        }
        return;
      }
      this.#projectRemote(current, blocks, ids);
    });
    return () => {
      active = false;
      clearTimeout(flushTimer);
      this.#bridge.document.off('beforeTransaction', beforeRoomTransaction);
      editor.off('mount', attachCompositionListeners);
      editor.off('mount', flushPendingAfterMount);
      editor.off('unmount', detachCompositionListeners);
      detachCompositionListeners();
      if (this.#composition) {
        this.#composition.#bridge.document.destroy();
      }
      this.#composition = null;
      this.#pendingIds.clear();
      this.#pendingFull = false;
      detachEditor();
      detachUndoOrigin();
      unsubscribe();
      if (this.#editorGeneration === editorGeneration) {
        this.#connected = false;
        this.#editorGeneration = null;
      }
    };
  }

  #startComposition(): void {
    if (this.#composition) {
      return;
    }
    stopCapturingBlockRoomUndo(this.#bridge.document);
    const document = new Y.Doc();
    Y.applyUpdate(document, Y.encodeStateAsUpdate(this.#bridge.document));
    this.#composition = new PostBlockRoomTiptapController(
      createBlockRoomProseMirrorBridge({
        document,
        documentType: this.#bridge.documentType,
        locale: this.locale,
        pageSectionId: this.#bridge.pageSectionId,
        createId: () => this.#bridge.createBlockIdentity(),
      }),
    );
  }

  #applyEditorChange(before: ProseMirrorNode, after: ProseMirrorNode): void {
    const changed = changedPayloadContainers(before, after);
    if (changed !== null && this.#applyPayloadChanges(changed)) {
      return;
    }
    this.#applyDocument(after.toJSON());
  }

  #projectRemote(
    editor: Editor,
    blocks: readonly ProseMirrorBlockDescriptor[],
    ids: ReadonlySet<string> | null,
    selection: RelativeSelection | null = null,
  ): void {
    this.#applyingRoom = true;
    try {
      let tr = editor.state.tr;
      let localized = ids !== null;
      if (ids !== null) {
        const descriptors = findDescriptors(blocks, ids);
        const ranges: { from: number; node: ProseMirrorNode; next: ProseMirrorNode }[] = [];
        editor.state.doc.descendants((node, position) => {
          if (node.type.name !== 'blockContainer' || !ids.has(node.attrs.id)) {
            return true;
          }
          const descriptor = descriptors.get(node.attrs.id);
          if (!descriptor || !node.firstChild) {
            localized = false;
            return false;
          }
          const projected = editor.schema.nodeFromJSON(
            documentToTiptap([{ ...descriptor, children: [] }], this.#projectionOptions()),
          );
          const next = projected.firstChild!.firstChild!.firstChild!;
          ranges.push({ from: position + 1, node: node.firstChild, next });
          return true;
        });
        if (ranges.length !== ids.size) {
          localized = false;
        }
        if (localized) {
          this.projectionStats.incremental += 1;
          this.projectionStats.projectedBlocks += ranges.length;
          for (const range of ranges.sort((a, b) => b.from - a.from)) {
            if (range.node.eq(range.next)) {
              continue;
            }
            // Diff inside this payload, preserving selection and unchanged DOM.
            const start = range.node.content.findDiffStart(range.next.content);
            const end = range.node.content.findDiffEnd(range.next.content);
            if (range.node.sameMarkup(range.next) && start !== null && end !== null) {
              const overlap = start - Math.min(end.a, end.b);
              const oldEnd = end.a + Math.max(0, overlap);
              const newEnd = end.b + Math.max(0, overlap);
              tr = tr.replace(range.from + 1 + start, range.from + 1 + oldEnd, range.next.slice(start, newEnd));
            } else {
              tr = tr.replaceWith(range.from, range.from + range.node.nodeSize, range.next);
            }
          }
        }
      }
      if (!localized) {
        this.projectionStats.full += 1;
        const next = editor.schema.nodeFromJSON(this.#projectDocument(blocks));
        const start = tr.doc.content.findDiffStart(next.content);
        const end = tr.doc.content.findDiffEnd(next.content);
        if (start !== null && end !== null) {
          const overlap = Math.max(0, start - Math.min(end.a, end.b));
          tr = tr.replace(start, end.a + overlap, next.slice(start, end.b + overlap));
        }
      }
      if (selection) {
        const resolve = (point: RelativeSelection['anchor']): number | null => {
          let found: number | null = null;
          tr.doc.descendants((node, pos) => {
            if (node.type.name !== 'blockContainer' || node.attrs.id !== point.id) {
              return true;
            }
            const offset = resolveRelativeBlockPoint(this.#bridge.document, point.id, node, point.relative);
            if (offset !== null) {
              found = pos + 1 + offset;
            }
            return false;
          });
          return found;
        };
        const anchor = resolve(selection.anchor);
        const head = resolve(selection.head);
        if (anchor !== null && head !== null) {
          tr.setSelection(TextSelection.create(tr.doc, anchor, head));
        }
      }
      const view = mountedView(editor);
      if (tr.docChanged && view) {
        view.dispatch(
          tr
            .setMeta('addToHistory', false)
            .setMeta('blockRoomProjection', true)
            .setMeta('blockRoomChangedIds', localized ? ids : null),
        );
      }
    } finally {
      this.#applyingRoom = false;
    }
  }

  #applyPayloadChanges(containers: readonly ProseMirrorNode[]): boolean {
    if (containers.length === 0) {
      return true;
    }
    const previous = findDescriptors(this.#previousDescriptors, new Set(containers.map((node) => node.attrs.id)));
    const changes = containers.map((container) => {
      const before = previous.get(container.attrs.id);
      if (!before) {
        return null;
      }
      // Serialize only this payload. Nested children have their own identities
      // and are compared independently, without serializing their subtrees.
      const block = parseDocument(
        {
          type: 'doc',
          content: [
            {
              type: 'blockGroup',
              content: [{ type: 'blockContainer', attrs: container.attrs, content: [container.firstChild!.toJSON()] }],
            },
          ],
        },
        this.#projectionOptions(),
      )[0]!;
      if (block.protoCase !== before.adapter.protoCase) {
        return null;
      }
      return { before, block, payload: splitPayload(block) };
    });
    if (changes.some((change) => change === null)) {
      return false;
    }
    this.#applyingRoom = true;
    try {
      this.#bridge.transact(() => {
        for (const change of changes) {
          if (change) {
            applyTiptapBlockPayload(this.#bridge, change.block, change.before, change.payload);
          }
        }
      });
      // Connected observers synchronously refresh descriptors during transact.
      if (!this.#connected) {
        this.#previousDescriptors = this.#bridge.readBlocks();
      }
    } finally {
      this.#applyingRoom = false;
    }
    return true;
  }

  #applyDocument(value: JSONContent): void {
    const nextRoots = parseDocument(value, this.#projectionOptions());
    const plan = planTiptapStructure(this.#previousDescriptors, nextRoots, this.#bridge.locales, this.#bridge.locale);
    this.#applyingRoom = true;
    try {
      this.#bridge.transact(() => {
        for (const operation of plan.operations) {
          switch (operation.type) {
            case 'delete':
              this.#bridge.deleteBlock(operation.blockId);
              break;
            case 'insert':
              this.#bridge.insertBlock({
                id: operation.block.id,
                ...operation.data,
                ...operation.placement,
                anchor: operation.needsAnchor ? this.#bridge.createInsertionAnchor(operation.placement) : undefined,
              });
              break;
            case 'move':
              this.#bridge.moveBlock(operation.blockId, operation.placement);
              break;
            case 'replace-kind':
              this.#bridge.replaceBlockKind({
                blockId: operation.block.id,
                expectedKind: operation.previous.adapter.kind,
                ...operation.data,
              });
              break;
            case 'update-payload':
              applyTiptapBlockPayload(this.#bridge, operation.block, operation.previous, operation.payload);
              break;
            default: {
              const exhaustive: never = operation;
              throw new Error(`Unsupported Tiptap structure operation: ${String(exhaustive)}`);
            }
          }
        }
      });
      if (!this.#connected) {
        this.#previousDescriptors = this.#bridge.readBlocks();
      }
    } finally {
      this.#applyingRoom = false;
    }
  }

  #projectionOptions() {
    return { paragraphExternalVideo: this.#paragraphExternalVideo } as const;
  }

  #projectDocument(blocks: readonly ProseMirrorBlockDescriptor[]): JSONContent {
    if (blocks.length > 0) {
      return documentToTiptap(blocks, this.#projectionOptions());
    }
    this.#emptyParagraphId ??= this.#bridge.createBlockIdentity();
    return documentToTiptap(
      [
        {
          id: this.#emptyParagraphId,
          adapter: richTextProseMirrorAdapterForProtoCase('paragraph'),
          basePayload: { props: {} },
          localePayload: { props: {}, content: [] },
          children: [],
        },
      ],
      this.#projectionOptions(),
    );
  }
}

interface RelativeSelection {
  anchor: { id: string; relative: number[] };
  head: { id: string; relative: number[] };
}

function captureRelativeSelection(editor: Editor, document: Y.Doc): RelativeSelection | null {
  if (!(editor.state.selection instanceof TextSelection)) {
    return null;
  }
  const point = (position: typeof editor.state.selection.$anchor) => {
    for (let depth = position.depth; depth > 0; depth--) {
      const node = position.node(depth);
      if (node.type.name !== 'blockContainer') {
        continue;
      }
      const relative = relativeBlockPoint(document, node.attrs.id, node, position.pos - position.before(depth) - 1);
      return relative ? { id: String(node.attrs.id), relative } : null;
    }
    return null;
  };
  const anchor = point(editor.state.selection.$anchor);
  const head = point(editor.state.selection.$head);
  return anchor && head ? { anchor, head } : null;
}

/** null means topology changed and the full structural diff is required. */
function changedPayloadContainers(before: ProseMirrorNode, after: ProseMirrorNode): readonly ProseMirrorNode[] | null {
  if (before === after) {
    return [];
  }
  if (!before.sameMarkup(after) || before.childCount !== 1 || after.childCount !== 1) {
    return null;
  }
  const changed: ProseMirrorNode[] = [];
  const visit = (left: ProseMirrorNode, right: ProseMirrorNode): boolean => {
    if (left === right) {
      return true;
    }
    if (left.type.name !== 'blockGroup' || !left.sameMarkup(right) || left.childCount !== right.childCount) {
      return false;
    }
    for (let index = 0; index < right.childCount; index += 1) {
      const previous = left.child(index);
      const next = right.child(index);
      if (previous === next) {
        continue;
      }
      if (
        previous.type.name !== 'blockContainer' ||
        !previous.sameMarkup(next) ||
        previous.childCount !== next.childCount ||
        !previous.firstChild ||
        !next.firstChild
      ) {
        return false;
      }
      if (previous.firstChild !== next.firstChild) {
        changed.push(next);
      }
      if (next.childCount > 1 && !visit(previous.child(1), next.child(1))) {
        return false;
      }
    }
    return true;
  };
  return visit(before.firstChild!, after.firstChild!) ? changed : null;
}

function findDescriptors(
  blocks: readonly ProseMirrorBlockDescriptor[],
  ids: ReadonlySet<string>,
): ReadonlyMap<string, PreviousTiptapBlock> {
  const found = new Map<string, PreviousTiptapBlock>();
  const visit = (siblings: readonly ProseMirrorBlockDescriptor[], parentId: string | null): void => {
    for (let position = 0; position < siblings.length; position += 1) {
      if (found.size === ids.size) {
        return;
      }
      const block = siblings[position]!;
      if (ids.has(block.id)) {
        found.set(block.id, { ...block, parentId, position });
      }
      visit(block.children, block.id);
    }
  };
  visit(blocks, null);
  return found;
}

export function createPostBlockRoomTiptapController(bridge: BlockRoomProseMirrorBridge): PostBlockRoomTiptapController {
  return new PostBlockRoomTiptapController(bridge);
}

export type RichTextBlockRoomTiptapController = PostBlockRoomTiptapController;

export function createRichTextBlockRoomTiptapController(
  bridge: BlockRoomProseMirrorBridge,
): RichTextBlockRoomTiptapController {
  return new PostBlockRoomTiptapController(bridge);
}
