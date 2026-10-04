import { disposeNamespace } from './artifact-storage';
import type { WorkerReply } from './contracts';

/** A completed bundle remains alive until the caller acknowledges or cancels it. */
export function createWorkerDisposer(worker: Worker, namespace: string): () => Promise<void> {
  let disposal: Promise<void> | undefined;
  let terminated = false;
  const stop = () => {
    if (!terminated) {
      terminated = true;
      worker.terminate();
    }
  };
  const dispose = (): Promise<void> => {
    if (!disposal) {
      disposal = (async () => {
        if (!terminated) {
          await new Promise<void>((resolve) => {
            const finished = () => {
              clearTimeout(timer);
              worker.removeEventListener('message', listener);
              resolve();
            };
            const listener = (event: MessageEvent<WorkerReply>) => {
              if (event.data.type === 'disposed') {
                finished();
              }
            };
            const timer = setTimeout(finished, 5_000);
            worker.addEventListener('message', listener);
            try {
              worker.postMessage({ type: 'dispose' });
            } catch {
              finished();
            }
          });
          stop();
        }
        for (let attempt = 0; ; attempt += 1) {
          try {
            await disposeNamespace(namespace);
            break;
          } catch (error) {
            if (
              attempt >= 3 ||
              !(error instanceof DOMException) ||
              !['NoModificationAllowedError', 'InvalidStateError'].includes(error.name)
            ) {
              throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
          }
        }
      })().catch((error) => {
        disposal = undefined;
        throw error;
      });
    }
    return disposal;
  };
  return dispose;
}
