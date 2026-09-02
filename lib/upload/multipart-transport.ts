import { UPLOAD_ABORTED_MESSAGE, UPLOAD_FAILED_MESSAGE } from '@/lib/upload/failure';
import { createUploadError, createUploadPartError, isRetryableUploadPartError } from '@/lib/upload/upload-errors';

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;

interface MultipartControlIdentity {
  fileId: string;
  uploadId: string;
  correlationId: string;
}

interface UploadPartRequest extends MultipartControlIdentity {
  partNumber: number;
  chunk: Blob;
  isAborted: () => boolean;
  onProgress: (loaded: number) => void;
  registerAborter: (aborter: () => void) => () => void;
}

interface VerifyUploadPrefixRequest extends MultipartControlIdentity {
  prefix: Blob;
  registerAborter: (aborter: () => void) => () => void;
}

interface PresignResponse {
  url?: string;
  expiresAt?: string;
}

interface ConfirmResponse {
  etag?: string;
}

function controlUrl(path: string, identity: MultipartControlIdentity, partNumber?: number): string {
  const params = new URLSearchParams({
    fileId: identity.fileId,
    uploadId: identity.uploadId,
    correlationId: identity.correlationId,
  });
  if (partNumber != null) {
    params.set('partNumber', partNumber.toString());
  }
  return `/api/upload/${path}?${params.toString()}`;
}

async function postControl<T>(
  url: string,
  registerAborter: (aborter: () => void) => () => void,
  body?: Blob,
): Promise<T> {
  const controller = new AbortController();
  const unregisterAborter = registerAborter(() => controller.abort());
  try {
    const response = await fetch(url, {
      method: 'POST',
      body,
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw createUploadPartError(response.status, (await response.text()) || response.statusText);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  } catch (error) {
    if (controller.signal.aborted) {
      throw createUploadError(UPLOAD_ABORTED_MESSAGE);
    }
    throw error instanceof Error ? error : createUploadError(error);
  } finally {
    unregisterAborter();
  }
}

function waitForRetry(attempt: number): Promise<void> {
  const delayMs = RETRY_BASE_DELAY_MS * 2 ** Math.max(attempt - 1, 0);
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function putPresignedPart(
  uploadUrl: string,
  chunk: Blob,
  onProgress: (loaded: number) => void,
  registerAborter: (aborter: () => void) => () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.responseType = 'text';

    const unregisterAborter = registerAborter(() => {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        xhr.abort();
      }
    });
    const rejectAfterCleanup = (error: Error) => {
      unregisterAborter();
      reject(error);
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };
    xhr.onerror = () => rejectAfterCleanup(createUploadError(UPLOAD_FAILED_MESSAGE));
    xhr.onabort = () => rejectAfterCleanup(createUploadError(UPLOAD_ABORTED_MESSAGE));
    xhr.onload = () => {
      unregisterAborter();
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(createUploadPartError(xhr.status, xhr.responseText || xhr.statusText, xhr.status === 403));
        return;
      }
      onProgress(chunk.size);
      resolve();
    };
    xhr.send(chunk);
  });
}

function putRelayedPart(request: UploadPartRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', controlUrl('part', request, request.partNumber));
    xhr.withCredentials = true;
    xhr.responseType = 'text';
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    const unregisterAborter = request.registerAborter(() => {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        xhr.abort();
      }
    });
    const rejectAfterCleanup = (error: Error) => {
      unregisterAborter();
      reject(error);
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        request.onProgress(event.loaded);
      }
    };
    xhr.onerror = () => rejectAfterCleanup(createUploadError(UPLOAD_FAILED_MESSAGE));
    xhr.onabort = () => rejectAfterCleanup(createUploadError(UPLOAD_ABORTED_MESSAGE));
    xhr.onload = () => {
      unregisterAborter();
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(createUploadPartError(xhr.status, xhr.responseText || xhr.statusText));
        return;
      }
      try {
        const response = JSON.parse(xhr.responseText || '{}') as ConfirmResponse;
        if (!response.etag) {
          reject(createUploadError('Missing ETag for uploaded part'));
          return;
        }
        request.onProgress(request.chunk.size);
        resolve(response.etag);
      } catch (error) {
        reject(createUploadError(error));
      }
    };
    xhr.send(request.chunk);
  });
}

export async function verifyUploadPrefix(request: VerifyUploadPrefixRequest): Promise<void> {
  await postControl<void>(controlUrl('prefix', request), request.registerAborter, request.prefix);
}

export async function uploadDirectPartWithRetry(request: UploadPartRequest): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    if (request.isAborted()) {
      throw createUploadError(UPLOAD_ABORTED_MESSAGE);
    }
    try {
      const presigned = await postControl<PresignResponse>(
        controlUrl('part/presign', request, request.partNumber),
        request.registerAborter,
      );
      if (!presigned.url) {
        throw createUploadError('Missing presigned URL for uploaded part');
      }
      await putPresignedPart(presigned.url, request.chunk, request.onProgress, request.registerAborter);
      const confirmed = await postControl<ConfirmResponse>(
        controlUrl('part/confirm', request, request.partNumber),
        request.registerAborter,
      );
      if (!confirmed.etag) {
        throw createUploadError('Missing ETag for uploaded part');
      }
      return confirmed.etag;
    } catch (error) {
      const retryable = !request.isAborted() && attempt < MAX_ATTEMPTS && isRetryableUploadPartError(error);
      if (!retryable) {
        throw error;
      }
      await waitForRetry(attempt);
    }
  }
}

export async function uploadRelayedPartWithRetry(request: UploadPartRequest): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    if (request.isAborted()) {
      throw createUploadError(UPLOAD_ABORTED_MESSAGE);
    }
    try {
      return await putRelayedPart(request);
    } catch (error) {
      const retryable = !request.isAborted() && attempt < MAX_ATTEMPTS && isRetryableUploadPartError(error);
      if (!retryable) {
        throw error;
      }
      await waitForRetry(attempt);
    }
  }
}
