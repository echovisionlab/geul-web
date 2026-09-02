'use client';

import type { Editor as TiptapEditor } from '@tiptap/core';
import { fileBlockPropSchema } from '@echovisionlab/geul-common/media/block-schemas';
import { absolutePositionToRelativePosition, relativePositionToAbsolutePosition, ySyncPluginKey } from 'y-prosemirror';
import { decodeRelativePosition, encodeRelativePosition, type Doc, type XmlFragment } from 'yjs';
import { isBlockId } from '@/lib/editor/block-id';
import { createTiptapEditorGeneration } from '@/features/editor/tiptap/editor-generation';
import {
  createEditorMediaRuntimeStore,
  type EditorMediaFileRuntime,
  type EditorMediaRuntimeSnapshot,
  type EditorMediaRuntimeStore,
} from './editor-media-runtime-store';
import type { InsertPosition, BlockInsertResult } from './block-insert';

export type EditorMediaBlockType = 'file';
export type ReplaceableBlockType = 'file';

export interface EditorMediaBlock {
  id?: string;
  type: ReplaceableBlockType;
  props: Record<string, unknown>;
}

/**
 * The only editor runtime dependency used by media commands.
 *
 * `updateBlockProps` deliberately cannot change a node type. `getBlock` is
 * always read immediately before a CAS-sensitive write; callers must not use
 * a previously captured block object as authority. Neutral projection is a
 * separate authority callback and is never inferred from the source editor.
 */
export interface EditorMediaCommandPort {
  getBlock: (blockId: string) => SelectedFileBlock | null;
  updateBlockProps: (blockId: string, props: Record<string, unknown>) => boolean;
  deleteBlock: (blockId: string) => boolean;
  insertBlock: (block: EditorMediaBlock, savedPosition: InsertPosition | null) => BlockInsertResult;
  captureInsertPosition: (referenceBlockId?: string) => InsertPosition | null;
  applyNeutralBlockProps?: (blockId: string, props: Record<string, unknown>) => void;
  deleteNeutralBlock?: (blockId: string) => void;
}

export interface SelectedFileBlock extends EditorMediaBlock {
  id: string;
}

export interface TiptapEditorMediaCommandPortOptions {
  applyNeutralBlockProps?: (blockId: string, props: Record<string, unknown>) => void;
  deleteNeutralBlock?: (blockId: string) => void;
  runtimeStore?: EditorMediaRuntimeStore;
}

interface TiptapBlockEntry {
  id: string;
  position: number;
  node: { nodeSize: number; firstChild: { type: { name: string }; attrs: Record<string, unknown> } | null };
}

type ProseMirrorMapping = Parameters<typeof absolutePositionToRelativePosition>[2];

interface YPositionSyncState {
  binding: { mapping: ProseMirrorMapping };
  doc: Doc;
  type: XmlFragment;
}

function getYPositionSyncState(editor: TiptapEditor): YPositionSyncState | null {
  const state: unknown = ySyncPluginKey.getState(editor.state);
  if (!state || typeof state !== 'object') {
    return null;
  }
  const candidate = state as Partial<YPositionSyncState>;
  if (!candidate.doc || !candidate.type || !candidate.binding?.mapping) {
    return null;
  }
  return candidate as YPositionSyncState;
}

function captureYRelativeInsertPosition(
  editor: TiptapEditor,
  referenceBlockId: string,
  absolutePosition: number,
): InsertPosition | null {
  const syncState = getYPositionSyncState(editor);
  if (!syncState) {
    return null;
  }
  const relativePosition = absolutePositionToRelativePosition(
    absolutePosition,
    syncState.type,
    syncState.binding.mapping,
  );
  return {
    referenceBlockId,
    encodedRelativePosition: encodeRelativePosition(relativePosition),
  };
}

function resolveYRelativeInsertPosition(editor: TiptapEditor, encodedRelativePosition: Uint8Array): number | null {
  const syncState = getYPositionSyncState(editor);
  if (!syncState) {
    return null;
  }
  return relativePositionToAbsolutePosition(
    syncState.doc,
    syncState.type,
    decodeRelativePosition(encodedRelativePosition),
    syncState.binding.mapping,
  );
}

function findTiptapBlock(editor: TiptapEditor, blockId: string): TiptapBlockEntry | null {
  let found: TiptapBlockEntry | null = null;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== 'blockContainer' || String(node.attrs.id ?? '') !== blockId) {
      return !found;
    }
    found = { id: blockId, position, node };
    return false;
  });
  return found;
}

function findCurrentTiptapBlock(editor: TiptapEditor): TiptapBlockEntry | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'blockContainer') {
      const position = $from.before(depth);
      const node = editor.state.doc.nodeAt(position);
      const id = String(node?.attrs.id ?? '');
      return id && node ? { id, position, node } : null;
    }
  }
  return null;
}

