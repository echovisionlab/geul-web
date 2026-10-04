import {
  checkAbort,
  ClientMediaRestoreMismatchError,
  type PreparedMedia,
  type PreparedArtifact,
  type RestoreOptions,
} from './contracts';
import {
  MAX_MANIFEST_BYTES,
  MANIFEST_PATH,
  fingerprintSource,
  validateNamespace,
  disposeNamespace,
} from './artifact-storage';
import { getMediaKind, parseStoredManifest, validatePreparedOutput } from './validation';
import { hashArtifact } from './hash';

/** Recover a completed OPFS bundle without encoding; failed recovery never deletes it. */
export async function restoreMedia(
  storageId: string,
  file: File,
  options: RestoreOptions,
): Promise<PreparedMedia | null> {
  checkAbort(options.signal);
  try {
    validateNamespace(storageId);
  } catch (error) {
    throw new ClientMediaRestoreMismatchError('The prepared media storage identity is invalid.', error);
  }
  const root = await navigator.storage.getDirectory();
  checkAbort(options.signal);
  let directory: FileSystemDirectoryHandle;
  let manifestFile: File;
  try {
    directory = await root.getDirectoryHandle(storageId);
    manifestFile = await (await directory.getFileHandle(MANIFEST_PATH)).getFile();
  } catch (error) {
    checkAbort(options.signal);
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return null;
    }
    throw error;
  }
  checkAbort(options.signal);
  if (manifestFile.size > MAX_MANIFEST_BYTES) {
    throw new ClientMediaRestoreMismatchError('The prepared media manifest exceeds the allowed size.');
  }
  const manifestText = await manifestFile.text();
  checkAbort(options.signal);
  let decoded: unknown;
  try {
    decoded = JSON.parse(manifestText);
  } catch (error) {
    throw new ClientMediaRestoreMismatchError('The prepared media manifest could not be read.', error);
  }
  const manifest = parseStoredManifest(decoded, storageId);
  const { source } = manifest;
  if (
    manifest.metadata.kind !== getMediaKind(file) ||
    source.name !== file.name ||
    source.size !== file.size ||
    source.type !== file.type ||
    source.lastModified !== file.lastModified
  ) {
    throw new ClientMediaRestoreMismatchError('Select the original source file to resume this media upload.');
  }
  const totalBytes = file.size + manifest.artifacts.reduce((total, artifact) => total + artifact.size, 0);
  const sourceWeight = file.size / totalBytes;
  const fingerprint = await fingerprintSource(file, options.signal, (progress) =>
    options.onProgress?.(progress * sourceWeight),
  );
  if (fingerprint !== source.fingerprint) {
    throw new ClientMediaRestoreMismatchError('The selected source file content differs from the prepared media.');
  }
  const artifacts: PreparedArtifact[] = [];
  let verifiedBytes = file.size;
  for (const expected of manifest.artifacts) {
    checkAbort(options.signal);
    let stored: File;
    try {
      stored = await (await directory.getFileHandle(expected.path)).getFile();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        throw new ClientMediaRestoreMismatchError(`Prepared media artifact ${expected.path} is missing.`, error);
      }
      throw error;
    }
    if (stored.size !== expected.size) {
      throw new ClientMediaRestoreMismatchError(`Prepared media artifact ${expected.path} has changed size.`);
    }
    const sha256 = await hashArtifact(stored, options.signal);
    if (sha256 !== expected.sha256) {
      throw new ClientMediaRestoreMismatchError(`Prepared media artifact ${expected.path} has changed content.`);
    }
    artifacts.push({ ...expected, file: new File([stored], expected.path, { type: expected.mimeType }) });
    verifiedBytes += stored.size;
    options.onProgress?.(verifiedBytes / totalBytes);
  }
  checkAbort(options.signal);
  validatePreparedOutput(manifest.metadata, artifacts, manifest.metadata.kind);
  return {
    storageId,
    sourceFingerprint: fingerprint,
    metadata: manifest.metadata,
    artifacts,
    dispose: () => disposeNamespace(storageId),
  };
}
