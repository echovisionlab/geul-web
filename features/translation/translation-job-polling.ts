import { TranslationJobStatus, type TranslationJob } from '@echovisionlab/geul-proto/secure/translation_pb.ts';

export const ACTIVE_TRANSLATION_JOB_REFETCH_INTERVAL_MS = 2_000;

export function isActiveTranslationJobStatus(status: TranslationJobStatus): boolean {
  return status === TranslationJobStatus.QUEUED || status === TranslationJobStatus.RUNNING;
}

export function hasActiveTranslationJobs(jobs: TranslationJob[] | undefined): boolean {
  return (jobs ?? []).some((job) => isActiveTranslationJobStatus(job.status));
}

export function filterActiveTranslationJobs(jobs: TranslationJob[] | undefined): TranslationJob[] {
  return (jobs ?? []).filter((job) => isActiveTranslationJobStatus(job.status));
}

export function translationJobsRefetchInterval(
  jobs: TranslationJob[] | undefined,
  queryError?: unknown,
): number | false {
  return queryError == null && hasActiveTranslationJobs(jobs) ? ACTIVE_TRANSLATION_JOB_REFETCH_INTERVAL_MS : false;
}

export function translationOverviewRefetchInterval(
  activeJobs: number | bigint | undefined,
  queryError?: unknown,
): number | false {
  return queryError == null && Number(activeJobs ?? 0) > 0 ? ACTIVE_TRANSLATION_JOB_REFETCH_INTERVAL_MS : false;
}

export function shouldRefreshTranslationEntries(
  previousJobs: TranslationJob[] | undefined,
  currentJobs: TranslationJob[] | undefined,
): boolean {
  if (previousJobs == null || currentJobs == null) {
    return false;
  }

  const currentStatusById = new Map(currentJobs.map((job) => [job.id, job.status]));

  return previousJobs.some(
    (job) =>
      isActiveTranslationJobStatus(job.status) &&
      !isActiveTranslationJobStatus(currentStatusById.get(job.id) ?? TranslationJobStatus.UNSPECIFIED),
  );
}
