export type ClientMediaUnavailableReason = 'capability' | 'source' | 'storage' | 'resource';

/** A known browser, source, or storage limitation that prevents local processing. */
export class ClientMediaUnavailableError extends Error {
  readonly code = 'CLIENT_MEDIA_UNAVAILABLE';

  constructor(
    message: string,
    readonly reason: ClientMediaUnavailableReason = 'capability',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ClientMediaUnavailableError';
  }
}

/** Cached bytes cannot safely resume the immutable upload manifest. */
export class ClientMediaRestoreMismatchError extends Error {
  readonly code = 'CLIENT_MEDIA_RESTORE_MISMATCH';

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'ClientMediaRestoreMismatchError';
  }
}

export interface MediaArtifact {
  path: string;
  mimeType: string;
  blob: Blob;
}

export interface ProcessingOptions {
  signal: AbortSignal;
  codecAssetBaseUrl: string;
  onProgress: (progress: number) => void;
  onArtifact: (artifact: MediaArtifact) => Promise<void>;
}

export interface MediaMetadata {
  kind: 'audio' | 'video';
  durationSeconds: number;
  width?: number;
  height?: number;
}

export interface PreparedArtifact {
  path: string;
  mimeType: string;
  size: number;
  sha256: string;
  file: File;
}

export interface PreparedMedia {
  storageId: string;
  sourceFingerprint: string;
  metadata: MediaMetadata;
  artifacts: PreparedArtifact[];
  dispose: () => Promise<void>;
}

export interface RestoreOptions {
  signal: AbortSignal;
  onProgress?: (progress: number) => void;
}

export interface PrepareOptions {
  signal: AbortSignal;
  onProgress: (progress: number) => void;
  /** Explicit self-hosted mirror, including browser fixture hosts. */
  codecAssetBaseUrl?: string;
}

export function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('Media processing was aborted.', 'AbortError');
  }
}

export type WorkerReply =
  | { type: 'progress'; progress: number }
  | {
      type: 'complete';
      metadata: MediaMetadata;
      artifacts: PreparedArtifact[];
      storageId: string;
      sourceFingerprint: string;
    }
  | { type: 'disposed' }
  | {
      type: 'error';
      error: {
        name: string;
        message: string;
        stack?: string;
        unavailableReason?: ClientMediaUnavailableError['reason'];
        processingStarted?: boolean;
      };
    };
