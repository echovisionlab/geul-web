import { describe, expect, it } from 'vitest';
import { create } from '@bufbuild/protobuf';
import {
  TranslationJobSchema,
  TranslationJobStatus,
  TranslationService,
  type TranslationJob,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import {
  ACTIVE_TRANSLATION_JOB_REFETCH_INTERVAL_MS,
  filterActiveTranslationJobs,
  shouldRefreshTranslationEntries,
  translationJobsRefetchInterval,
  translationOverviewRefetchInterval,
} from './translation-job-polling';

function createJob(id: string, status: TranslationJobStatus): TranslationJob {
  return create(TranslationJobSchema, { id, status });
}

describe('translation job polling', () => {
  it('does not expose the removed same-job retry contract', () => {
    expect(TranslationService.method).not.toHaveProperty('retryTranslationJob');
  });

  it('polls entity jobs only while they are active and healthy', () => {
    expect(translationJobsRefetchInterval([createJob('queued', TranslationJobStatus.QUEUED)])).toBe(
      ACTIVE_TRANSLATION_JOB_REFETCH_INTERVAL_MS,
    );
    expect(translationJobsRefetchInterval([createJob('running', TranslationJobStatus.RUNNING)])).toBe(
      ACTIVE_TRANSLATION_JOB_REFETCH_INTERVAL_MS,
    );
    expect(translationJobsRefetchInterval([])).toBe(false);
    expect(
      translationJobsRefetchInterval([createJob('running', TranslationJobStatus.RUNNING)], new Error('unavailable')),
    ).toBe(false);
    expect(translationJobsRefetchInterval(undefined, new Error('unavailable'))).toBe(false);
  });

  it('keeps only active rows at the client query boundary', () => {
    expect(
      filterActiveTranslationJobs([
        createJob('queued', TranslationJobStatus.QUEUED),
        createJob('running', TranslationJobStatus.RUNNING),
      ]).map((job) => job.id),
    ).toEqual(['queued', 'running']);
  });

  it('polls the overview only while jobs are active', () => {
    expect(translationOverviewRefetchInterval(1)).toBe(ACTIVE_TRANSLATION_JOB_REFETCH_INTERVAL_MS);
    expect(translationOverviewRefetchInterval(0)).toBe(false);
    expect(translationOverviewRefetchInterval(3, new Error('unavailable'))).toBe(false);
  });

  it('refreshes entries when an observed active job disappears from the authoritative query', () => {
    expect(shouldRefreshTranslationEntries([createJob('job-1', TranslationJobStatus.RUNNING)], [])).toBe(true);
    expect(
      shouldRefreshTranslationEntries(
        [createJob('job-1', TranslationJobStatus.QUEUED)],
        [createJob('job-1', TranslationJobStatus.RUNNING)],
      ),
    ).toBe(false);
    expect(shouldRefreshTranslationEntries(undefined, [])).toBe(false);
  });
});
