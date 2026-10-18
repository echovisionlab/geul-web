// @vitest-environment jsdom

import { create } from '@bufbuild/protobuf';
import {
  TranslationJobSchema,
  TranslationJobStatus,
  type TranslationJob,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { describe, expect, it } from 'vitest';
import { selectActiveTranslationJobsByLocale } from './useActiveTranslationJobsByLocale';

function createJob(id: string, targetLocale: string, status: TranslationJobStatus): TranslationJob {
  return create(TranslationJobSchema, { id, targetLocale, status });
}

describe('useActiveTranslationJobsByLocale', () => {
  it('exposes only one active job per locale', () => {
    const jobs = [
      createJob('queued', 'ko', TranslationJobStatus.QUEUED),
      createJob('running-same-locale', 'ko', TranslationJobStatus.RUNNING),
      createJob('running', 'ja', TranslationJobStatus.RUNNING),
    ];

    expect([...selectActiveTranslationJobsByLocale(jobs).entries()].map(([locale, job]) => [locale, job.id])).toEqual([
      ['ko', 'queued'],
      ['ja', 'running'],
    ]);
  });
});
