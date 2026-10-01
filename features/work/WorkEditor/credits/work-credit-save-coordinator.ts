import { notifyEditorSaveStateChanged, registerEditorSave } from '@/lib/editor/editor-save-registry';

/** Tracks credit mutations that must settle before a Work editor transition. */
export class WorkCreditSaveCoordinator {
  private readonly pendingOperations = new Set<Promise<boolean>>();
  private readonly unregister: () => void;
  private disposed = false;

  constructor(private readonly document: string) {
    this.unregister = registerEditorSave(document, {
      flush: () => this.flush(),
      hasPending: () => this.pendingOperations.size > 0,
    });
  }

  track<T>(start: () => Promise<T>, isSuccessful: (value: T) => boolean): Promise<boolean> {
    let tracked: Promise<boolean>;
    try {
      tracked = Promise.resolve(start()).then(
        (value) => {
          try {
            return isSuccessful(value);
          } catch {
            return false;
          }
        },
        () => false,
      );
    } catch {
      tracked = Promise.resolve(false);
    }

    this.pendingOperations.add(tracked);
    notifyEditorSaveStateChanged(this.document);
    void tracked.then(() => {
      this.pendingOperations.delete(tracked);
      notifyEditorSaveStateChanged(this.document);
      this.unregisterIfDisposedAndIdle();
    });
    return tracked;
  }

  async flush(): Promise<boolean> {
    let successful = true;
    while (this.pendingOperations.size > 0) {
      const batch = [...this.pendingOperations];
      const results = await Promise.all(batch);
      if (results.some((result) => !result)) {
        successful = false;
      }
    }
    return successful;
  }

  dispose() {
    this.disposed = true;
    this.unregisterIfDisposedAndIdle();
  }

  private unregisterIfDisposedAndIdle() {
    if (this.disposed && this.pendingOperations.size === 0) {
      this.unregister();
    }
  }
}
