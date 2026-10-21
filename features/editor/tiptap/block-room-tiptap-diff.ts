import type { JsonObject, JsonValue } from '@bufbuild/protobuf';
import {
  isRichTextCollaborativeTextPath,
  type RichTextBlockKind,
} from '@echovisionlab/geul-proto/content/block_catalog.ts';
import type { BlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import { inlineContentProjectionEqual, jsonEqual } from './block-room-tiptap-codec';

export function replaceArray(
  bridge: BlockRoomProseMirrorBridge,
  blockId: string,
  scope: 'base' | 'locale',
  path: string,
  previous: readonly JsonValue[],
  next: readonly JsonValue[],
): void {
  if (JSON.stringify(previous) === JSON.stringify(next)) {
    return;
  }
  bridge.replaceCollection({ blockId, scope, path }, next);
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAtomic(value: JsonValue | undefined): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function applyCollaborativeTextDiff(
  bridge: BlockRoomProseMirrorBridge,
  target: { blockId: string; scope: 'base' | 'locale'; path: string },
  previous: JsonValue | undefined,
  next: JsonValue | undefined,
): void {
  const before = typeof previous === 'string' ? previous : '';
  const after = typeof next === 'string' ? next : '';
  if (before === after) {
    return;
  }
  if (previous === undefined) {
    bridge.replaceCollaborativeTextValue(target, after);
    return;
  }
  bridge.replaceCollaborativeText({
    ...target,
    ...textDiff(before, after),
  });
}

export function applyJsonDiff(
  bridge: BlockRoomProseMirrorBridge,
  blockId: string,
  kind: RichTextBlockKind,
  scope: 'base' | 'locale',
  path: string,
  previous: JsonValue | undefined,
  next: JsonValue | undefined,
): void {
  if (jsonEqual(previous, next)) {
    return;
  }
  if (
    isRichTextCollaborativeTextPath(kind, path) &&
    (previous === undefined || typeof previous === 'string') &&
    (next === undefined || typeof next === 'string')
  ) {
    applyCollaborativeTextDiff(bridge, { blockId, scope, path }, previous, next);
    return;
  }
  if (Array.isArray(previous) && Array.isArray(next)) {
    replaceArray(bridge, blockId, scope, path, previous, next);
    return;
  }
  if (previous === undefined && Array.isArray(next)) {
    replaceArray(bridge, blockId, scope, path, [], next);
    return;
  }
  if (next === undefined) {
    if (Array.isArray(previous)) {
      for (let index = previous.length - 1; index >= 0; index -= 1) {
        bridge.deleteCollectionItem({ blockId, scope, path }, index);
      }
      return;
    }
    if (isAtomic(previous) || isObject(previous)) {
      bridge.deletePayloadValue({ blockId, scope, path });
      return;
    }
  }
  if (isAtomic(next) && !isObject(previous)) {
    bridge.setAtomicValue({ blockId, scope, path }, next);
    return;
  }
  if (isObject(next) && (previous === undefined || isObject(previous))) {
    // A field such as a File attachment may appear after the block exists.
    if (previous === undefined) {
      bridge.ensurePayloadObject({ blockId, scope, path });
    }
    const before = previous ?? {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(next)])) {
      applyJsonDiff(bridge, blockId, kind, scope, `${path}.${key}`, before[key], next[key]);
    }
    return;
  }
  throw new Error(`Block-room payload shape changed at ${path}; use a typed kind or collection operation.`);
}

function isSurrogatePairBoundary(value: string, boundary: number): boolean {
  if (boundary <= 0 || boundary >= value.length) {
    return false;
  }
  const before = value.charCodeAt(boundary - 1);
  const after = value.charCodeAt(boundary);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

export function textDiff(previous: string, next: string): { from: number; to: number; insert: string } {
  let from = 0;
  while (from < previous.length && from < next.length && previous[from] === next[from]) {
    from += 1;
  }
  if (isSurrogatePairBoundary(previous, from) || isSurrogatePairBoundary(next, from)) {
    from -= 1;
  }
  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (previousEnd > from && nextEnd > from && previous[previousEnd - 1] === next[nextEnd - 1]) {
    previousEnd -= 1;
    nextEnd -= 1;
  }
  if (isSurrogatePairBoundary(previous, previousEnd) || isSurrogatePairBoundary(next, nextEnd)) {
    previousEnd += 1;
    nextEnd += 1;
  }
  return { from, to: previousEnd, insert: next.slice(from, nextEnd) };
}

export function applyInlineContent(
  bridge: BlockRoomProseMirrorBridge,
  blockId: string,
  path: string,
  previous: readonly JsonValue[],
  next: readonly JsonValue[],
): void {
  if (inlineContentProjectionEqual(previous, next)) {
    return;
  }
  bridge.reconcileInlineContent({ blockId, scope: 'locale', path }, previous, next);
}
