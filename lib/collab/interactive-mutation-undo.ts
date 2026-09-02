import { UndoManager, type Doc } from 'yjs';

const BEGIN_KIND = 'interactive_mutation.begin';
const END_KIND = 'interactive_mutation.end';
const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

type EditableProbe = () => boolean;
type UndoStackItem = UndoManager['undoStack'][number];
type ProviderOrigin = object;

interface ActiveMutation {
  mutationId: string;
  observedProviderUpdate: boolean;
  stackItem?: UndoStackItem;
}

type InteractiveMutationMarker =
  | { kind: typeof BEGIN_KIND; mutationId: string }
  | { kind: typeof END_KIND; mutationId: string; outcome: 'accepted' | 'aborted' };

function markerFromPayload(payload: string): InteractiveMutationMarker | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const value = parsed as Record<string, unknown>;
  if (typeof value.mutationId !== 'string' || !canonicalUuid.test(value.mutationId)) {
    return null;
  }
  if (value.kind === BEGIN_KIND && Object.keys(value).length === 2) {
    return { kind: BEGIN_KIND, mutationId: value.mutationId };
  }
  if (
    value.kind === END_KIND &&
    Object.keys(value).length === 3 &&
    (value.outcome === 'accepted' || value.outcome === 'aborted')
  ) {
    return { kind: END_KIND, mutationId: value.mutationId, outcome: value.outcome };
  }
  return null;
}

class BlockRoomUndoCoordinator {
  readonly manager: UndoManager;

  readonly #document: Doc;
  readonly #editableProbes = new Map<unknown, EditableProbe>();
  #provider: ProviderOrigin | null = null;
  #active: ActiveMutation | null = null;
  #lastTrackedOrigin: unknown;

  constructor(document: Doc) {
    this.#document = document;
    this.manager = new UndoManager(document, { trackedOrigins: new Set() });
  }

  attachLocalOrigin(origin: unknown, editable: EditableProbe): () => void {
    this.#editableProbes.set(origin, editable);
    this.manager.trackedOrigins.add(origin);
    return () => {
      this.#editableProbes.delete(origin);
      this.manager.trackedOrigins.delete(origin);
      if (this.#lastTrackedOrigin === origin) {
        this.manager.stopCapturing();
        this.#lastTrackedOrigin = undefined;
      }
    };
  }

  registerProvider(provider: ProviderOrigin): InteractiveMutationUndoRegistration {
    if (this.#provider && this.#provider !== provider) {
      throw new Error('Block-room interactive mutation provider is already registered.');
    }
    this.#provider = provider;
    const beforeTransaction = (transaction: { origin: unknown }) => {
      const origin = transaction.origin;
      if (origin !== provider) {
        if (this.manager.trackedOrigins.has(origin) && this.#lastTrackedOrigin !== origin) {
          this.manager.stopCapturing();
          this.#lastTrackedOrigin = origin;
        }
        return;
      }
      const active = this.#active;
      if (!active || active.observedProviderUpdate) {
        return;
      }
      if (!this.#hasEditableSession()) {
        this.manager.trackedOrigins.delete(provider);
        return;
      }
      this.manager.stopCapturing();
      active.observedProviderUpdate = true;
      this.#lastTrackedOrigin = provider;
    };
    const afterTransaction = (transaction: { origin: unknown }) => {
      if (transaction.origin !== provider) {
        return;
      }
      const active = this.#active;
      if (!active?.observedProviderUpdate) {
        return;
      }
      active.stackItem = this.manager.undoStack.at(-1);
      this.manager.trackedOrigins.delete(provider);
      this.manager.stopCapturing();
    };
    this.#document.on('beforeTransaction', beforeTransaction);
    this.#document.on('afterTransaction', afterTransaction);

    let active = true;
    return {
      handleStateless: (payload) => {
        if (active) {
          this.#handleMarker(provider, payload);
        }
      },
      destroy: () => {
        if (!active) {
          return;
        }
        active = false;
        this.#document.off('beforeTransaction', beforeTransaction);
        this.#document.off('afterTransaction', afterTransaction);
        this.#cancelPending(provider);
        if (this.#provider === provider) {
          this.#provider = null;
        }
      },
    };
  }

