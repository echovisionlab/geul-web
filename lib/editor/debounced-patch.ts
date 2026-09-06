export type PatchWriter<T> = (patch: T) => void | Promise<void>;

type PendingPatch<T> = { patch: T; write: PatchWriter<T> };

/** One document/room's delayed field updates. Failed fields remain available for retry. */
class DebouncedPatchQueue<T extends object> {
  private pending?: PendingPatch<T>;
  private timer?: ReturnType<typeof setTimeout>;
  private activeSave?: Promise<boolean>;
  private generation = 0;

  constructor(private readonly delay: number) {}

  enqueue(patch: T, write: PatchWriter<T>) {
    this.pending = { patch: { ...this.pending?.patch, ...patch }, write };
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.savePending();
    }, this.delay);
  }

  hasPending = () => Boolean(this.pending || this.activeSave);

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
    this.generation += 1;
    this.clearTimer();
    this.pending = undefined;
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
    this.activeSave = this.persist(batch, this.generation);
    const saved = await this.activeSave;
    this.activeSave = undefined;
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
      }
      return false;
    }
  }
}

export function createDebouncedPatch<T extends object>(delay: number) {
  return new DebouncedPatchQueue<T>(delay);
}
