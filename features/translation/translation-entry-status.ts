import type { TranslationEntry } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { getTranslationJobDisplayStatusKey } from '@/lib/translation/job-status';

export type TranslationEntryPresenceKey = 'existing' | 'missing';

interface TranslationEntryPresenceLabels {
  existing: string;
  missing: string;
}

interface TranslationJobStatusLabels {
  unknown: string;
}

export function getTranslationEntryPresenceKey(entry: TranslationEntry | undefined): TranslationEntryPresenceKey {
  return entry ? 'existing' : 'missing';
}

export function getTranslationEntryPresenceColor(presence: TranslationEntryPresenceKey): string {
  switch (presence) {
    case 'existing':
      return 'green';
    case 'missing':
      return 'gray';
  }
}

export function getTranslationEntryPresenceLabel(
  presence: TranslationEntryPresenceKey,
  labels: TranslationEntryPresenceLabels,
): string {
  return labels[presence];
}

export function getTranslationJobBadgeLabel(
  status: ReturnType<typeof getTranslationJobDisplayStatusKey>,
  getSharedStatusLabel: (statusKey: string) => string | null,
  labels: TranslationJobStatusLabels,
): string {
  if (status === 'unknown') {
    return labels.unknown;
  }
  return getSharedStatusLabel(status) ?? status;
}
