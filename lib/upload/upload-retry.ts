import { UPLOAD_ABORTED_MESSAGE } from './failure';
import { createUploadError, isRetryableUploadPartError } from './upload-errors';

interface UploadRetryOptions {
  registerAborter: (aborter: () => void) => () => void;
  isAborted?: () => boolean;
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let delayElapsed = false;
    const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
    const eventTarget = typeof window !== 'undefined' ? window : undefined;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      eventTarget?.removeEventListener('online', resume);
    };
    const abort = () => {
      cleanup();
      reject(createUploadError(UPLOAD_ABORTED_MESSAGE));
    };
    const resume = () => {
      if (delayElapsed && (!offline() || !eventTarget)) {
        cleanup();
        resolve();
      }
    };
    const timer = setTimeout(() => {
      delayElapsed = true;
      resume();
    }, delayMs);
    signal.addEventListener('abort', abort, { once: true });
    eventTarget?.addEventListener('online', resume);
    if (signal.aborted) {
      abort();
    }
  });
}

/** Retries transient upload failures; cancellation covers backoff and offline waits. */
export async function retryUpload<T>(operation: () => Promise<T>, options: UploadRetryOptions): Promise<T> {
  const controller = new AbortController();
  const unregisterAborter = options.registerAborter(() => controller.abort());
  const checkCancelled = () => {
    if (controller.signal.aborted || options.isAborted?.()) {
      throw createUploadError(UPLOAD_ABORTED_MESSAGE);
    }
  };
  try {
    for (let attempt = 1; ; attempt += 1) {
      checkCancelled();
      try {
        const result = await operation();
        checkCancelled();
        return result;
      } catch (error) {
        checkCancelled();
        if (attempt >= 5 || !isRetryableUploadPartError(error)) {
          throw error;
        }
        const retryAfterMs = (error as Error & { retryAfterMs?: number }).retryAfterMs;
        await waitForRetry(retryAfterMs ?? 1000 * 2 ** (attempt - 1), controller.signal);
      }
    }
  } finally {
    unregisterAborter();
  }
}
