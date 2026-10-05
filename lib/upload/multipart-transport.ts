import { UPLOAD_ABORTED_MESSAGE, UPLOAD_FAILED_MESSAGE, UPLOAD_INTERRUPTED_MESSAGE } from '@/lib/upload/failure';
import { createUploadError, createUploadPartError } from '@/lib/upload/upload-errors';
import { retryUpload } from './upload-retry';
import { watchUploadInactivity } from './upload-inactivity';

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
      throw createUploadPartError(
        response.status,
        (await response.text()) || response.statusText,
        false,
        response.headers.get('Retry-After'),
      );
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

    let settled = false;
    let unregisterAborter = () => {};
    const inactivity = watchUploadInactivity(() => {
      finish(createUploadError(UPLOAD_INTERRUPTED_MESSAGE));
      xhr.abort();
    });
    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      inactivity.stop();
      unregisterAborter();
      xhr.upload.onprogress = null;
      xhr.onprogress = null;
      xhr.onerror = null;
      xhr.ontimeout = null;
      xhr.onabort = null;
      xhr.onload = null;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    xhr.onprogress = inactivity.reset;
    xhr.upload.onprogress = (event) => {
      inactivity.reset();
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };
    xhr.onerror = () => finish(createUploadError(UPLOAD_FAILED_MESSAGE));
    xhr.ontimeout = () => finish(createUploadError(UPLOAD_INTERRUPTED_MESSAGE));
    xhr.onabort = () => finish(createUploadError(UPLOAD_ABORTED_MESSAGE));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        finish(
          createUploadPartError(
            xhr.status,
            xhr.responseText || xhr.statusText,
            xhr.status === 403,
            xhr.getResponseHeader('Retry-After'),
          ),
        );
        return;
      }
      onProgress(chunk.size);
      finish();
    };
    unregisterAborter = registerAborter(() => {
      finish(createUploadError(UPLOAD_ABORTED_MESSAGE));
      xhr.abort();
    });
    if (settled) {
      unregisterAborter();
      return;
    }
    try {
      xhr.send(chunk);
    } catch (error) {
      finish(createUploadError(error));
    }
  });
}

function putRelayedPart(request: UploadPartRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', controlUrl('part', request, request.partNumber));
    xhr.withCredentials = true;
    xhr.responseType = 'text';
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    let settled = false;
    let unregisterAborter = () => {};
    const inactivity = watchUploadInactivity(() => {
      finish(createUploadError(UPLOAD_INTERRUPTED_MESSAGE));
      xhr.abort();
    });
    const finish = (result: string | Error) => {
      if (settled) {
        return;
      }
      settled = true;
      inactivity.stop();
      unregisterAborter();
      xhr.upload.onprogress = null;
      xhr.onprogress = null;
      xhr.onerror = null;
      xhr.ontimeout = null;
      xhr.onabort = null;
      xhr.onload = null;
      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result);
      }
    };

    xhr.onprogress = inactivity.reset;
    xhr.upload.onprogress = (event) => {
      inactivity.reset();
      if (event.lengthComputable) {
        request.onProgress(event.loaded);
      }
    };
    xhr.onerror = () => finish(createUploadError(UPLOAD_FAILED_MESSAGE));
    xhr.ontimeout = () => finish(createUploadError(UPLOAD_INTERRUPTED_MESSAGE));
    xhr.onabort = () => finish(createUploadError(UPLOAD_ABORTED_MESSAGE));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
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
      try {
        const response = JSON.parse(xhr.responseText || '{}') as ConfirmResponse;
        if (!response.etag) {
          finish(createUploadError('Missing ETag for uploaded part'));
          return;
        }
        request.onProgress(request.chunk.size);
        finish(response.etag);
      } catch (error) {
        finish(createUploadError(error));
      }
    };
    unregisterAborter = request.registerAborter(() => {
      finish(createUploadError(UPLOAD_ABORTED_MESSAGE));
      xhr.abort();
    });
    if (settled) {
      unregisterAborter();
      return;
    }
    try {
      xhr.send(request.chunk);
    } catch (error) {
      finish(createUploadError(error));
    }
  });
}

export async function verifyUploadPrefix(request: VerifyUploadPrefixRequest): Promise<void> {
  await retryUpload(
    () => postControl<void>(controlUrl('prefix', request), request.registerAborter, request.prefix),
    request,
  );
}

export async function uploadDirectPartWithRetry(request: UploadPartRequest): Promise<string> {
  await retryUpload(async () => {
    const presigned = await postControl<PresignResponse>(
      controlUrl('part/presign', request, request.partNumber),
      request.registerAborter,
    );
    if (!presigned.url) {
      throw createUploadError('Missing presigned URL for uploaded part');
    }
    await putPresignedPart(presigned.url, request.chunk, request.onProgress, request.registerAborter);
  }, request);
  // Once storage accepted the bytes, only retry acknowledgement; never send the part again.
  return retryUpload(async () => {
    const confirmed = await postControl<ConfirmResponse>(
      controlUrl('part/confirm', request, request.partNumber),
      request.registerAborter,
    );
    if (!confirmed.etag) {
      throw createUploadError('Missing ETag for uploaded part');
    }
    return confirmed.etag;
  }, request);
}

export async function uploadRelayedPartWithRetry(request: UploadPartRequest): Promise<string> {
  return retryUpload(() => putRelayedPart(request), request);
}
