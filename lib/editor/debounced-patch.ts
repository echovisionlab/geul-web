import { notifyEditorSaveStateChanged } from './editor-save-registry';
import {
  activateEditorSaveRecoveryQueue,
  claimEditorSaveRecoveryEntries,
  deactivateEditorSaveRecoveryQueue,
  persistEditorSaveRecoveryEntry,
  removeEditorSaveRecoveryEntry,
  type EditorSaveRecoveryIdentity,
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
  private retries = 0;
  private activated = true;
  private recoveryScope: string | null;
  private readonly recoveryKey?: string;
  private readonly recoveredQueueIds = new Set<string>();
  private recoveredIntent = false;
  private lastRecoveryTimestamp = 0;
  private readonly recoveryQueueId = createQueueId();

  constructor(
    private readonly delay: number,
    private readonly document: string,
    recoveryScope: string | null,
    private readonly merge: (pending: T, next: T) => T = (pending, next) => ({ ...pending, ...next }),
    private readonly automaticRetry = false,
    recoveryKey?: string,
  ) {
    this.recoveryScope = recoveryScope;
    this.recoveryKey = recoveryKey;
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

  activateRecovery = (write?: PatchWriter<T>) => {
    this.activated = true;
    activateEditorSaveRecoveryQueue(this.recoveryQueueId);
    if (!this.pending && !this.inFlight && write && this.recoveryKey) {
      this.restoreRecovery(write);
    }
  };

  deactivateRecovery = () => {
    this.activated = false;
    deactivateEditorSaveRecoveryQueue(this.recoveryQueueId);
  };

  enqueue(patch: T, write: PatchWriter<T>) {
    this.pending = { patch: this.pending ? this.merge(this.pending.patch, patch) : patch, write };
    this.retries = 0;
    this.clearTimer();
    this.persistRecovery();
    notifyEditorSaveStateChanged(this.document);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.savePending();
    }, this.delay);
  }

  hasPending = () => Boolean(this.pending || this.inFlight || this.activeSave);

  getRecoveryIdentity = (): EditorSaveRecoveryIdentity => ({
    scope: this.recoveryScope,
    ...(this.recoveryKey === undefined ? {} : { key: this.recoveryKey }),
  });

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
        this.retries = 0;
        if (this.pending) {
          this.persistRecovery();
        } else {
          removeEditorSaveRecoveryEntry(this.recoveryScope, this.recoveryQueueId);
          this.recoveredQueueIds.clear();
          this.recoveredIntent = false;
        }
      } else {
        this.persistRecovery();
      }
    } else {
      this.inFlight = undefined;
    }
    if (
      !saved &&
      (this.automaticRetry || this.recoveredIntent) &&
      this.activated &&
      this.pending &&
      this.retries < 8 &&
      this.timer === undefined
    ) {
      const retryDelay = Math.min(30_000, 1_000 * 2 ** this.retries++);
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.savePending();
      }, retryDelay);
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
          patch: this.pending ? this.merge(batch.patch, this.pending.patch) : batch.patch,
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
    const updatedAt = Math.max(Date.now(), this.lastRecoveryTimestamp + 1);
    this.lastRecoveryTimestamp = updatedAt;
    return persistEditorSaveRecoveryEntry(this.recoveryScope, this.recoveryQueueId, {
      document: this.document,
      updatedAt,
      patch,
      ...(this.recoveryKey === undefined ? {} : { recoveryKey: this.recoveryKey }),
      ...(this.recoveredQueueIds.size ? { recoveredQueueIds: [...this.recoveredQueueIds] } : {}),
    });
  }

  private restoreRecovery(write: PatchWriter<T>) {
    const recovered = claimEditorSaveRecoveryEntries(
      this.recoveryScope,
      this.recoveryQueueId,
      this.document,
      this.recoveryKey,
    );
    if (recovered.length === 0) {
      return;
    }

    let patch: T | undefined;
    for (const entry of recovered) {
      this.lastRecoveryTimestamp = Math.max(this.lastRecoveryTimestamp, entry.updatedAt);
      for (const recoveredQueueId of entry.recoveredQueueIds) {
        this.recoveredQueueIds.add(recoveredQueueId);
      }
      if (entry.id !== this.recoveryQueueId) {
        this.recoveredQueueIds.add(entry.id);
      }
      const next = entry.patch as T;
      patch = patch === undefined ? next : this.merge(patch, next);
    }

    if (patch === undefined) {
      return;
    }
    this.pending = {
      patch: this.pending ? this.merge(patch, this.pending.patch) : patch,
      write,
    };
    this.recoveredIntent = true;
    this.persistRecovery();
    notifyEditorSaveStateChanged(this.document);
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.savePending();
    }, this.delay);
  }
}

export function createDebouncedPatch<T extends object>(
  delay: number,
  document = '',
  recoveryScope: string | null = document,
  merge?: (pending: T, next: T) => T,
  automaticRetry = false,
  recoveryKey?: string,
) {
  return new DebouncedPatchQueue<T>(delay, document, recoveryScope, merge, automaticRetry, recoveryKey);
}
