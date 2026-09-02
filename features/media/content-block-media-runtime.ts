import { fromJson, toJson, type JsonValue } from '@bufbuild/protobuf';
import {
  ContentBlockMediaItemSchema,
  type ContentBlockMediaItem,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { MediaDelivery } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { isBlockId } from '@/lib/editor/block-id';

const DEFAULT_REFERENCE_PATH = 'file';

function selectorKey(blockId: string, referencePath: string): string {
  return `${blockId}\0${referencePath}`;
}

function requireUuid(value: string, label: string): void {
  if (!isBlockId(value)) {
    throw new Error(`Content Block media ${label} must be a UUID.`);
  }
}

function validateItem(item: ContentBlockMediaItem): { blockId: string; referencePath: string; fileId?: string } {
  const selector = item.selector;
  if (!selector) {
    throw new Error('Content Block media selector is required.');
  }
  requireUuid(selector.blockId, 'Block identity');
  if (!selector.referencePath.trim()) {
    throw new Error('Content Block media reference path is required.');
  }

  const attachment = item.attachment?.state;
  if (!attachment || attachment.case === undefined) {
    throw new Error('Content Block media attachment state is required.');
  }
  if (attachment.case === 'activeFileId') {
    requireUuid(attachment.value, 'active File identity');
    if (item.delivery && item.delivery.fileId !== attachment.value) {
      throw new Error('Content Block media delivery does not match its active File identity.');
    }
    return { blockId: selector.blockId, referencePath: selector.referencePath, fileId: attachment.value };
  }

  requireUuid(attachment.value.formerFileId, 'missing File identity');
  if (item.delivery) {
    throw new Error('Content Block missing attachment must not include a delivery.');
  }
  return { blockId: selector.blockId, referencePath: selector.referencePath };
}

export class ContentBlockMediaRuntimeIndex {
  readonly filesById: ReadonlyMap<string, MediaDelivery>;
  readonly items: readonly ContentBlockMediaItem[];
  readonly #itemsBySelector: ReadonlyMap<string, ContentBlockMediaItem>;

  constructor(items: readonly ContentBlockMediaItem[]) {
    const itemsBySelector = new Map<string, ContentBlockMediaItem>();
    const filesById = new Map<string, MediaDelivery>();
    for (const item of items) {
      const { blockId, referencePath, fileId } = validateItem(item);
      const key = selectorKey(blockId, referencePath);
      if (itemsBySelector.has(key)) {
        throw new Error('Content Block media selector must be unique.');
      }
      itemsBySelector.set(key, item);
      if (fileId && item.delivery) {
        filesById.set(fileId, item.delivery);
      }
    }
    this.items = [...items];
    this.#itemsBySelector = itemsBySelector;
    this.filesById = filesById;
  }

  get(blockId: string, referencePath = DEFAULT_REFERENCE_PATH): ContentBlockMediaItem | undefined {
    requireUuid(blockId, 'Block identity');
    return this.#itemsBySelector.get(selectorKey(blockId, referencePath));
  }
}

export function serializeContentBlockMediaItems(items: readonly ContentBlockMediaItem[]): JsonValue[] {
  const index = new ContentBlockMediaRuntimeIndex(items);
  return index.items.map((item) => toJson(ContentBlockMediaItemSchema, item));
}

export function parseContentBlockMediaItems(values: readonly JsonValue[]): ContentBlockMediaRuntimeIndex {
  return new ContentBlockMediaRuntimeIndex(
    values.map((value) => fromJson(ContentBlockMediaItemSchema, value, { ignoreUnknownFields: false })),
  );
}
