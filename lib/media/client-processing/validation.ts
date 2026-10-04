import { ClientMediaRestoreMismatchError, type MediaMetadata, type PreparedArtifact } from './contracts';
import { MAX_ARTIFACT_BYTES, MANIFEST_PATH, validateArtifactPath, type StoredManifest } from './artifact-storage';

function hasValidDuration(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function hasVideoDimensions(metadata: Record<string, unknown> | MediaMetadata): boolean {
  return (
    Number.isSafeInteger(metadata.width) &&
    Number.isSafeInteger(metadata.height) &&
    (metadata.width as number) > 0 &&
    (metadata.height as number) > 0
  );
}

function hasArtifactFields(artifact: Record<string, unknown> | PreparedArtifact): boolean {
  return (
    Number.isSafeInteger(artifact.size) &&
    (artifact.size as number) > 0 &&
    (artifact.size as number) <= MAX_ARTIFACT_BYTES &&
    typeof artifact.mimeType === 'string' &&
    Boolean(artifact.mimeType) &&
    !/[\r\n]/.test(artifact.mimeType) &&
    typeof artifact.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(artifact.sha256)
  );
}

function isBundleComplete(kind: 'audio' | 'video', paths: Set<string>): boolean {
  const required =
    kind === 'audio' ? ['master.m3u8', 'spectrogram.png', 'waveform.json'] : ['master.m3u8', 'thumbnail.webp'];
  return required.every((path) => paths.has(path));
}

export function validatePreparedOutput(
  metadata: MediaMetadata,
  artifacts: PreparedArtifact[],
  kind: 'audio' | 'video',
): void {
  if (metadata.kind !== kind || !hasValidDuration(metadata.durationSeconds)) {
    throw new Error('Client media Worker returned invalid metadata.');
  }
  if (kind === 'video' && !hasVideoDimensions(metadata)) {
    throw new Error('Client media Worker returned invalid video dimensions.');
  }
  const paths = new Set<string>();
  for (const artifact of artifacts) {
    validateArtifactPath(artifact.path);
    if (
      paths.has(artifact.path) ||
      !hasArtifactFields(artifact) ||
      !(artifact.file instanceof File) ||
      artifact.file.size !== artifact.size
    ) {
      throw new Error(`Client media Worker returned invalid artifact ${artifact.path}.`);
    }
    paths.add(artifact.path);
  }
  if (!isBundleComplete(kind, paths)) {
    throw new Error('Client media Worker returned an incomplete artifact bundle.');
  }
}

export function getMediaKind(file: Pick<File, 'type' | 'name'>): 'audio' | 'video' | null {
  if (file.type.startsWith('audio/')) {
    return 'audio';
  }
  if (file.type.startsWith('video/')) {
    return 'video';
  }
  if (!file.type && /\.(wav|aiff?|caf|mp3|m4a|flac|ogg|opus|aac)$/i.test(file.name)) {
    return 'audio';
  }
  if (!file.type && /\.(mp4|mov|mkv|webm|m4v)$/i.test(file.name)) {
    return 'video';
  }
  return null;
}

export function isSourceFingerprint(value: unknown): value is string {
  return typeof value === 'string' && /^client-media-source-v1:[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseStoredManifest(value: unknown, storageId: string): StoredManifest {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.storageId !== storageId ||
    !isRecord(value.metadata) ||
    !isRecord(value.source) ||
    !Array.isArray(value.artifacts)
  ) {
    throw new ClientMediaRestoreMismatchError('The prepared media manifest is invalid.');
  }
  const { metadata, source } = value;
  if (
    (metadata.kind !== 'audio' && metadata.kind !== 'video') ||
    !hasValidDuration(metadata.durationSeconds) ||
    (metadata.kind === 'video' && !hasVideoDimensions(metadata)) ||
    typeof source.name !== 'string' ||
    typeof source.type !== 'string' ||
    !Number.isSafeInteger(source.size) ||
    (source.size as number) < 0 ||
    !Number.isSafeInteger(source.lastModified) ||
    !isSourceFingerprint(source.fingerprint)
  ) {
    throw new ClientMediaRestoreMismatchError('The prepared media manifest identity is invalid.');
  }
  const paths = new Set<string>();
  for (const artifact of value.artifacts) {
    if (
      !isRecord(artifact) ||
      typeof artifact.path !== 'string' ||
      artifact.path === MANIFEST_PATH ||
      paths.has(artifact.path) ||
      !hasArtifactFields(artifact)
    ) {
      throw new ClientMediaRestoreMismatchError('The prepared media artifact manifest is invalid.');
    }
    try {
      validateArtifactPath(artifact.path);
    } catch (error) {
      throw new ClientMediaRestoreMismatchError('The prepared media artifact path is invalid.', error);
    }
    paths.add(artifact.path);
  }
  if (!isBundleComplete(metadata.kind, paths)) {
    throw new ClientMediaRestoreMismatchError('The prepared media artifact manifest is incomplete.');
  }
  return value as unknown as StoredManifest;
}
