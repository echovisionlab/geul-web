import { UPLOAD_ABORTED_MESSAGE, UPLOAD_FAILED_MESSAGE, UPLOAD_INTERRUPTED_MESSAGE } from './failure';
import { createUploadError, createUploadPartError } from './upload-errors';
import { retryUpload } from './upload-retry';
import { watchUploadInactivity } from './upload-inactivity';

export interface ArtifactUploadInput {
  fileId: string;
  uploadId: string;
  bundleId: string;
  path: string;
  file: Blob;
  onProgress?: (progress: { loaded: number; total: number }) => void;
  signal: AbortSignal;
}

function putClientMediaArtifact(input: ArtifactUploadInput): Promise<void> {
  const { file, signal, onProgress } = input;
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createUploadError(UPLOAD_ABORTED_MESSAGE));
      return;
    }
    const xhr = new XMLHttpRequest();
    const progress = (loaded: number) => onProgress?.({ loaded: Math.min(loaded, file.size), total: file.size });
    let settled = false;
    const inactivity = watchUploadInactivity(() => {
      finish(createUploadError(UPLOAD_INTERRUPTED_MESSAGE));
      xhr.abort();
    });
    const cleanup = () => {
      inactivity.stop();
      signal.removeEventListener('abort', abort);
      xhr.upload.onprogress = null;
      xhr.onprogress = null;
      xhr.onload = null;
      xhr.onerror = null;
      xhr.onabort = null;
      xhr.ontimeout = null;
    };
    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    const abort = () => {
      finish(createUploadError(UPLOAD_ABORTED_MESSAGE));
      xhr.abort();
    };
    const params = new URLSearchParams({
      fileId: input.fileId,
      uploadId: input.uploadId,
      bundleId: input.bundleId,
      path: input.path,
    });
    try {
      xhr.open('PUT', `/api/upload/media-artifact?${params}`);
      xhr.withCredentials = true;
      xhr.responseType = 'text';
      // The browser sets Content-Length from the Blob; it is a forbidden XHR header.
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.onprogress = inactivity.reset;
      xhr.upload.onprogress = (event) => {
        inactivity.reset();
        if (event.lengthComputable) {
          progress(event.loaded);
        }
      };
      const fail = () => finish(createUploadError(UPLOAD_FAILED_MESSAGE));
      xhr.onerror = fail;
      xhr.ontimeout = fail;
      xhr.onabort = () => finish(createUploadError(UPLOAD_ABORTED_MESSAGE));
      xhr.onload = () => {
        if (xhr.status !== 200 && xhr.status !== 204) {
          finish(
            createUploadPartError(
              xhr.status,
              xhr.responseText || xhr.statusText,
              false,
              xhr.getResponseHeader('Retry-After'),
            ),
          );
          return;
        }
        progress(file.size);
        finish();
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) {
        abort();
      } else {
        xhr.send(file);
      }
    } catch (error) {
      finish(createUploadError(error));
    }
  });
}

/** Resolves only after the API has verified and acknowledged the artifact body. */
export function uploadClientMediaArtifact(input: ArtifactUploadInput): Promise<void> {
  return retryUpload(() => putClientMediaArtifact(input), {
    isAborted: () => input.signal.aborted,
    registerAborter: (aborter) => {
      input.signal.addEventListener('abort', aborter, { once: true });
      return () => input.signal.removeEventListener('abort', aborter);
    },
  });
}
