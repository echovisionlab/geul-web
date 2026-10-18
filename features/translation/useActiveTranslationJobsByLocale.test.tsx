// @vitest-environment jsdom

import { act } from 'react';
import { create } from '@bufbuild/protobuf';
import {
  TranslationJobSchema,
  TranslationJobStatus,
  type TranslationJob,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranslationLifecycleRefetchHint } from '@/lib/translation/lifecycle';
import { selectActiveTranslationJobsByLocale } from './useActiveTranslationJobsByLocale';

vi.mock('@/features/translation/useTranslationLifecycleSubscription', () => ({
  useTranslationLifecycleSubscription: (_input: {
    onEvent?: (hint: TranslationLifecycleRefetchHint) => Promise<void> | void;
    onReconnect?: () => Promise<void> | void;
  }) => {},
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createJob(id: string, targetLocale: string, status: TranslationJobStatus): TranslationJob {
  return create(TranslationJobSchema, { id, targetLocale, status });
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

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
