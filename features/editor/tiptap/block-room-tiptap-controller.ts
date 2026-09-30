import { Extension, type Editor, type JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { LocalizedRichTextDocument } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { BlockRoomProseMirrorBridge, ProseMirrorBlockDescriptor } from './block-room-prosemirror-bridge';
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
    const applyTransaction = (before: ProseMirrorNode, after: ProseMirrorNode) => {
      if (this.#applyingRoom) {
        return;
      }
      const changed = changedPayloadContainers(before, after);
      if (changed !== null && this.#applyPayloadChanges(changed)) {
        return;
      }
      this.#applyDocument(after.toJSON());
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
    const unsubscribe = this.#bridge.observe((blocks) => {
      if (blocks.length === 0 && this.#previousDescriptors.length > 0) {
        this.#emptyParagraphId = null;
      }
      this.#previousDescriptors = blocks;
      if (!active || this.#applyingRoom || this.#editorGeneration !== editorGeneration) {
        return;
      }
      const currentEditor = editorGeneration.current();
      if (!currentEditor) {
        return;
      }
      // Project remote edits before another local transaction can read stale
      // ProseMirror content and turn unseen text into a deletion.
      this.#applyingRoom = true;
      try {
        const document = currentEditor.schema.nodeFromJSON(this.#projectDocument(blocks));
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
