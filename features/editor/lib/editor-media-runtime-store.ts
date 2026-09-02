import { isBlockId } from '@/lib/editor/block-id';

export interface EditorMediaFileRuntime {
  fileName?: string;
  mimeType?: string;
  size?: string;
  duration?: string;
  processingStatus?: string;
  processingProgress?: string;
  url?: string;
  originalUrl?: string;
  hlsUrl?: string;
  waveformUrl?: string;
  spectrogramUrl?: string;
  thumbnailUrl?: string;
}

export interface EditorMediaRuntimeSnapshot {
  file?: Readonly<EditorMediaFileRuntime>;
}

type RuntimeListener = () => void;

export interface EditorMediaRuntimeStore {
  acquireFileBinding: (blockId: string, fileId: string) => () => void;
  bindFile: (blockId: string, fileId: string) => void;
  clearBlock: (blockId: string) => void;
  getSnapshot: (blockId: string, fileId?: string) => EditorMediaRuntimeSnapshot;
  patchFile: (fileId: string, patch: Partial<EditorMediaFileRuntime>) => void;
  subscribe: (blockId: string, listener: RuntimeListener) => () => void;
}

const EMPTY_RUNTIME_SNAPSHOT: EditorMediaRuntimeSnapshot = Object.freeze({});

function patchState<T extends object>(current: Readonly<T> | undefined, patch: Partial<T>): Readonly<T> | undefined {
  const next = { ...current, ...patch };
  for (const key of Object.keys(next) as Array<keyof T>) {
    if (next[key] === undefined || next[key] === '') {
      delete next[key];
    }
  }
  return Object.keys(next).length === 0 ? undefined : Object.freeze(next as T);
}

function requireUuid(value: string, label: string): string {
  const normalized = value.trim();
  if (!isBlockId(normalized)) {
    throw new Error(`${label} must be a UUID.`);
  }
  return normalized;
}

/**
 * Ephemeral media state for one resident editor. Durable Block/Yjs data keeps
 * only authored props and File references; verified File delivery metadata
 * lives here. Upload attempts are independent of Block identity.
 */
export function createEditorMediaRuntimeStore(): EditorMediaRuntimeStore {
  // File delivery metadata belongs to the resident editor session. Block
  // bindings only route updates; transient NodeView churn must not erase it.
  const files = new Map<string, Readonly<EditorMediaFileRuntime>>();
  const fileIdByBlockId = new Map<string, string>();
  const listenersByBlockId = new Map<string, Set<RuntimeListener>>();
  const blockIdsByFileId = new Map<string, Set<string>>();
  const bindingOwnerByBlockId = new Map<string, symbol>();
  const snapshots = new Map<string, EditorMediaRuntimeSnapshot>();

  const emit = (blockId: string) => {
    snapshots.delete(blockId);
    for (const listener of listenersByBlockId.get(blockId) ?? []) {
      listener();
    }
  };

  const unlinkFile = (blockId: string, fileId: string) => {
    const blockIds = blockIdsByFileId.get(fileId);
    blockIds?.delete(blockId);
    if (blockIds?.size === 0) {
      blockIdsByFileId.delete(fileId);
    }
  };

  const bindFile = (blockId: string, rawFileId: string) => {
    const normalizedBlockId = requireUuid(blockId, 'Editor media runtime Block identity');
    const fileId = requireUuid(rawFileId, 'Editor media runtime File identity');
    const previous = fileIdByBlockId.get(normalizedBlockId);
    if (previous === fileId) {
      return;
    }
    if (previous) {
      unlinkFile(normalizedBlockId, previous);
    }
    fileIdByBlockId.set(normalizedBlockId, fileId);
    const blockIds = blockIdsByFileId.get(fileId) ?? new Set<string>();
    blockIds.add(normalizedBlockId);
    blockIdsByFileId.set(fileId, blockIds);
    emit(normalizedBlockId);
  };

  const clearBlock = (blockId: string) => {
    const normalizedBlockId = requireUuid(blockId, 'Editor media runtime Block identity');
    bindingOwnerByBlockId.delete(normalizedBlockId);
    const fileId = fileIdByBlockId.get(normalizedBlockId);
    if (fileId) {
      unlinkFile(normalizedBlockId, fileId);
    }
    fileIdByBlockId.delete(normalizedBlockId);
    snapshots.delete(normalizedBlockId);
    for (const listener of listenersByBlockId.get(normalizedBlockId) ?? []) {
      listener();
    }
    listenersByBlockId.delete(normalizedBlockId);
  };

  return {
    acquireFileBinding(blockId, rawFileId) {
      const normalizedBlockId = requireUuid(blockId, 'Editor media runtime Block identity');
      const fileId = requireUuid(rawFileId, 'Editor media runtime File identity');
      const owner = Symbol(normalizedBlockId);
      bindFile(normalizedBlockId, fileId);
      bindingOwnerByBlockId.set(normalizedBlockId, owner);

      return () => {
        if (bindingOwnerByBlockId.get(normalizedBlockId) !== owner) {
          return;
        }
        bindingOwnerByBlockId.delete(normalizedBlockId);
        if (fileIdByBlockId.get(normalizedBlockId) !== fileId) {
          return;
        }
        unlinkFile(normalizedBlockId, fileId);
        fileIdByBlockId.delete(normalizedBlockId);
        emit(normalizedBlockId);
      };
    },
    bindFile,
    clearBlock,
    getSnapshot(blockId, rawFileId) {
      const normalizedBlockId = requireUuid(blockId, 'Editor media runtime Block identity');
      if (rawFileId?.trim()) {
        requireUuid(rawFileId, 'Editor media runtime File identity');
      }
      const fileId = rawFileId?.trim() || fileIdByBlockId.get(normalizedBlockId);
      const file = fileId ? files.get(fileId) : undefined;
      if (!file) {
        return EMPTY_RUNTIME_SNAPSHOT;
      }
      const cached = snapshots.get(normalizedBlockId);
      if (cached?.file === file) {
        return cached;
      }
      const snapshot = Object.freeze({ file });
      snapshots.set(normalizedBlockId, snapshot);
      return snapshot;
    },
    patchFile(fileId, patch) {
      const normalizedFileId = requireUuid(fileId, 'Editor media runtime File identity');
      const next = patchState(files.get(normalizedFileId), patch);
      if (next) {
        files.set(normalizedFileId, next);
      } else {
        files.delete(normalizedFileId);
      }
      for (const blockId of blockIdsByFileId.get(normalizedFileId) ?? []) {
        emit(blockId);
      }
    },
    subscribe(blockId, listener) {
      const normalizedBlockId = requireUuid(blockId, 'Editor media runtime Block identity');
      const listeners = listenersByBlockId.get(normalizedBlockId) ?? new Set<RuntimeListener>();
      listeners.add(listener);
      listenersByBlockId.set(normalizedBlockId, listeners);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          listenersByBlockId.delete(normalizedBlockId);
        }
      };
    },
  };
}
