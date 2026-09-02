export type MediaStatusTone = 'blue' | 'cyan' | 'green' | 'red' | 'gray';

export interface MediaStatusLabels {
  uploading: string;
  processing: string;
  ready: string;
  failed: string;
  unknown: string;
  stage: {
    validating: string;
    uploading: string;
    downloading: string;
    finalizing: string;
    processing: string;
  };
}

export interface MediaStatusDisplay {
  label: string | null;
  color: MediaStatusTone;
}

type MediaStatusMessageKey =
  | 'statuses.uploading'
  | 'statuses.processing'
  | 'statuses.ready'
  | 'statuses.failed'
  | 'statuses.unknown'
  | 'statuses.stage.validating'
  | 'statuses.stage.uploading'
  | 'statuses.stage.downloading'
  | 'statuses.stage.finalizing'
  | 'statuses.stage.processing';

export interface ResolveMediaStatusDisplayOptions {
  status?: string | null;
  progress?: number | null;
  stage?: string | null;
  labels?: MediaStatusLabels;
  idleBehavior?: 'null' | 'ready' | 'unknown';
}

export interface ResolveMediaUploadStageOptions {
  status?: string | null;
  uploadStage?: string | null;
}

const MEDIA_STAGE_KEY_MAP = {
  validating: 'validating',
  uploading: 'uploading',
  downloading: 'downloading',
  finalizing: 'finalizing',
  processing: 'processing',
} as const satisfies Record<string, keyof MediaStatusLabels['stage']>;

export const DEFAULT_MEDIA_STATUS_LABELS: MediaStatusLabels = {
  uploading: 'Uploading',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
  unknown: 'Unknown',
  stage: {
    validating: 'Validating',
    uploading: 'Uploading',
    downloading: 'Downloading',
    finalizing: 'Finalizing',
    processing: 'Processing',
  },
};

function translateOrFallback(
  translator: (key: MediaStatusMessageKey) => string,
  key: MediaStatusMessageKey,
  fallback: string,
): string {
  try {
    return translator(key);
  } catch {
    return fallback;
  }
}

function normalizeProgress(progress?: number | null): number | null {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function resolveStageKey(stage?: string | null): keyof MediaStatusLabels['stage'] | null {
  switch (stage) {
    case 'validating':
    case 'uploading':
    case 'downloading':
    case 'finalizing':
    case 'processing':
      return MEDIA_STAGE_KEY_MAP[stage];
    default:
      return null;
  }
}

function resolveStageTone(stageKey: keyof MediaStatusLabels['stage'] | null): MediaStatusTone {
  switch (stageKey) {
    case 'processing':
    case 'finalizing':
      return 'cyan';
    case 'validating':
    case 'uploading':
    case 'downloading':
      return 'blue';
    default:
      return 'gray';
  }
}

function formatPendingLabel(
  stageKey: keyof MediaStatusLabels['stage'],
  progress: number | null,
  labels: MediaStatusLabels,
): string {
  const stageLabel = labels.stage[stageKey];
  return progress !== null && progress > 0 ? `${stageLabel} ${progress}%` : `${stageLabel}...`;
}

function formatAggregateProcessingLabel(label: string, progress: number | null): string {
  return progress !== null && progress > 0 ? `${label} ${progress}%` : `${label}...`;
}

export function createMediaStatusLabels(tMedia: (key: MediaStatusMessageKey) => string): MediaStatusLabels {
  return {
    uploading: translateOrFallback(tMedia, 'statuses.uploading', DEFAULT_MEDIA_STATUS_LABELS.uploading),
    processing: translateOrFallback(tMedia, 'statuses.processing', DEFAULT_MEDIA_STATUS_LABELS.processing),
    ready: translateOrFallback(tMedia, 'statuses.ready', DEFAULT_MEDIA_STATUS_LABELS.ready),
    failed: translateOrFallback(tMedia, 'statuses.failed', DEFAULT_MEDIA_STATUS_LABELS.failed),
    unknown: translateOrFallback(tMedia, 'statuses.unknown', DEFAULT_MEDIA_STATUS_LABELS.unknown),
    stage: {
      validating: translateOrFallback(
        tMedia,
        'statuses.stage.validating',
        DEFAULT_MEDIA_STATUS_LABELS.stage.validating,
      ),
      uploading: translateOrFallback(tMedia, 'statuses.stage.uploading', DEFAULT_MEDIA_STATUS_LABELS.stage.uploading),
      downloading: translateOrFallback(
        tMedia,
        'statuses.stage.downloading',
        DEFAULT_MEDIA_STATUS_LABELS.stage.downloading,
      ),
      finalizing: translateOrFallback(
        tMedia,
        'statuses.stage.finalizing',
        DEFAULT_MEDIA_STATUS_LABELS.stage.finalizing,
      ),
      processing: translateOrFallback(
        tMedia,
        'statuses.stage.processing',
        DEFAULT_MEDIA_STATUS_LABELS.stage.processing,
      ),
    },
  };
}

export function resolveMediaStatusDisplay({
  status,
  progress,
  stage,
  labels = DEFAULT_MEDIA_STATUS_LABELS,
  idleBehavior = 'null',
}: ResolveMediaStatusDisplayOptions): MediaStatusDisplay {
  const normalizedProgress = normalizeProgress(progress);
  const stageKey = resolveStageKey(stage);

  switch (status) {
    case 'uploading':
      return {
        label: formatPendingLabel(stageKey ?? 'uploading', normalizedProgress, labels),
        color: resolveStageTone(stageKey ?? 'uploading'),
      };
    case 'processing':
      return {
        label: formatAggregateProcessingLabel(labels.processing, normalizedProgress),
        color: resolveStageTone(stageKey ?? 'processing'),
      };
    case 'completed':
    case 'ready':
      return { label: labels.ready, color: 'green' };
    case 'failed':
      return { label: labels.failed, color: 'red' };
    default:
      if (idleBehavior === 'ready') {
        return { label: labels.ready, color: 'green' };
      }
      if (idleBehavior === 'unknown') {
        return { label: labels.unknown, color: 'gray' };
      }
      return { label: null, color: 'gray' };
  }
}

export function resolveMediaUploadStage({ status, uploadStage }: ResolveMediaUploadStageOptions): string | undefined {
  if (status !== 'uploading') {
    return undefined;
  }
  return uploadStage || undefined;
}

export function resolveMediaLifecycleDisplay(
  stage?: string | null,
  progress?: number | null,
  labels: MediaStatusLabels = DEFAULT_MEDIA_STATUS_LABELS,
): MediaStatusDisplay {
  if (!stage) {
    return { label: null, color: 'gray' };
  }

  if (stage === 'failed') {
    return { label: labels.failed, color: 'red' };
  }

  if (stage === 'completed' || stage === 'ready') {
    return { label: labels.ready, color: 'green' };
  }

  const stageKey = resolveStageKey(stage);
  if (!stageKey) {
    return { label: labels.unknown, color: 'gray' };
  }

  return {
    label: formatPendingLabel(stageKey, normalizeProgress(progress), labels),
    color: resolveStageTone(stageKey),
  };
}