function findLastTiptapBlock(editor: TiptapEditor): TiptapBlockEntry | null {
  let last: TiptapBlockEntry | null = null;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'blockContainer') {
      const id = String(node.attrs.id ?? '');
      if (id) {
        last = { id, position, node };
      }
    }
  });
  return last;
}

const durableFilePropKeys = new Set(Object.keys(fileBlockPropSchema));
const fileRuntimePropKeys = new Set<keyof EditorMediaFileRuntime>([
  'fileName',
  'mimeType',
  'size',
  'duration',
  'processingStatus',
  'processingProgress',
  'url',
  'originalUrl',
  'hlsUrl',
  'waveformUrl',
  'spectrogramUrl',
  'thumbnailUrl',
]);

function runtimeSnapshotProps(snapshot: EditorMediaRuntimeSnapshot): Record<string, unknown> {
  return {
    ...snapshot.file,
  };
}

function partitionFileProps(props: Record<string, unknown>): {
  durable: Record<string, unknown>;
  fileRuntime: Partial<EditorMediaFileRuntime>;
} {
  const durable: Record<string, unknown> = {};
  const fileRuntime: Partial<EditorMediaFileRuntime> = {};
  for (const [name, value] of Object.entries(props)) {
    if (durableFilePropKeys.has(name)) {
      if (name === 'fileId' && !isBlockId(value)) {
        throw new Error('File Block active File identity must be a UUID.');
      }
      durable[name] = value;
      continue;
    }
    if (fileRuntimePropKeys.has(name as keyof EditorMediaFileRuntime)) {
      Object.assign(fileRuntime, { [name]: value });
      continue;
    }
    throw new Error(`Unsupported File Block property: ${name}`);
  }
  return { durable, fileRuntime };
}

export function selectDurableEditorFileProps(props: Record<string, unknown>): Record<string, unknown> {
  return partitionFileProps(props).durable;
}

export function canResolveTiptapInsertPosition(editor: TiptapEditor, position: InsertPosition): boolean {
  if (position.encodedRelativePosition) {
    return resolveYRelativeInsertPosition(editor, position.encodedRelativePosition) !== null;
  }
  return findTiptapBlock(editor, position.referenceBlockId) !== null;
}

function asMediaBlock(entry: TiptapBlockEntry, runtimeStore: EditorMediaRuntimeStore): SelectedFileBlock | null {
  const content = entry.node.firstChild;
  if (!content || !isEditorMediaBlockType(content.type.name)) {
    return null;
  }
  const fileId = typeof content.attrs.fileId === 'string' ? content.attrs.fileId : '';
  if (!isBlockId(fileId)) {
    return null;
  }
  runtimeStore.bindFile(entry.id, fileId);
  return {
    id: entry.id,
    type: content.type.name,
    props: { ...content.attrs, ...runtimeSnapshotProps(runtimeStore.getSnapshot(entry.id, fileId)) },
  };
}

function isEditorMediaBlockType(value: string): value is EditorMediaBlockType {
  return value === 'file';
}

