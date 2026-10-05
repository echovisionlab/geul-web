import {
  ClientMediaUnavailableError,
  checkAbort,
  type PrepareOptions,
  type PreparedMedia,
  type WorkerReply,
} from './contracts';
import { createWorkerDisposer } from './worker-lifecycle';
import { getMediaKind, isSourceFingerprint, validatePreparedOutput } from './validation';
import { getCodecAssetUrl } from './browser-runtime';

export type { PreparedMedia, PreparedArtifact } from './contracts';
export { ClientMediaRestoreMismatchError } from './contracts';
export { restoreMedia } from './restore';
export { getMediaKind } from './validation';

export async function prepareMedia(file: File, options: PrepareOptions): Promise<PreparedMedia | null> {
  checkAbort(options.signal);
  const kind = getMediaKind(file);
  if (
    !kind ||
    typeof Worker !== 'function' ||
    !globalThis.isSecureContext ||
    typeof crypto.subtle?.digest !== 'function' ||
    typeof crypto.randomUUID !== 'function' ||
    typeof navigator.storage?.getDirectory !== 'function'
  ) {
    return null;
  }
  const namespace = `geul-client-media-${crypto.randomUUID()}`;
  let worker: Worker;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      return null;
    }
    throw new Error('Client media Worker could not be created.', { cause: error });
  }
  const dispose = createWorkerDisposer(worker, namespace);
  let processingStarted = false;
  try {
    return await new Promise<PreparedMedia>((resolve, reject) => {
      let finished = false;
      let lastProgress = 0;
      const settle = (operation: () => void) => {
        if (finished) {
          return;
        }
        finished = true;
        options.signal.removeEventListener('abort', abort);
        operation();
      };
      const abort = () => {
        worker.postMessage({ type: 'cancel' });
        settle(() => reject(new DOMException('Media processing was aborted.', 'AbortError')));
      };
      worker.addEventListener('error', (event) => {
        settle(() => reject(new Error(event.message || 'Client media Worker failed.')));
      });
      worker.addEventListener('messageerror', () => {
        settle(() => reject(new Error('Client media Worker returned unreadable output.')));
      });
      worker.addEventListener('message', (event: MessageEvent<WorkerReply>) => {
        const response = event.data;
        if (finished) {
          return;
        }
        if (response.type === 'progress') {
          if (!Number.isFinite(response.progress) || response.progress < 0 || response.progress > 1) {
            settle(() => reject(new Error('Client media Worker returned invalid progress.')));
            return;
          }
          lastProgress = Math.max(lastProgress, response.progress);
          processingStarted ||= lastProgress > 0;
          try {
            options.onProgress(lastProgress);
          } catch (error) {
            settle(() => reject(error));
          }
        } else if (response.type === 'complete') {
          try {
            if (response.storageId !== namespace || !isSourceFingerprint(response.sourceFingerprint)) {
              throw new Error('Client media Worker returned invalid storage identity.');
            }
            validatePreparedOutput(response.metadata, response.artifacts, kind);
            settle(() =>
              resolve({
                metadata: response.metadata,
                artifacts: response.artifacts,
                storageId: response.storageId,
                sourceFingerprint: response.sourceFingerprint,
                dispose,
              }),
            );
          } catch (error) {
            settle(() => reject(error));
          }
        } else if (response.type === 'error') {
          processingStarted ||= response.error.processingStarted === true;
          const error = response.error.unavailableReason
            ? new ClientMediaUnavailableError(response.error.message, response.error.unavailableReason)
            : Object.assign(new Error(response.error.message), {
                name: response.error.name,
                stack: response.error.stack,
              });
          settle(() => reject(error));
        }
      });
      options.signal.addEventListener('abort', abort, { once: true });
      if (options.signal.aborted) {
        abort();
      } else {
        worker.postMessage({
          type: 'prepare',
          file,
          kind,
          namespace,
          codecAssetBaseUrl: options.codecAssetBaseUrl ?? getCodecAssetUrl(),
        });
      }
    });
  } catch (error) {
    try {
      await dispose();
    } catch (cleanupError) {
      if (error instanceof Error && error.cause === undefined) {
        error.cause = cleanupError;
      }
    }
    if (error instanceof ClientMediaUnavailableError && !processingStarted) {
      return null;
    }
    throw error;
  }
}
