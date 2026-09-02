import type { JsonValue } from '@bufbuild/protobuf';
import {
  isRichTextCollaborativeTextPath,
  type RichTextBlockKind,
} from '@echovisionlab/geul-proto/content/block_catalog.ts';
import type { BlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import { array, inlineContentProjectionEqual, jsonEqual, object } from './block-room-tiptap-codec';

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
    if (isAtomic(previous)) {
      bridge.deleteAtomicValue({ blockId, scope, path });
      return;
    }
  }
  if (isAtomic(next)) {
    bridge.setAtomicValue({ blockId, scope, path }, next);
    return;
  }
  if (
    previous &&
    next &&
    !Array.isArray(previous) &&
    !Array.isArray(next) &&
    typeof previous === 'object' &&
    typeof next === 'object'
  ) {
    const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
    for (const key of keys) {
      applyJsonDiff(bridge, blockId, kind, scope, `${path}.${key}`, previous[key], next[key]);
    }
    return;
  }
  throw new Error(`Block-room payload shape changed at ${path}; use a typed kind or collection operation.`);
}

export function textDiff(previous: string, next: string): { from: number; to: number; insert: string } {
  let from = 0;
  while (from < previous.length && from < next.length && previous[from] === next[from]) {
    from += 1;
  }
  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (previousEnd > from && nextEnd > from && previous[previousEnd - 1] === next[nextEnd - 1]) {
    previousEnd -= 1;
    nextEnd -= 1;
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
  if (
    previous.length !== next.length ||
    !previous.every((value, index) => inlineTopologyMatches(value, next[index]!))
  ) {
    replaceInlineWindow(bridge, blockId, path, previous, next);
    return;
  }
  previous.forEach((value, index) => applyInlineValue(bridge, blockId, path, index, value, next[index]!));
}

function inlineCase(value: JsonValue): 'text' | 'link' | 'mathInline' | 'hardBreak' | null {
  const inline = object(value);
  for (const candidate of ['text', 'link', 'mathInline', 'hardBreak'] as const) {
    if (inline[candidate] !== undefined) {
      return candidate;
    }
  }
  return null;
}

function collaborativeText(value: JsonValue | undefined): string | undefined | null {
  return value === undefined || typeof value === 'string' ? value : null;
}

function styledTextTopologyMatches(previous: JsonValue, next: JsonValue): boolean {
  const before = object(previous);
  const after = object(next);
  return (
    jsonEqual(object(before.styles), object(after.styles)) &&
    collaborativeText(before.text) !== null &&
    collaborativeText(after.text) !== null
  );
}

function inlineTopologyMatches(previous: JsonValue, next: JsonValue): boolean {
  const before = object(previous);
  const after = object(next);
  const kind = inlineCase(previous);
  if (!kind || kind !== inlineCase(next)) {
    return false;
  }
  if (kind === 'hardBreak') {
    return jsonEqual(before.hardBreak, after.hardBreak);
  }
  if (kind === 'text') {
    return styledTextTopologyMatches(object(before.text), object(after.text));
  }
  if (kind === 'mathInline') {
    return (
      collaborativeText(object(before.mathInline).source) !== null &&
      collaborativeText(object(after.mathInline).source) !== null
    );
  }
  const beforeLink = object(before.link);
  const afterLink = object(after.link);
  return (
    typeof beforeLink.href === 'string' &&
    typeof afterLink.href === 'string' &&
    Array.isArray(beforeLink.content) &&
    Array.isArray(afterLink.content)
  );
}

function applyStyledTextDiff(
  bridge: BlockRoomProseMirrorBridge,
  blockId: string,
  path: string,
  previous: JsonValue,
  next: JsonValue,
): boolean {
  const before = object(previous);
  const after = object(next);
  if (!styledTextTopologyMatches(previous, next)) {
    return false;
  }
  const beforeText = collaborativeText(before.text);
  const afterText = collaborativeText(after.text);
  if (beforeText === null || afterText === null) {
    return false;
  }
  applyCollaborativeTextDiff(bridge, { blockId, scope: 'locale', path }, beforeText, afterText);
  return true;
}

function applyLinkContent(
  bridge: BlockRoomProseMirrorBridge,
  blockId: string,
  path: string,
  previous: readonly JsonValue[],
  next: readonly JsonValue[],
): void {
  if (
    previous.length !== next.length ||
    !previous.every((value, index) => styledTextTopologyMatches(value, next[index]!))
  ) {
    replaceInlineWindow(bridge, blockId, path, previous, next);
    return;
  }
  previous.forEach((value, index) =>
    applyStyledTextDiff(bridge, blockId, `${path}[${index}].text`, value, next[index]!),
  );
}

function applyInlineValue(
  bridge: BlockRoomProseMirrorBridge,
  blockId: string,
  path: string,
  index: number,
  previous: JsonValue,
  next: JsonValue,
): boolean {
  const before = object(previous);
  const after = object(next);
  const kind = inlineCase(previous);
  if (!inlineTopologyMatches(previous, next) || !kind) {
    return false;
  }
  const itemPath = `${path}[${index}]`;
  if (kind === 'hardBreak') {
    return jsonEqual(before.hardBreak, after.hardBreak);
  }
  if (kind === 'text') {
    return applyStyledTextDiff(bridge, blockId, `${itemPath}.text.text`, object(before.text), object(after.text));
  }
  if (kind === 'mathInline') {
    const beforeSource = collaborativeText(object(before.mathInline).source);
    const afterSource = collaborativeText(object(after.mathInline).source);
    if (beforeSource === null || afterSource === null) {
      return false;
    }
    applyCollaborativeTextDiff(
      bridge,
      { blockId, scope: 'locale', path: `${itemPath}.mathInline.source` },
      beforeSource,
      afterSource,
    );
    return true;
  }
  const beforeLink = object(before.link);
  const afterLink = object(after.link);
  const beforeHref = beforeLink.href;
  const afterHref = afterLink.href;
  if (typeof beforeHref !== 'string' || typeof afterHref !== 'string') {
    return false;
  }
  if (beforeHref !== afterHref) {
    bridge.setAtomicValue({ blockId, scope: 'locale', path: `${itemPath}.link.href` }, afterHref);
  }
  applyLinkContent(bridge, blockId, `${itemPath}.link.content`, array(beforeLink.content), array(afterLink.content));
  return true;
}

function isCanonicalEmptyText(value: JsonValue): boolean {
  const inline = object(value);
  return inline.text === '' || object(inline.text).text === '';
}

function inlineCollectionValueEqual(previous: JsonValue, next: JsonValue): boolean {
  if (jsonEqual(previous, next)) {
    return true;
  }
  const before = object(previous);
  const after = object(next);
  if (typeof before.text === 'string' && typeof after.text === 'string') {
    return before.text === after.text && jsonEqual(object(before.styles), object(after.styles));
  }
  if (before.text && after.text) {
    const beforeText = object(before.text);
    const afterText = object(after.text);
    return beforeText.text === afterText.text && jsonEqual(object(beforeText.styles), object(afterText.styles));
  }
  return false;
}

function replaceInlineWindow(
  bridge: BlockRoomProseMirrorBridge,
  blockId: string,
  path: string,
  previous: readonly JsonValue[],
  next: readonly JsonValue[],
): void {
  if (previous.length === 0) {
    replaceArray(bridge, blockId, 'locale', path, previous, next);
    return;
  }
  let previousStart = 0;
  let nextStart = 0;
  while (
    previousStart < previous.length &&
    nextStart < next.length &&
    inlineCollectionValueEqual(previous[previousStart]!, next[nextStart]!)
  ) {
    previousStart += 1;
    nextStart += 1;
  }
  while (previous.length - previousStart > next.length - nextStart && isCanonicalEmptyText(previous[previousStart]!)) {
    previousStart += 1;
  }

  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (
    previousEnd > previousStart &&
    nextEnd > nextStart &&
    inlineCollectionValueEqual(previous[previousEnd - 1]!, next[nextEnd - 1]!)
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }
  while (previousEnd - previousStart > nextEnd - nextStart && isCanonicalEmptyText(previous[previousEnd - 1]!)) {
    previousEnd -= 1;
  }

  const target = { blockId, scope: 'locale' as const, path };
  for (let index = previousEnd - 1; index >= previousStart; index -= 1) {
    bridge.deleteCollectionItem(target, index);
  }
  next.slice(nextStart, nextEnd).forEach((value, offset) => {
    bridge.insertCollectionItem(target, previousStart + offset, value);
  });
}
