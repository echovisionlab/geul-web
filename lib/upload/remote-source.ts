import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { ClientMediaUnavailableError, checkAbort } from '@/lib/media/client-processing/contracts';
import { getUploadSelectionMaxSize } from '@/lib/utils/upload-policy';
import type { UploadOptions } from './file-upload-contract';
import { createUploadCorrelationId } from './remote-import';
import { retryUpload } from './upload-retry';
import { createUploadPartError } from './upload-errors';
import { watchUploadInactivity } from './upload-inactivity';
import { UPLOAD_INTERRUPTED_MESSAGE } from './failure';

const UNTARGETED_TYPES = new Set([
  UploadType.GENERAL_FILE,
  UploadType.EDITOR_IMAGE,
  UploadType.EDITOR_VIDEO,
  UploadType.EDITOR_AUDIO,
  UploadType.EDITOR_ATTACHMENT,
  UploadType.EDITOR_MESH,
]);

export function createRemoteSourceUrl(url: string, options: UploadOptions): string {
  if (new URL(url).protocol !== 'https:') {
    throw new Error('Remote upload sources must use HTTPS.');
  }
  const query = new URLSearchParams({ uploadType: String(options.uploadType), url });
  if (!UNTARGETED_TYPES.has(options.uploadType)) {
    for (const key of ['entityId', 'entityType', 'slotId', 'expectedCurrentFileId'] as const) {
      const value = options[key];
      if (value !== undefined && value !== '') {
        query.set(key, String(value));
      }
    }
  }
  return `/api/upload/source?${query}`;
}

