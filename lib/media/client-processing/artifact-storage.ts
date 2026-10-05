import { ClientMediaUnavailableError, checkAbort, type MediaArtifact, type PreparedArtifact } from './contracts';

import { hashArtifact, hexDigest, MAX_ARTIFACT_BYTES } from './hash';
export { MAX_ARTIFACT_BYTES } from './hash';
const PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const NAMESPACE_PATTERN = /^geul-client-media-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function validateArtifactPath(path: string): void {
  if (!PATH_PATTERN.test(path) || path === '.' || path === '..') {
    throw new Error(`Invalid client media artifact path: ${path}`);
  }
}

export function validateNamespace(namespace: string): void {
  if (!NAMESPACE_PATTERN.test(namespace)) {
    throw new Error('Invalid client media storage namespace.');
  }
}

export async function disposeNamespace(namespace: string): Promise<void> {
  validateNamespace(namespace);
  const root = await navigator.storage.getDirectory();
  try {
    await root.removeEntry(namespace, { recursive: true });
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
      throw error;
    }
  }
}

export async function createArtifactStore(namespace: string, signal: AbortSignal) {
  validateNamespace(namespace);
  checkAbort(signal);
  let directory: FileSystemDirectoryHandle;
  try {
    const root = await navigator.storage.getDirectory();
    directory = await root.getDirectoryHandle(namespace, { create: true });
  } catch (error) {
    if (
      !(error instanceof DOMException) ||
      !['SecurityError', 'NotSupportedError', 'QuotaExceededError', 'NotAllowedError', 'InvalidStateError'].includes(
        error.name,
      )
    ) {
      throw error;
    }
    throw new ClientMediaUnavailableError('Origin-private media storage is unavailable.', 'storage', {
      cause: error,
    });
  }
  const artifacts: PreparedArtifact[] = [];
  const paths = new Set<string>();
  let disposalRequested = false;
  let pendingWrites: Promise<void> = Promise.resolve();
  let disposal: Promise<void> | undefined;

  async function persistArtifact(artifact: MediaArtifact): Promise<void> {
    checkAbort(signal);
    if (disposalRequested) {
      throw new Error('Client media artifact storage was disposed.');
    }
    validateArtifactPath(artifact.path);
    if (artifact.path === MANIFEST_PATH) {
      throw new Error('The media manifest filename is reserved for prepared-bundle identity.');
    }
    if (paths.has(artifact.path)) {
      throw new Error(`Duplicate client media artifact: ${artifact.path}`);
    }
    if (!artifact.mimeType || /[\r\n]/.test(artifact.mimeType)) {
      throw new Error('Invalid client media artifact MIME type.');
    }
    if (artifact.blob.size > MAX_ARTIFACT_BYTES) {
      throw new ClientMediaUnavailableError('A media artifact exceeds the browser hash budget.', 'resource');
    }
    paths.add(artifact.path);
    const handle = await directory.getFileHandle(artifact.path, { create: true });
    const writable = await handle.createWritable();
    try {
      // The processor awaits this callback; OPFS write backpressure prevents
      // retaining an array of encoded Blob payloads in JavaScript memory.
      await writable.write(artifact.blob);
      checkAbort(signal);
      await writable.close();
    } catch (error) {
      await writable.abort(error).catch(() => undefined);
      throw error;
    }
    const file = await handle.getFile();
    if (file.size !== artifact.blob.size) {
      throw new Error(`Client media artifact size changed while persisting ${artifact.path}.`);
    }
    checkAbort(signal);
    const sha256 = await hashArtifact(file, signal);
    artifacts.push({
      path: artifact.path,
      mimeType: artifact.mimeType,
      size: file.size,
      sha256,
      file,
    });
  }

  return {
    write(artifact: MediaArtifact): Promise<void> {
      const operation = pendingWrites.then(() => persistArtifact(artifact));
      pendingWrites = operation.catch(() => undefined);
      return operation;
    },
    artifacts(): PreparedArtifact[] {
      return [...artifacts];
    },
    dispose(): Promise<void> {
      if (!disposal) {
        disposalRequested = true;
        disposal = (async () => {
          await pendingWrites;
          await disposeNamespace(namespace);
          artifacts.length = 0;
        })().catch((error) => {
          disposal = undefined;
          throw error;
        });
      }
      return disposal;
    },
  };
}

export const SOURCE_CHUNK_BYTES = 8 * 1024 * 1024;
export const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;
export const MANIFEST_PATH = 'manifest.json';

export interface SourceIdentity {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  fingerprint: string;
}

export interface StoredManifest {
  version: 1;
  storageId: string;
  metadata: import('./contracts').MediaMetadata;
  source: SourceIdentity;
  artifacts: Array<Omit<PreparedArtifact, 'file'>>;
}

/** Versioned whole-source identity, deliberately distinct from ordinary SHA-256. */
export async function fingerprintSource(
  file: File,
  signal: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<string> {
  checkAbort(signal);
  const chunkBytes = SOURCE_CHUNK_BYTES;
  // Keep NUL separators outside a template literal. Turbopack may inline a
  // numeric interpolation after \0 and emit an invalid octal escape.
  const header = new TextEncoder().encode(
    ['geul-client-media-source/v1', String(file.size), String(chunkBytes)].join(String.fromCharCode(0)),
  );
  let previous = new Uint8Array(await crypto.subtle.digest('SHA-256', header));
  for (let position = 0; position < file.size; position += chunkBytes) {
    checkAbort(signal);
    const end = Math.min(file.size, position + chunkBytes);
    const current = new Uint8Array(
      await crypto.subtle.digest('SHA-256', await file.slice(position, end).arrayBuffer()),
    );
    checkAbort(signal);
    const pair = new Uint8Array(64);
    pair.set(previous);
    pair.set(current, 32);
    previous = new Uint8Array(await crypto.subtle.digest('SHA-256', pair));
    onProgress?.(end / file.size);
  }
  checkAbort(signal);
  onProgress?.(1);
  return `client-media-source-v1:${hexDigest(previous)}`;
}

export async function saveManifest(namespace: string, manifest: StoredManifest, signal: AbortSignal): Promise<void> {
  validateNamespace(namespace);
  checkAbort(signal);
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  if (blob.size > MAX_MANIFEST_BYTES) {
    throw new ClientMediaUnavailableError('The prepared media manifest exceeds the browser budget.', 'resource');
  }
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle(namespace);
  const handle = await directory.getFileHandle(MANIFEST_PATH, { create: true });
  const writer = await handle.createWritable();
  try {
    await writer.write(blob);
    checkAbort(signal);
    await writer.close();
  } catch (error) {
    await writer.abort(error).catch(() => undefined);
    throw error;
  }
}
