import { Extension, type Editor, type JSONContent } from '@tiptap/core';
import type { LocalizedRichTextDocument } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { BlockRoomProseMirrorBridge, ProseMirrorBlockDescriptor } from './block-room-prosemirror-bridge';
import {
  contentBlockProfileForRichTextProfile,
  profileSupportsParagraphExternalVideo,
} from '@/features/editor/contract/block-registry';
import {
  documentToTiptap,
  emptyLocalePayload,
  flatten,
  generatedData,
  generatedLocaleData,
  parseDocument,
  splitPayload,
} from './block-room-tiptap-codec';
import { applyTiptapBlockPayload } from './block-room-tiptap-mutation-writer';
import { richTextProseMirrorAdapterForProtoCase } from './block-room-prosemirror-registry';
import { createTiptapEditorGeneration, type TiptapEditorGeneration } from './editor-generation';
import {
  attachBlockRoomEditor,
  attachBlockRoomLocalUndoOrigin,
  redoBlockRoom,
  undoBlockRoom,
} from '@/lib/collab/interactive-mutation-undo';

/** Post-first Tiptap controller backed only by typed Block-room mutations. */
export class PostBlockRoomTiptapController {
  readonly #bridge: BlockRoomProseMirrorBridge;
  readonly #paragraphExternalVideo: boolean;
  #applyingRoom = false;
  #connected = false;
  #emptyParagraphId: string | null = null;
  #editorGeneration: TiptapEditorGeneration | null = null;
  #previousDescriptors: readonly ProseMirrorBlockDescriptor[];

  readonly extension: Extension;

  constructor(bridge: BlockRoomProseMirrorBridge) {
    this.#bridge = bridge;
    const profile = contentBlockProfileForRichTextProfile(bridge.richTextProfile);
    this.#paragraphExternalVideo = profile ? profileSupportsParagraphExternalVideo(profile) : false;
    this.#previousDescriptors = bridge.readBlocks();
    const applyTransaction = (value: JSONContent) => {
      if (!this.#applyingRoom) {
        this.#applyDocument(value);
      }
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
      onTransaction({ transaction }) {
        if (transaction.docChanged) {
          applyTransaction(transaction.doc.toJSON());
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
    let scheduled = false;
    let pending: readonly ProseMirrorBlockDescriptor[] | null = null;
    const unsubscribe = this.#bridge.observe((blocks) => {
      if (blocks.length === 0 && this.#previousDescriptors.length > 0) {
        this.#emptyParagraphId = null;
      }
      this.#previousDescriptors = blocks;
      pending = blocks;
      if (this.#applyingRoom || scheduled) {
        return;
      }
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        const next = pending;
        pending = null;
        if (!active || !next) {
          return;
        }
        if (this.#editorGeneration !== editorGeneration) {
          return;
        }
        const currentEditor = editorGeneration.current();
        if (!currentEditor) {
          return;
        }
        this.#applyingRoom = true;
        try {
          const document = currentEditor.schema.nodeFromJSON(this.#projectDocument(next));
          if (!currentEditor.state.doc.eq(document)) {
            const from = currentEditor.state.doc.content.findDiffStart(document.content);
            const ends = currentEditor.state.doc.content.findDiffEnd(document.content);
            if (from === null || ends === null) {
              throw new Error('Failed to locate the changed Block-room projection range.');
            }
            currentEditor.view.dispatch(
              currentEditor.state.tr
                .replace(from, ends.a, document.slice(from, ends.b))
                .setMeta('addToHistory', false)
                .setMeta('blockRoomProjection', true),
            );
          }
        } finally {
          this.#applyingRoom = false;
        }
      });
    });
    return () => {
      active = false;
      detachEditor();
      detachUndoOrigin();
      unsubscribe();
      if (this.#editorGeneration === editorGeneration) {
        this.#connected = false;
        this.#editorGeneration = null;
      }
    };
  }

