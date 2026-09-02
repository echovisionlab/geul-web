import { create, type JsonValue } from '@bufbuild/protobuf';
import { type RichTextBlockKind } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  ContentBlockPlacementSchema,
  RichTextBlockLocaleSchema,
  RichTextBlockNodeSchema,
  RichTextBlockSchema,
  type RichTextBlockData,
  type RichTextBlockLocaleData,
  type LocalizedRichTextDocument,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  createBlockRoomInsertionAnchor,
  decodeCanonicalBlockRoom,
  deleteBlockRoomAtomicValue,
  deleteBlockRoomBaseNode,
  deleteBlockRoomPayloadArrayItem,
  getBlockRoomAtomicValue,
  getBlockRoomCollaborativeText,
  insertBlockRoomPayloadArrayItem,
  insertRichTextBlockLocale,
  insertRichTextBlockNode,
  materializeCanonicalBlockRoom,
  moveBlockRoomPayloadArrayItem,
  replaceBlockRoomCollaborativeText,
  replaceBlockRoomPayloadArray,
  moveRichTextBlockNode,
  observeCanonicalBlockRoom,
  replaceRichTextBlockData,
  roomLocale,
  roomLocaleRole,
  setBlockRoomAtomicValue,
  transactBlockRoom,
  type BlockRoomAtomicValue,
  type BlockRoomDocumentType,
  type BlockRoomPayloadRef,
  type CanonicalBlockRoomSnapshot,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import type * as Y from 'yjs';
import { createBlockId, isBlockId } from '@/lib/editor/block-id';
import {
  richTextProseMirrorAdapterForProtoCase,
  type RichTextBlockProtoCase,
  type RichTextProseMirrorAdapter,
} from './block-room-prosemirror-registry';

const RICH_TEXT_CONTAINER_SLOT = 'content';

type PayloadObject = Readonly<Record<string, JsonValue>>;

export interface ProseMirrorBlockDescriptor {
  readonly id: string;
  readonly adapter: RichTextProseMirrorAdapter;
  readonly basePayload: PayloadObject;
  readonly localePayload: PayloadObject | null;
  readonly children: readonly ProseMirrorBlockDescriptor[];
}

export type BlockRoomPayloadScope = 'base' | 'locale';

export interface BlockRoomPayloadTarget {
  readonly blockId: string;
  readonly scope: BlockRoomPayloadScope;
  readonly path: string;
}

export interface CollaborativeTextEdit extends BlockRoomPayloadTarget {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
}

export interface RichTextBlockPlacementInput {
  readonly parentBlockId?: string;
  readonly index: number;
  readonly anchor?: Y.RelativePosition;
}

export interface InsertRichTextBlockInput extends RichTextBlockPlacementInput {
  readonly id?: string;
  readonly data: RichTextBlockData;
  readonly localeData: Readonly<Record<string, RichTextBlockLocaleData>>;
}

export interface ReplaceRichTextBlockKindInput {
  readonly blockId: string;
  readonly expectedKind: RichTextBlockKind;
  readonly data: RichTextBlockData;
  readonly localeData: Readonly<Record<string, RichTextBlockLocaleData | null>>;
}

export interface BlockRoomProseMirrorBridgeOptions {
  readonly document: Y.Doc;
  readonly documentType: BlockRoomDocumentType;
  readonly locale: string;
  /** Required when the bridge owns one rich-text section inside a Page room. */
  readonly pageSectionId?: string;
  readonly createId?: () => string;
  readonly origin?: unknown;
}

function payloadObject(value: JsonValue, reason: string): PayloadObject {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`Invalid ${reason} payload.`);
  }
  return value;
}

function richTextProtoCase(value: RichTextBlockData | RichTextBlockLocaleData): RichTextBlockProtoCase {
  if (value.value.case === undefined) {
    throw new Error('Rich-text Block payload has no generated kind.');
  }
  return value.value.case;
}

