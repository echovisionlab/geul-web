import { createLogger } from '@/lib/utils/logger';
import { parseServerMessage, type ServerMessageOf } from '@echovisionlab/geul-common/collaboration/protocol';
import { UndoManager, type Doc } from 'yjs';

type EditableProbe = () => boolean;
type UndoStackItem = UndoManager['undoStack'][number];
type ProviderOrigin = object;

interface ActiveMutation {
  mutationId: string;
  observedProviderUpdate: boolean;
  stackItem?: UndoStackItem;
}

type InteractiveMutationMarker = ServerMessageOf<'interactive_mutation.begin' | 'interactive_mutation.end'>;

function markerFromPayload(payload: string): InteractiveMutationMarker | null {
  const parsed = parseServerMessage(payload);
  if (!parsed.ok) {
    void createLogger('collaboration').warn('Ignoring collaboration message', { data: { ...parsed } });
    return null;
  }
  return parsed.ok &&
    (parsed.message.kind === 'interactive_mutation.begin' || parsed.message.kind === 'interactive_mutation.end')
    ? parsed.message
    : null;
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
    if (marker.kind === 'interactive_mutation.begin') {
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

/** Separate a composition from adjacent typing without tracking remote origins. */
export function stopCapturingBlockRoomUndo(document: Doc): void {
  coordinatorFor(document).manager.stopCapturing();
}