  undo(): boolean {
    const activeItem = this.#active?.stackItem;
    if (activeItem && this.manager.undoStack.at(-1) === activeItem) {
      return false;
    }
    return this.manager.undo() !== null;
  }

  redo(): boolean {
    return this.manager.redo() !== null;
  }

  #handleMarker(provider: ProviderOrigin, payload: string): void {
    const marker = markerFromPayload(payload);
    if (!marker) {
      return;
    }
    if (marker.kind === BEGIN_KIND) {
      this.#cancelPending(provider);
      if (!this.#hasEditableSession()) {
        return;
      }
      this.manager.stopCapturing();
      this.manager.trackedOrigins.add(provider);
      this.#active = {
        mutationId: marker.mutationId,
        observedProviderUpdate: false,
      };
      return;
    }
    const active = this.#active;
    if (!active || active.mutationId !== marker.mutationId) {
      return;
    }
    this.manager.trackedOrigins.delete(provider);
    this.manager.stopCapturing();
    this.#active = null;
    if (marker.outcome === 'aborted' && active.stackItem) {
      const index = this.manager.undoStack.lastIndexOf(active.stackItem);
      if (index >= 0) {
        this.manager.undoStack.splice(index, 1);
      }
    }
  }

  #cancelPending(provider: ProviderOrigin): void {
    this.manager.trackedOrigins.delete(provider);
    this.manager.stopCapturing();
    const active = this.#active;
    this.#active = null;
    if (!active?.stackItem) {
      return;
    }
    const index = this.manager.undoStack.lastIndexOf(active.stackItem);
    if (index >= 0) {
      this.manager.undoStack.splice(index, 1);
    }
  }

  #hasEditableSession(): boolean {
    for (const editable of this.#editableProbes.values()) {
      if (editable()) {
        return true;
      }
    }
    return false;
  }
}

export interface InteractiveMutationUndoRegistration {
  handleStateless: (payload: string) => void;
  destroy: () => void;
}

const coordinators = new WeakMap<Doc, BlockRoomUndoCoordinator>();
const editorDocuments = new WeakMap<object, Doc>();

function coordinatorFor(document: Doc): BlockRoomUndoCoordinator {
  let coordinator = coordinators.get(document);
  if (!coordinator) {
    coordinator = new BlockRoomUndoCoordinator(document);
    coordinators.set(document, coordinator);
  }
  return coordinator;
}

export function registerInteractiveMutationUndoProvider(
  document: Doc,
  provider: ProviderOrigin,
): InteractiveMutationUndoRegistration {
  return coordinatorFor(document).registerProvider(provider);
}

export function attachBlockRoomLocalUndoOrigin(document: Doc, origin: unknown, editable: EditableProbe): () => void {
  return coordinatorFor(document).attachLocalOrigin(origin, editable);
}

export function attachBlockRoomEditor(document: Doc, editor: object): () => void {
  editorDocuments.set(editor, document);
  return () => {
    if (editorDocuments.get(editor) === document) {
      editorDocuments.delete(editor);
    }
  };
}

export function undoBlockRoom(document: Doc): boolean {
  return coordinatorFor(document).undo();
}

export function redoBlockRoom(document: Doc): boolean {
  return coordinatorFor(document).redo();
}

export function undoBlockRoomEditor(editor: object): boolean {
  const document = editorDocuments.get(editor);
  return document ? undoBlockRoom(document) : false;
}

export function redoBlockRoomEditor(editor: object): boolean {
  const document = editorDocuments.get(editor);
  return document ? redoBlockRoom(document) : false;
}

export function blockRoomUndoDepth(document: Doc): number {
  return coordinatorFor(document).manager.undoStack.length;
}
