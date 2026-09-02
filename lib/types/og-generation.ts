export type OgGenerationEntityType =
  'post' | 'page' | 'work' | 'artist' | 'label' | 'release' | 'series' | 'form' | 'site' | 'privacy' | 'terms';

export type OgGenerationSelection = { type: 'primary' } | { type: 'locale'; locale: string } | { type: 'all_locales' };

export type OgGenerationUiStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'superseded' | 'cancelled';

export interface OgGenerationState {
  generationId: string;
  runId: string;
  status: OgGenerationUiStatus;
  assetId?: string;
  assetUrl?: string;
  errorCode?: string;
  error?: string;
  replacementGenerationId?: string;
}

export interface OgGenerationLookupSignal {
  locale: string;
  sequence: number;
}

export interface OgGenerationRunSignal extends OgGenerationLookupSignal {
  runId: string;
}

export interface OgGenerationRunState {
  runId: string;
  status: 'queued' | 'processing' | 'ready' | 'partially_failed' | 'failed' | 'cancelled';
  generationCount: number;
  queuedCount: number;
  processingCount: number;
  readyCount: number;
  failedCount: number;
  supersededCount: number;
  cancelledCount: number;
  failures: Array<{
    generationId: string;
    target?: {
      entityType: OgGenerationEntityType;
      entityId: string;
      locale?: string;
    };
    errorCode: string;
    error: string;
  }>;
}
