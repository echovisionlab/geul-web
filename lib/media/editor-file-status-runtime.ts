import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';

export type EditorMediaRuntimeProcessingStatus = 'processing' | 'ready' | 'failed';

export interface EditorFileStatusSnapshot {
  mimeType?: string;
  completed: boolean;
  failed: boolean;
  unavailable: boolean;
  url: string;
  originalUrl: string;
  waveformUrl: string;
  spectrogramUrl: string;
  thumbnailUrl: string;
  hlsUrl: string;
  durationSeconds: number;
  processingStatus: MediaProcessingStatus;
  processingPercentage?: number;
}

interface BaseEditorMediaRuntimeState {
  processingStatus: EditorMediaRuntimeProcessingStatus;
  processingProgress: string;
  url: string;
  hlsUrl: string;
  duration: string;
}

export interface EditorFileStatusRuntimeState extends BaseEditorMediaRuntimeState {
  mimeType: string;
  originalUrl: string;
  waveformUrl: string;
  spectrogramUrl: string;
  thumbnailUrl: string;
}

export interface EditorAudioFileStatusRuntimeState extends BaseEditorMediaRuntimeState {
  originalUrl: string;
  waveformUrl: string;
  spectrogramUrl: string;
}

export interface EditorVideoFileStatusRuntimeState extends BaseEditorMediaRuntimeState {
  thumbnailUrl: string;
}

export interface EditorImageFileStatusRuntimeState {
  url: string;
}

function normalizeProcessingPercentage(percentage?: number): string {
  if (typeof percentage !== 'number' || !Number.isFinite(percentage)) {
    return '0';
  }
  return String(Math.max(0, Math.min(100, Math.round(percentage))));
}

function resolveProcessingStatus(status: EditorFileStatusSnapshot) {
  if (status.failed || status.processingStatus === MediaProcessingStatus.FAILED) {
    return 'failed';
  }
  if (status.completed || status.processingStatus === MediaProcessingStatus.READY) {
    return 'ready';
  }
  return 'processing';
}

function resolveProcessingProgress(status: EditorFileStatusSnapshot) {
  if (status.completed || status.failed) {
    return '0';
  }
  if (status.processingStatus === MediaProcessingStatus.PROCESSING) {
    return normalizeProcessingPercentage(status.processingPercentage);
  }
  return '0';
}

function hasAnyRuntimeMediaValue(status: EditorFileStatusSnapshot, fields: Array<keyof EditorFileStatusSnapshot>) {
  return fields.some((field) => Boolean(status[field]));
}

function hasProcessingRuntimeState(status: EditorFileStatusSnapshot): boolean {
  return (
    status.processingStatus === MediaProcessingStatus.PROCESSING || typeof status.processingPercentage === 'number'
  );
}

/**
 * Maps an authoritative File delivery response into ephemeral editor state.
 * An unavailable response is intentionally not cached so the document keeps
 * its durable File reference without mistaking a transport failure for a
 * terminal media state.
 */
export function resolveEditorFileStatusRuntime(status: EditorFileStatusSnapshot): EditorFileStatusRuntimeState | null {
  if (status.unavailable) {
    return null;
  }

  const originalUrl = status.originalUrl || status.url;
  return {
    mimeType: status.mimeType || '',
    processingStatus: resolveProcessingStatus(status),
    processingProgress: resolveProcessingProgress(status),
    url: status.url || originalUrl,
    originalUrl,
    hlsUrl: status.hlsUrl || '',
    waveformUrl: status.waveformUrl || '',
    spectrogramUrl: status.spectrogramUrl || '',
    thumbnailUrl: status.thumbnailUrl || '',
    duration: String(status.durationSeconds || 0),
  };
}

export function resolveImageFileStatusRuntime(
  status: EditorFileStatusSnapshot,
): EditorImageFileStatusRuntimeState | null {
  const url = status.url || status.originalUrl;
  return url ? { url } : null;
}

export function resolveAudioFileStatusRuntime(
  status: EditorFileStatusSnapshot,
): EditorAudioFileStatusRuntimeState | null {
  const runtimeOriginalUrl = status.originalUrl || status.url;
  if (
    !status.failed &&
    !hasProcessingRuntimeState(status) &&
    !hasAnyRuntimeMediaValue(status, [
      'url',
      'originalUrl',
      'hlsUrl',
      'waveformUrl',
      'spectrogramUrl',
      'durationSeconds',
    ])
  ) {
    return null;
  }

  return {
    processingStatus: resolveProcessingStatus(status),
    processingProgress: resolveProcessingProgress(status),
    url: runtimeOriginalUrl,
    originalUrl: runtimeOriginalUrl,
    hlsUrl: status.hlsUrl || '',
    waveformUrl: status.waveformUrl || '',
    spectrogramUrl: status.spectrogramUrl || '',
    duration: String(status.durationSeconds || 0),
  };
}

export function resolveVideoFileStatusRuntime(
  status: EditorFileStatusSnapshot,
): EditorVideoFileStatusRuntimeState | null {
  const runtimeOriginalUrl = status.originalUrl || status.url;
  if (
    !status.failed &&
    !hasProcessingRuntimeState(status) &&
    !hasAnyRuntimeMediaValue(status, ['url', 'originalUrl', 'hlsUrl', 'thumbnailUrl', 'durationSeconds'])
  ) {
    return null;
  }

  return {
    processingStatus: resolveProcessingStatus(status),
    processingProgress: resolveProcessingProgress(status),
    url: runtimeOriginalUrl,
    hlsUrl: status.hlsUrl || '',
    thumbnailUrl: status.thumbnailUrl || '',
    duration: String(status.durationSeconds || 0),
  };
}