function assertMatchingKinds(
  base: RichTextBlockData,
  locales: Readonly<Record<string, RichTextBlockLocaleData | null>>,
): RichTextBlockProtoCase {
  const baseCase = richTextProtoCase(base);
  for (const [locale, localeData] of Object.entries(locales)) {
    if (localeData !== null && richTextProtoCase(localeData) !== baseCase) {
      throw new Error(`Locale ${locale} Block kind does not match ${baseCase}.`);
    }
  }
  return baseCase;
}

function localeSet(value: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.keys(value).sort();
}

function assertExactLocaleSet(expected: readonly string[], actual: readonly string[]): void {
  if (expected.length !== actual.length || expected.some((locale, index) => locale !== actual[index])) {
    throw new Error('Rich-text Block locale set does not match the resident room.');
  }
}

export class BlockRoomProseMirrorBridge {
  readonly #document: Y.Doc;
  readonly #documentType: BlockRoomDocumentType;
  readonly #locale: string;
  readonly #pageSectionId: string | undefined;
  readonly #createId: () => string;
  readonly #origin: unknown;

  constructor(options: BlockRoomProseMirrorBridgeOptions) {
    if (!options.locale) {
      throw new Error('Block room ProseMirror bridge requires a locale.');
    }
    if (options.documentType === 'page' && !options.pageSectionId) {
      throw new Error('Page Block room ProseMirror bridge requires a rich-text section ID.');
    }
    if (options.documentType !== 'page' && options.pageSectionId) {
      throw new Error('Only a Page Block room accepts a rich-text section ID.');
    }
    this.#document = options.document;
    this.#documentType = options.documentType;
    this.#locale = options.locale;
    this.#pageSectionId = options.pageSectionId;
    this.#createId = options.createId ?? createBlockId;
    this.#origin = options.origin ?? this;
    const snapshot = decodeCanonicalBlockRoom(this.#document, this.#documentType);
    if (snapshot.document.locale !== this.#locale || roomLocale(this.#document) !== this.#locale) {
      throw new Error('Block room ProseMirror bridge locale does not match the resident room.');
    }
  }

  get locale(): string {
    return this.#locale;
  }

  get document(): Y.Doc {
    return this.#document;
  }

  get transactionOrigin(): unknown {
    return this.#origin;
  }

  get documentType(): BlockRoomDocumentType {
    return this.#documentType;
  }

  get richTextProfile(): RichTextProfile {
    const document = materializeCanonicalBlockRoom(this.#document, this.#documentType);
    return document.$typeName === 'api.content.v1.LocalizedRichTextDocument' ? document.profile : RichTextProfile.PAGE;
  }

  get locales(): readonly string[] {
    return [this.#locale];
  }

  createBlockIdentity(): string {
    return this.#createId();
  }

  readBlocks(
    snapshot: CanonicalBlockRoomSnapshot = decodeCanonicalBlockRoom(this.#document, this.#documentType),
  ): readonly ProseMirrorBlockDescriptor[] {
    const localeNodes = new Map(
      snapshot.localeOverlay.filter((node) => node.family === 'rich_text').map((node) => [node.id, node]),
    );
    const baseNodes = snapshot.baseNodes.filter((node) => node.family === 'rich_text');
    const byParent = new Map<string | null, typeof baseNodes>();
    for (const node of baseNodes) {
      const siblings = byParent.get(node.parentId) ?? [];
      siblings.push(node);
      byParent.set(node.parentId, siblings);
    }
    for (const siblings of byParent.values()) {
      siblings.sort((left, right) => left.position - right.position);
    }

    const materialize = (parentId: string | null): readonly ProseMirrorBlockDescriptor[] =>
      (byParent.get(parentId) ?? []).map((baseNode) => {
        const localeNode = localeNodes.get(baseNode.id);
        if (localeNode && localeNode.kind !== baseNode.kind) {
          throw new Error(`Localized Block ${baseNode.id} kind does not match its base Block.`);
        }
        return {
          id: baseNode.id,
          adapter: richTextProseMirrorAdapterForProtoCase(baseNode.kind),
          basePayload: payloadObject(baseNode.payload, `base Block ${baseNode.id}`),
          localePayload: localeNode ? payloadObject(localeNode.payload, `localized Block ${baseNode.id}`) : null,
          children: materialize(baseNode.id),
        };
      });

    return materialize(this.#pageSectionId ?? null);
  }

  readLocalizedRichTextDocument(): LocalizedRichTextDocument {
    const document = materializeCanonicalBlockRoom(this.#document, this.#documentType);
    if (document.$typeName !== 'api.content.v1.LocalizedRichTextDocument' || document.locale !== this.#locale) {
      throw new Error('Localized rich-text snapshots require a rich-text Block room.');
    }
    return document;
  }

  observe(listener: (blocks: readonly ProseMirrorBlockDescriptor[]) => void): () => void {
    return observeCanonicalBlockRoom(this.#document, this.#documentType, ({ snapshot }) =>
      listener(this.readBlocks(snapshot)),
    );
  }

  createInsertionAnchor(placement: Omit<RichTextBlockPlacementInput, 'anchor'>): Y.RelativePosition {
    return createBlockRoomInsertionAnchor(
      this.#document,
      {
        parentId: placement.parentBlockId ?? this.#pageSectionId ?? null,
        containerSlot: RICH_TEXT_CONTAINER_SLOT,
      },
      placement.index,
    );
  }

  insertBlock(input: InsertRichTextBlockInput): string {
    this.#assertStructuralAuthority();
    const expectedLocales = [this.#locale];
    assertExactLocaleSet(expectedLocales, localeSet(input.localeData));
    const protoCase = assertMatchingKinds(input.data, input.localeData);
    const id = input.id ?? this.#createId();
    if (!isBlockId(id)) {
      throw new Error('Rich-text Block insertion requires a UUID identity.');
    }
    const node = create(RichTextBlockNodeSchema, {
      block: create(RichTextBlockSchema, { id, value: input.data.value }),
      placement: create(ContentBlockPlacementSchema, {
        parentBlockId: input.parentBlockId,
        index: input.index,
      }),
    });
    const locales = expectedLocales.map((locale) => {
      const data = input.localeData[locale];
      if (!data) {
        throw new Error(`Missing locale payload for ${locale}.`);
      }
      return [locale, create(RichTextBlockLocaleSchema, { blockId: id, value: data.value })] as const;
    });
    if (node.block?.value.case !== protoCase) {
      throw new Error('Generated Block node kind changed while building insertion.');
    }

    transactBlockRoom(this.#document, this.#origin, () => {
      insertRichTextBlockNode(this.#document, node, {
        pageSectionId: this.#pageSectionId,
        anchor: input.anchor,
        origin: this.#origin,
      });
      for (const [, block] of locales) {
        insertRichTextBlockLocale(this.#document, block, { origin: this.#origin });
      }
    });
    return id;
  }

  transact<T>(callback: () => T): T {
    let result: T | undefined;
    transactBlockRoom(this.#document, this.#origin, () => {
      result = callback();
    });
    return result as T;
  }

  moveBlock(blockId: string, placement: RichTextBlockPlacementInput): void {
    this.#assertStructuralAuthority();
    moveRichTextBlockNode(
      this.#document,
      blockId,
      { parentBlockId: placement.parentBlockId, index: placement.index },
      {
        pageSectionId: this.#pageSectionId,
        anchor: placement.anchor,
        origin: this.#origin,
      },
    );
  }

  deleteBlock(blockId: string): void {
    this.#assertStructuralAuthority();
    deleteBlockRoomBaseNode(this.#document, blockId, { origin: this.#origin });
  }

  replaceCollaborativeText(edit: CollaborativeTextEdit): void {
    this.#assertPayloadMutationAuthority(edit);
    const text = getBlockRoomCollaborativeText(this.#document, this.#payloadRef(edit));
    if (
      !Number.isSafeInteger(edit.from) ||
      !Number.isSafeInteger(edit.to) ||
      edit.from < 0 ||
      edit.to < edit.from ||
      edit.to > text.length
    ) {
      throw new Error('Collaborative text edit range is outside the current Block text.');
    }
    transactBlockRoom(this.#document, this.#origin, () => {
      if (edit.to > edit.from) {
        text.delete(edit.from, edit.to - edit.from);
      }
      if (edit.insert) {
        text.insert(edit.from, edit.insert);
      }
    });
  }

  replaceCollaborativeTextValue(target: BlockRoomPayloadTarget, value: string): void {
    this.#assertPayloadMutationAuthority(target);
    replaceBlockRoomCollaborativeText(this.#document, this.#payloadRef(target), value, { origin: this.#origin });
  }

  getAtomicValue(target: BlockRoomPayloadTarget): BlockRoomAtomicValue {
    return getBlockRoomAtomicValue(this.#document, this.#payloadRef(target));
  }

  setAtomicValue(target: BlockRoomPayloadTarget, value: BlockRoomAtomicValue): void {
    this.#assertPayloadMutationAuthority(target);
    setBlockRoomAtomicValue(this.#document, this.#payloadRef(target), value, { origin: this.#origin });
  }

  deleteAtomicValue(target: BlockRoomPayloadTarget): void {
    this.#assertPayloadMutationAuthority(target);
    deleteBlockRoomAtomicValue(this.#document, this.#payloadRef(target), { origin: this.#origin });
  }

  insertCollectionItem(target: BlockRoomPayloadTarget, index: number, value: JsonValue): void {
    this.#assertPayloadMutationAuthority(target);
    insertBlockRoomPayloadArrayItem(this.#document, this.#payloadRef(target), index, value, {
      origin: this.#origin,
    });
  }

  moveCollectionItem(target: BlockRoomPayloadTarget, fromIndex: number, toIndex: number): void {
    this.#assertPayloadMutationAuthority(target);
    moveBlockRoomPayloadArrayItem(this.#document, this.#payloadRef(target), fromIndex, toIndex, {
      origin: this.#origin,
    });
  }

  deleteCollectionItem(target: BlockRoomPayloadTarget, index: number): void {
    this.#assertPayloadMutationAuthority(target);
    deleteBlockRoomPayloadArrayItem(this.#document, this.#payloadRef(target), index, {
      origin: this.#origin,
    });
  }

  replaceCollection(target: BlockRoomPayloadTarget, values: readonly JsonValue[]): void {
    this.#assertPayloadMutationAuthority(target);
    replaceBlockRoomPayloadArray(this.#document, this.#payloadRef(target), values, {
      origin: this.#origin,
    });
  }

  replaceBlockKind(input: ReplaceRichTextBlockKindInput): void {
    this.#assertStructuralAuthority();
    assertMatchingKinds(input.data, input.localeData);
    assertExactLocaleSet([this.#locale], localeSet(input.localeData));
    replaceRichTextBlockData(this.#document, input.blockId, input.data, {
      expectedKind: input.expectedKind,
      localeData: input.localeData[this.#locale] ?? null,
      origin: this.#origin,
    });
  }

  #payloadRef(target: BlockRoomPayloadTarget): BlockRoomPayloadRef {
    return {
      id: target.blockId,
      family: 'rich_text',
      path: target.path,
      ...(target.scope === 'locale' ? { locale: true as const } : {}),
    };
  }

  #assertPayloadMutationAuthority(target: BlockRoomPayloadTarget): void {
    if (target.scope === 'base') {
      this.#assertStructuralAuthority();
    }
  }

  #assertStructuralAuthority(): void {
    if (roomLocaleRole(this.#document) !== 'source') {
      throw new Error('Target locale rooms cannot mutate shared rich-text structure.');
    }
  }
}

export function createBlockRoomProseMirrorBridge(
  options: BlockRoomProseMirrorBridgeOptions,
): BlockRoomProseMirrorBridge {
  return new BlockRoomProseMirrorBridge(options);
}