function sourceMetadata(response: Response, uploadType: UploadType) {
  const type = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const encodedName = /(?:^|;)\s*filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const quotedName = /(?:^|;)\s*filename="((?:[^"\\]|\\.)*)"/i.exec(disposition)?.[1];
  const bareName = /(?:^|;)\s*filename=([^";\s]+)(?:\s*(?:;|$))/i.exec(disposition)?.[1];
  const name = encodedName ? decodeURIComponent(encodedName) : (quotedName?.replace(/\\(.)/g, '$1') ?? bareName);
  if (
    !type ||
    !name ||
    name.includes('/') ||
    name.includes('\\') ||
    Array.from(name).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    name === '.' ||
    name === '..'
  ) {
    throw new Error('Remote upload source metadata is invalid.');
  }
  const rawSize = response.headers.get('X-Upload-Source-Size');
  const size = rawSize === null ? undefined : Number(rawSize);
  if (rawSize !== null && (!/^\d+$/.test(rawSize) || !Number.isSafeInteger(size) || size! < 1)) {
    throw new Error('Remote upload source size is invalid.');
  }
  const maxSize = getUploadSelectionMaxSize(uploadType, type, UPLOAD_CONFIGS[uploadType].maxSize);
  if (size !== undefined && size > maxSize) {
    throw new ClientMediaUnavailableError('Remote upload source exceeds the upload size limit.', 'resource');
  }
  return { type, name, size, maxSize };
}

async function downloadRemoteSourceAttempt(
  url: string,
  options: UploadOptions,
  signal: AbortSignal,
  onProgress: (loaded: number, total?: number) => void,
): Promise<{ file: File; storageId: string; dispose: () => Promise<void> }> {
  checkAbort(signal);
  if (typeof navigator === 'undefined' || typeof navigator.storage?.getDirectory !== 'function') {
    throw new ClientMediaUnavailableError('Origin-private storage is required to import a URL.', 'capability');
  }
  const endpoint = createRemoteSourceUrl(url, options);
  const namespace = `geul-client-media-${createUploadCorrelationId()}`;
  const connection = new AbortController();
  let idle = false;
  let inactivity: ReturnType<typeof watchUploadInactivity> | undefined;
  const checkConnection = () => {
    checkAbort(signal);
    if (idle) {
      throw new Error(UPLOAD_INTERRUPTED_MESSAGE);
    }
  };
  const abortConnection = () => connection.abort(signal.reason);
  let root: FileSystemDirectoryHandle | undefined;
  let writer: FileSystemWritableFileStream | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let closed = false;
  let namespaceCreated = false;
  let disposed = false;
  const dispose = async () => {
    if (root && namespaceCreated && !disposed) {
      await root.removeEntry(namespace, { recursive: true });
      disposed = true;
    }
  };
  const abortReader = () => {
    void reader?.cancel(connection.signal.reason).catch(() => undefined);
  };
  signal.addEventListener('abort', abortConnection, { once: true });
  connection.signal.addEventListener('abort', abortReader, { once: true });
  if (signal.aborted) {
    abortConnection();
  }
  try {
    root = await navigator.storage.getDirectory();
    checkAbort(signal);
    const directory = await root.getDirectoryHandle(namespace, { create: true });
    namespaceCreated = true;
    checkAbort(signal);
    inactivity = watchUploadInactivity(() => {
      idle = true;
      connection.abort();
    });
    let response: Response;
    try {
      response = await fetch(endpoint, { credentials: 'same-origin', signal: connection.signal });
    } finally {
      inactivity.stop();
    }
    checkConnection();
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) {
        throw new Error(response.status === 401 ? 'Unauthorized' : 'Forbidden');
      }
      throw createUploadPartError(
        response.status,
        'Remote source download failed.',
        false,
        response.headers.get('Retry-After'),
      );
    }
    if (!response.body) {
      throw new Error('Remote upload source has no body.');
    }
    reader = response.body.getReader();
    checkAbort(signal);
    const metadata = sourceMetadata(response, options.uploadType);
    const handle = await directory.getFileHandle('source', { create: true });
    writer = await handle.createWritable();
    let loaded = 0;
    onProgress(0, metadata.size);
    while (true) {
      checkAbort(signal);
      inactivity.reset();
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } finally {
        inactivity.stop();
      }
      checkConnection();
      const { done, value } = chunk;
      if (done) {
        break;
      }
      loaded += value.byteLength;
      if (loaded > metadata.maxSize || (metadata.size !== undefined && loaded > metadata.size)) {
        throw new ClientMediaUnavailableError(
          'Remote upload source exceeds its declared size or upload limit.',
          'resource',
        );
      }
      // Await every write before reading again: only the current network chunk is retained here.
      await writer.write(value as Uint8Array<ArrayBuffer>);
      checkAbort(signal);
      onProgress(loaded, metadata.size);
    }
    if (loaded === 0 || (metadata.size !== undefined && loaded !== metadata.size)) {
      throw new Error('Remote upload source was truncated.');
    }
    await writer.close();
    closed = true;
    checkAbort(signal);
    const storedFile = await handle.getFile();
    if (storedFile.size !== loaded) {
      throw new Error('Remote upload source size changed in storage.');
    }
    checkAbort(signal);
    // Blob composition references the OPFS snapshot; it does not read the source into JavaScript memory.
    const file = new File([storedFile], metadata.name, { type: metadata.type, lastModified: 0 });
    return { file, storageId: namespace, dispose };
  } catch (error) {
    if (writer && !closed) {
      await writer.abort(error).catch(() => undefined);
    }
    await dispose();
    checkConnection();
    if (
      error instanceof DOMException &&
      ['QuotaExceededError', 'SecurityError', 'NotAllowedError', 'NotSupportedError'].includes(error.name)
    ) {
      throw new ClientMediaUnavailableError('Origin-private source storage is unavailable.', 'storage', {
        cause: error,
      });
    }
    throw error;
  } finally {
    inactivity?.stop();
    signal.removeEventListener('abort', abortConnection);
    connection.signal.removeEventListener('abort', abortReader);
    connection.abort();
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
  }
}

/** Owns the source namespace until the direct-upload pipeline has finished consuming its File. */
export async function downloadRemoteSource(
  url: string,
  options: UploadOptions,
  signal: AbortSignal,
  onProgress: (loaded: number, total?: number) => void,
): Promise<{ file: File; storageId: string; dispose: () => Promise<void> }> {
  checkAbort(signal);
  try {
    return await retryUpload(() => downloadRemoteSourceAttempt(url, options, signal, onProgress), {
      isAborted: () => signal.aborted,
      registerAborter: (aborter) => {
        signal.addEventListener('abort', aborter, { once: true });
        if (signal.aborted) {
          aborter();
        }
        return () => signal.removeEventListener('abort', aborter);
      },
    });
  } catch (error) {
    // The shared uploader reports its own cancellation error; source callers retain DOM AbortError semantics.
    checkAbort(signal);
    throw error;
  }
}
