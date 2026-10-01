import { notifyEditorSaveStateChanged } from './editor-save-registry';
import {
  activateEditorSaveRecoveryQueue,
  deactivateEditorSaveRecoveryQueue,
  persistEditorSaveRecoveryEntry,
  removeEditorSaveRecoveryEntry,
} from './editor-save-recovery';

export type PatchWriter<T> = (patch: T) => void | Promise<void>;

type PendingPatch<T> = { patch: T; write: PatchWriter<T> };

let queueCounter = 0;

function createQueueId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // The counter fallback still gives this mounted queue its own storage entry.
  }
  queueCounter += 1;
  return `${Date.now().toString(36)}-${queueCounter.toString(36)}`;
}

/** One document/room's delayed field updates. Failed fields remain available for retry. */
class DebouncedPatchQueue<T extends object> {
  private pending?: PendingPatch<T>;
  private inFlight?: PendingPatch<T>;
  private timer?: ReturnType<typeof setTimeout>;
  private activeSave?: Promise<boolean>;
  private generation = 0;
  private recoveryScope: string | null;
  private readonly recoveryQueueId = createQueueId();

  constructor(
    private readonly delay: number,
    private readonly document: string,
    recoveryScope: string | null,
  ) {
    this.recoveryScope = recoveryScope;
  }

  setRecoveryScope = (recoveryScope: string | null) => {
    if (this.recoveryScope === recoveryScope) {
      return;
    }
    if (this.hasPending()) {
      // A queue belongs to its original room once it has accepted a patch.
      if (this.recoveryScope === null && recoveryScope !== null) {
        this.recoveryScope = recoveryScope;
        this.persistRecovery();
      }
      return;
    }
    this.recoveryScope = recoveryScope;
  };

  activateRecovery = () => {
    activateEditorSaveRecoveryQueue(this.recoveryQueueId);
  };

  deactivateRecovery = () => {
    deactivateEditorSaveRecoveryQueue(this.recoveryQueueId);
  };

  enqueue(patch: T, write: PatchWriter<T>) {
    this.pending = { patch: { ...this.pending?.patch, ...patch }, write };
    this.clearTimer();
    this.persistRecovery();
    notifyEditorSaveStateChanged(this.document);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.savePending();
    }, this.delay);
  }

  hasPending = () => Boolean(this.pending || this.inFlight || this.activeSave);

  /** A portable copy of unsaved fields; reading it does not acknowledge or discard them. */
  getPendingPatch = (): T | null => {
    const patch = { ...this.inFlight?.patch, ...this.pending?.patch };
    if (Object.keys(patch).length === 0) {
      return null;
    }
    try {
      return JSON.parse(JSON.stringify(patch)) as T;
    } catch {
      return null;
    }
  };

  // Explicit flush drains all edits, including ones made while waiting for an acknowledgement.
  flush = async (): Promise<boolean> => {
    while (this.hasPending()) {
      if (!(await this.savePending(true))) {
        return false;
      }
    }
    return true;
  };

  cancel = () => {
    this.persistRecovery();
    this.generation += 1;
    this.clearTimer();
    this.pending = undefined;
    notifyEditorSaveStateChanged(this.document);
  };

  preservePendingForRecovery = () => {
    this.persistRecovery();
  };

  private clearTimer() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async savePending(flush = false): Promise<boolean> {
    if (flush) {
      this.clearTimer();
    }
    while (this.activeSave) {
      if (!(await this.activeSave)) {
        return false;
      }
    }
    // A new keystroke may have extended the debounce while the previous save was running.
    if (!flush && this.timer !== undefined) {
      return true;
    }
    if (!this.pending) {
      return true;
    }

    const batch = this.pending;
    this.pending = undefined;
    const generation = this.generation;
    this.inFlight = batch;
    this.persistRecovery();
    notifyEditorSaveStateChanged(this.document);
    this.activeSave = this.persist(batch, generation);
    const saved = await this.activeSave;
    this.activeSave = undefined;
    if (generation === this.generation) {
      this.inFlight = undefined;
      if (saved) {
        if (this.pending) {
          this.persistRecovery();
        } else {
          removeEditorSaveRecoveryEntry(this.recoveryScope, this.recoveryQueueId);
        }
      } else {
        this.persistRecovery();
      }
    } else {
      this.inFlight = undefined;
    }
    notifyEditorSaveStateChanged(this.document);
    return saved;
  }

  private async persist(batch: PendingPatch<T>, generation: number): Promise<boolean> {
    try {
      await batch.write(batch.patch);
      return true;
    } catch {
      if (generation === this.generation) {
        // A newer value for the same field wins over the failed attempt.
        this.pending = {
          patch: { ...batch.patch, ...this.pending?.patch },
          write: this.pending?.write ?? batch.write,
        };
        this.inFlight = undefined;
        this.persistRecovery();
      }
      return false;
    }
  }

  private persistRecovery() {
    const patch = { ...this.inFlight?.patch, ...this.pending?.patch };
    if (Object.keys(patch).length === 0) {
      return;
    }
    persistEditorSaveRecoveryEntry(this.recoveryScope, this.recoveryQueueId, {
      document: this.document,
      updatedAt: Date.now(),
      patch,
    });
  }
}

export function createDebouncedPatch<T extends object>(
  delay: number,
  document = '',
  recoveryScope: string | null = document,
) {
  return new DebouncedPatchQueue<T>(delay, document, recoveryScope);
}
