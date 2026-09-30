import * as Y from 'yjs';
import {
  decodeCanonicalBlockRoom,
  observeBlockRoomChanges,
  roomDocumentType,
  type BlockRoomChangeSet,
  type BlockRoomDocumentType,
  type CanonicalBlockRoomSnapshot,
  type ObservedBlockRoomChange,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';

export interface SharedBlockRoomChange extends ObservedBlockRoomChange {
  /** Decode and validate the current canonical snapshot once for this transaction. */
  snapshot: () => CanonicalBlockRoomSnapshot;
}

export interface BlockRoomSnapshotNodeRoute {
  readonly family: 'page_section' | 'rich_text';
  readonly pageSectionId?: string;
}

type BlockRoomChangeListener = (change: SharedBlockRoomChange) => void;

interface Subscription {
  active: boolean;
  listener: BlockRoomChangeListener;
}

interface SharedObserver {
  readonly documentType: BlockRoomDocumentType;
  readonly subscriptions: Set<Subscription>;
  readonly pending: SharedBlockRoomChange[];
  stopSource: () => void;
  dispatching: boolean;
}

const observers = new WeakMap<Y.Doc, SharedObserver>();
const snapshotNodeRoutes = new WeakMap<CanonicalBlockRoomSnapshot, ReadonlyMap<string, BlockRoomSnapshotNodeRoute>>();

function sharedChange(
  document: Y.Doc,
  documentType: BlockRoomDocumentType,
  change: ObservedBlockRoomChange,
): SharedBlockRoomChange {
  let snapshot: CanonicalBlockRoomSnapshot | undefined;
  let snapshotError: unknown;
  let snapshotAttempted = false;

  return {
    ...change,
    snapshot() {
      if (!snapshotAttempted) {
        snapshotAttempted = true;
        try {
          snapshot = decodeCanonicalBlockRoom(document, documentType);
        } catch (error) {
          snapshotError = error;
        }
      }
      if (snapshotError !== undefined) {
        throw snapshotError;
      }
      return snapshot!;
    },
  };
}

function dispatch(document: Y.Doc, observer: SharedObserver): void {
  if (observer.dispatching) {
    return;
  }
  observer.dispatching = true;
  let firstError: unknown;
  let didThrow = false;
  try {
    while (observer.pending.length > 0) {
      const change = observer.pending.shift()!;
      const subscriptions = [...observer.subscriptions];
      for (const subscription of subscriptions) {
        if (!subscription.active || !observer.subscriptions.has(subscription)) {
          continue;
        }
        try {
          subscription.listener(change);
        } catch (error) {
          if (!didThrow) {
            didThrow = true;
            firstError = error;
          }
        }
      }
      if (observer.subscriptions.size === 0) {
        observer.pending.length = 0;
      }
    }
  } finally {
    observer.dispatching = false;
  }
  if (observer.subscriptions.size === 0 && observers.get(document) === observer) {
    observer.stopSource();
    observers.delete(document);
  }
  if (didThrow) {
    throw firstError;
  }
}

function observerFor(document: Y.Doc): SharedObserver {
  const existing = observers.get(document);
  if (existing) {
    return existing;
  }

  const observer: SharedObserver = {
    documentType: roomDocumentType(document),
    subscriptions: new Set(),
    pending: [],
    stopSource: () => undefined,
    dispatching: false,
  };
  observers.set(document, observer);
  observer.stopSource = observeBlockRoomChanges(document, (change) => {
    observer.pending.push(sharedChange(document, observer.documentType, change));
    dispatch(document, observer);
  });
  return observer;
}

/** Share one codec observer, type index, and lazily decoded event data per Y.Doc. */
export function observeSharedBlockRoomChanges(document: Y.Doc, listener: BlockRoomChangeListener): () => void {
  const observer = observerFor(document);
  const subscription: Subscription = { active: true, listener };
  observer.subscriptions.add(subscription);

  return () => {
    if (!subscription.active) {
      return;
    }
    subscription.active = false;
    observer.subscriptions.delete(subscription);
    if (observer.subscriptions.size !== 0 || observer.dispatching) {
      return;
    }
    observer.pending.length = 0;
    observer.stopSource();
    if (observers.get(document) === observer) {
      observers.delete(document);
    }
  };
}

/** Small routing helper for callers that need to locate changed nodes by room ID. */
export function changedBlockIds(changeSet: BlockRoomChangeSet): ReadonlySet<string> {
  return new Set([
    ...changeSet.affectedBaseBlockIds,
    ...changeSet.affectedLocaleBlockIds,
    ...changeSet.affectedLocaleValueTargets.flatMap((target) =>
      target.owner.case === 'blockHandle' ? [target.owner.value] : [],
    ),
  ]);
}

export function blockRoomSnapshotNodeRoute(
  snapshot: CanonicalBlockRoomSnapshot,
  blockId: string,
): BlockRoomSnapshotNodeRoute | undefined {
  let routes = snapshotNodeRoutes.get(snapshot);
  if (!routes) {
    const nodesById = new Map(snapshot.baseNodes.map((node) => [node.id, node] as const));
    const index = new Map<string, BlockRoomSnapshotNodeRoute>();
    for (const node of snapshot.baseNodes) {
      if (node.family === 'page_section') {
        index.set(node.id, { family: node.family, pageSectionId: node.id });
        continue;
      }
      let parentId = node.parentId;
      const visited = new Set([node.id]);
      while (parentId !== null) {
        if (visited.has(parentId)) {
          break;
        }
        visited.add(parentId);
        const parent = nodesById.get(parentId);
        if (!parent) {
          break;
        }
        if (parent.family === 'page_section') {
          index.set(node.id, { family: node.family, pageSectionId: parent.id });
          break;
        }
        parentId = parent.parentId;
      }
      if (!index.has(node.id)) {
        index.set(node.id, { family: node.family });
      }
    }
    routes = index;
    snapshotNodeRoutes.set(snapshot, routes);
  }
  return routes.get(blockId);
}
