import { TranslationJobStatus } from '@echovisionlab/geul-proto/secure/translation_pb.ts';

export type TranslationJobDisplayStatusKey = 'queued' | 'running' | 'unknown';

export function getTranslationJobDisplayStatusKey(status: TranslationJobStatus): TranslationJobDisplayStatusKey {
  switch (status) {
    case TranslationJobStatus.QUEUED:
      return 'queued';
    case TranslationJobStatus.RUNNING:
      return 'running';
    default:
      return 'unknown';
  }
}

export function getTranslationJobDisplayStatusTone(status: TranslationJobStatus) {
  switch (status) {
    case TranslationJobStatus.QUEUED:
    case TranslationJobStatus.RUNNING:
      return 'accent' as const;
    default:
      return 'neutral' as const;
  }
}

export function shouldShowTranslationJobStatusBadge(status: TranslationJobStatus): boolean {
  return status === TranslationJobStatus.QUEUED || status === TranslationJobStatus.RUNNING;
}