  #applyDocument(value: JSONContent): void {
    const nextRoots = parseDocument(value, this.#projectionOptions());
    const next = flatten(nextRoots);
    const previousDescriptors = this.#previousDescriptors;
    const previous = new Map(flattenDescriptor(previousDescriptors).map((block) => [block.id, block]));
    const nextById = new Map(next.map((block) => [block.id, block]));
    const workingOrders = descriptorOrders(previousDescriptors);
    this.#applyingRoom = true;
    try {
      this.#bridge.transact(() => {
        for (const block of [...previous.values()].reverse()) {
          if (!nextById.has(block.id)) {
            this.#bridge.deleteBlock(block.id);
            removeFromOrders(workingOrders, block.id);
          }
        }
        for (const block of next) {
          const before = previous.get(block.id);
          const payload = splitPayload(block);
          const targetParentId = block.parentBlockId ?? null;
          if (!before) {
            const targetOrder = workingOrders.get(targetParentId) ?? [];
            const locales = Object.fromEntries(
              this.#bridge.locales.map((locale) => [
                locale,
                generatedLocaleData(
                  block.protoCase,
                  locale === this.#bridge.locale ? payload.locale : emptyLocalePayload(block.protoCase, payload.base),
                ),
              ]),
            );
            this.#bridge.insertBlock({
              id: block.id,
              data: generatedData(block.protoCase, payload.base),
              localeData: locales,
              parentBlockId: block.parentBlockId,
              index: block.index,
              anchor:
                targetOrder.length > 0
                  ? this.#bridge.createInsertionAnchor({ parentBlockId: block.parentBlockId, index: block.index })
                  : undefined,
            });
            insertIntoOrder(workingOrders, targetParentId, block.index, block.id);
            continue;
          }
          const current = locateInOrders(workingOrders, block.id);
          if (!current) {
            throw new Error(`Existing Block ${block.id} is missing from the structural order.`);
          }
          if (current.parentId !== targetParentId || current.index !== block.index) {
            this.#bridge.moveBlock(block.id, { parentBlockId: block.parentBlockId, index: block.index });
            removeFromOrders(workingOrders, block.id);
            insertIntoOrder(workingOrders, targetParentId, block.index, block.id);
          }
          if (before.adapter.protoCase !== block.protoCase) {
            const localeData = Object.fromEntries(
              this.#bridge.locales.map((locale) => [
                locale,
                generatedLocaleData(
                  block.protoCase,
                  locale === this.#bridge.locale ? payload.locale : emptyLocalePayload(block.protoCase, payload.base),
                ),
              ]),
            );
            this.#bridge.replaceBlockKind({
              blockId: block.id,
              expectedKind: before.adapter.kind,
              data: generatedData(block.protoCase, payload.base),
              localeData,
            });
            continue;
          }
          applyTiptapBlockPayload(this.#bridge, block, before, payload);
        }
      });
      this.#previousDescriptors = this.#bridge.readBlocks();
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

interface LocatedBlock {
  readonly parentId: string | null;
  readonly index: number;
}

function descriptorOrders(
  blocks: readonly ProseMirrorBlockDescriptor[],
  parentId: string | null = null,
  result = new Map<string | null, string[]>(),
): Map<string | null, string[]> {
  result.set(
    parentId,
    blocks.map((block) => block.id),
  );
  for (const block of blocks) {
    descriptorOrders(block.children, block.id, result);
  }
  return result;
}

function locateInOrders(orders: ReadonlyMap<string | null, readonly string[]>, blockId: string): LocatedBlock | null {
  for (const [parentId, blockIds] of orders) {
    const index = blockIds.indexOf(blockId);
    if (index >= 0) {
      return { parentId, index };
    }
  }
  return null;
}

function removeFromOrders(orders: Map<string | null, string[]>, blockId: string): void {
  const current = locateInOrders(orders, blockId);
  if (!current) {
    return;
  }
  orders.get(current.parentId)?.splice(current.index, 1);
}

function insertIntoOrder(
  orders: Map<string | null, string[]>,
  parentId: string | null,
  index: number,
  blockId: string,
): void {
  const order = orders.get(parentId) ?? [];
  if (index < 0 || index > order.length) {
    throw new Error(`Block ${blockId} index ${index} is outside its target order.`);
  }
  order.splice(index, 0, blockId);
  orders.set(parentId, order);
}

interface FlatDescriptor extends ProseMirrorBlockDescriptor {
  readonly parentId: string | null;
  readonly position: number;
}

function flattenDescriptor(
  blocks: readonly ProseMirrorBlockDescriptor[],
  parentId: string | null = null,
): readonly FlatDescriptor[] {
  return blocks.flatMap((block, position) => [
    { ...block, parentId, position },
    ...flattenDescriptor(block.children, block.id),
  ]);
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
