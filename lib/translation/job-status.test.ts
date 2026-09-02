import { TranslationJobStatus } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { describe, expect, it } from 'vitest';
import {
  getTranslationJobDisplayStatusKey,
  getTranslationJobDisplayStatusTone,
  shouldShowTranslationJobStatusBadge,
} from './job-status';

describe('translation job visibility', () => {
  it('renders only persisted active job statuses', () => {
    expect(shouldShowTranslationJobStatusBadge(TranslationJobStatus.QUEUED)).toBe(true);
    expect(shouldShowTranslationJobStatusBadge(TranslationJobStatus.RUNNING)).toBe(true);
    expect(shouldShowTranslationJobStatusBadge(TranslationJobStatus.UNSPECIFIED)).toBe(false);
    expect(getTranslationJobDisplayStatusKey(TranslationJobStatus.QUEUED)).toBe('queued');
    expect(getTranslationJobDisplayStatusKey(TranslationJobStatus.RUNNING)).toBe('running');
    expect(getTranslationJobDisplayStatusKey(TranslationJobStatus.UNSPECIFIED)).toBe('unknown');
    expect(getTranslationJobDisplayStatusTone(TranslationJobStatus.RUNNING)).toBe('accent');
    expect(getTranslationJobDisplayStatusTone(TranslationJobStatus.UNSPECIFIED)).toBe('neutral');
  });
});