/** Tiptap adapter for the media port. It preserves the containing block ID. */
export function createTiptapEditorMediaCommandPort(
  editor: TiptapEditor,
  options: TiptapEditorMediaCommandPortOptions = {},
): EditorMediaCommandPort {
  const runtimeStore = options.runtimeStore ?? createEditorMediaRuntimeStore();
  const editorGeneration = createTiptapEditorGeneration(editor);
  const getBlock = (blockId: string) => {
    const currentEditor = editorGeneration.current();
    if (!currentEditor) {
      return null;
    }
    const entry = findTiptapBlock(currentEditor, blockId);
    return entry ? asMediaBlock(entry, runtimeStore) : null;
  };
  return {
    getBlock,
    updateBlockProps(blockId, props) {
      const currentEditor = editorGeneration.current();
      if (!currentEditor) {
        return false;
      }
      const entry = findTiptapBlock(currentEditor, blockId);
      const current = entry ? asMediaBlock(entry, runtimeStore) : null;
      if (!entry || !current) {
        return false;
      }
      const { durable, fileRuntime } = partitionFileProps(props);
      const currentDurableProps = entry.node.firstChild?.attrs ?? {};
      const nextFileId = String(durable.fileId ?? currentDurableProps.fileId ?? '');
      runtimeStore.bindFile(blockId, nextFileId);
      if (Object.keys(fileRuntime).length > 0 && nextFileId) {
        runtimeStore.patchFile(nextFileId, fileRuntime);
      }
      if (Object.keys(durable).length > 0) {
        currentEditor.view.dispatch(
          currentEditor.state.tr.setNodeMarkup(entry.position + 1, undefined, {
            ...currentDurableProps,
            ...durable,
          }),
        );
      }
      return true;
    },
    deleteBlock(blockId) {
      const currentEditor = editorGeneration.current();
      if (!currentEditor) {
        return false;
      }
      const entry = findTiptapBlock(currentEditor, blockId);
      if (!entry) {
        return false;
      }
      currentEditor.view.dispatch(currentEditor.state.tr.delete(entry.position, entry.position + entry.node.nodeSize));
      runtimeStore.clearBlock(blockId);
      options.deleteNeutralBlock?.(blockId);
      return true;
    },
    insertBlock(block, savedPosition) {
      const currentEditor = editorGeneration.current();
      if (!currentEditor) {
        return { ok: false, reason: 'unavailable' };
      }
      const blockContainer = currentEditor.schema.nodes.blockContainer;
      const contentType = currentEditor.schema.nodes[block.type];
      const { durable, fileRuntime } = partitionFileProps(block.props);
      const content = contentType?.createAndFill(durable);
      if (!blockContainer || !contentType) {
        return { ok: false, reason: 'unsupported_block' };
      }
      if (!isBlockId(block.id) || !isBlockId(durable.fileId) || !content) {
        return { ok: false, reason: 'invalid_block' };
      }
      const container = blockContainer.create({ id: block.id }, content);
      let insertPosition: number | null = null;
      if (savedPosition?.encodedRelativePosition) {
        insertPosition = resolveYRelativeInsertPosition(currentEditor, savedPosition.encodedRelativePosition);
      } else if (savedPosition) {
        const reference = findTiptapBlock(currentEditor, savedPosition.referenceBlockId);
        insertPosition = reference ? reference.position + reference.node.nodeSize : null;
      } else {
        const reference = findCurrentTiptapBlock(currentEditor) ?? findLastTiptapBlock(currentEditor);
        insertPosition = reference ? reference.position + reference.node.nodeSize : null;
      }
      if (insertPosition == null) {
        return { ok: false, reason: 'missing_reference' };
      }
      try {
        currentEditor.view.dispatch(currentEditor.state.tr.insert(insertPosition, container));
      } catch {
        return { ok: false, reason: 'invalid_block' };
      }
      const fileId = String(durable.fileId || '');
      runtimeStore.bindFile(block.id, fileId);
      if (fileId && Object.keys(fileRuntime).length > 0) {
        runtimeStore.patchFile(fileId, fileRuntime);
      }
      return { ok: true, blockId: block.id };
    },
    captureInsertPosition(referenceBlockId) {
      const currentEditor = editorGeneration.current();
      if (!currentEditor) {
        return null;
      }
      const reference = referenceBlockId
        ? findTiptapBlock(currentEditor, referenceBlockId)
        : (findCurrentTiptapBlock(currentEditor) ?? findLastTiptapBlock(currentEditor));
      return reference
        ? (captureYRelativeInsertPosition(
            currentEditor,
            reference.id,
            reference.position + reference.node.nodeSize,
          ) ?? {
            referenceBlockId: reference.id,
          })
        : null;
    },
    applyNeutralBlockProps: options.applyNeutralBlockProps
      ? (blockId, props) => {
          if (editorGeneration.current()) {
            options.applyNeutralBlockProps?.(blockId, partitionFileProps(props).durable);
          }
        }
      : undefined,
    deleteNeutralBlock: options.deleteNeutralBlock
      ? (blockId) => {
          if (editorGeneration.current()) {
            options.deleteNeutralBlock?.(blockId);
          }
        }
      : undefined,
  };
}

export function resolveCurrentBlockById(editor: EditorMediaCommandPort, blockId: string): SelectedFileBlock | null {
  return blockId ? editor.getBlock(blockId) : null;
}

export function applyCurrentAndNeutralBlockProps(
  editor: EditorMediaCommandPort,
  block: SelectedFileBlock,
  currentProps: Record<string, unknown>,
  neutralProps: Record<string, unknown> = currentProps,
) {
  const currentBlock = editor.getBlock(block.id);
  if (!currentBlock) {
    return false;
  }
  const updated = editor.updateBlockProps(currentBlock.id, currentProps);
  if (updated) {
    editor.applyNeutralBlockProps?.(currentBlock.id, neutralProps);
  }
  return updated;
}

export function deleteCurrentAndNeutralBlock(editor: EditorMediaCommandPort, block: SelectedFileBlock) {
  return editor.deleteBlock(block.id);
}

export function pickNeutralPropsFromBlock(block: SelectedFileBlock): Record<string, unknown> {
  return pick(block.props, ['fileId', 'name', 'width', 'height', 'previewWidth', 'textAlignment']);
}

function pick(props: Record<string, unknown>, names: string[]) {
  return Object.fromEntries(
    names.flatMap((name) => (props[name] === undefined ? [] : ([[name, props[name]]] as const))),
  );
}
