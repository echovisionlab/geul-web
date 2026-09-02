// @vitest-environment jsdom

import { act } from 'react';
import { create } from '@bufbuild/protobuf';
import {
  TranslationJobSchema,
  TranslationJobStatus,
  type TranslationJob,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranslationLifecycleRefetchHint } from '@/lib/translation/lifecycle';
import {
  selectActiveTranslationJobsByLocale,
  useActiveTranslationJobsByLocale,
} from './useActiveTranslationJobsByLocale';

let lifecycleHandler: ((hint: TranslationLifecycleRefetchHint) => Promise<void> | void) | null = null;
let lifecycleReconnectHandler: (() => Promise<void> | void) | null = null;

vi.mock('@/features/translation/useTranslationLifecycleSubscription', () => ({
  useTranslationLifecycleSubscription: (input: {
    onEvent?: (hint: TranslationLifecycleRefetchHint) => Promise<void> | void;
    onReconnect?: () => Promise<void> | void;
  }) => {
    lifecycleHandler = input.onEvent ?? null;
    lifecycleReconnectHandler = input.onReconnect ?? null;
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let activeJobsByLocale = new Map<string, TranslationJob>();

function createJob(id: string, targetLocale: string, status: TranslationJobStatus): TranslationJob {
  return create(TranslationJobSchema, { id, targetLocale, status });
}

function TestHarness({
  jobs,
  onLifecycleHint,
  onReconnect,
}: {
  jobs: TranslationJob[];
  onLifecycleHint?: (hint: TranslationLifecycleRefetchHint) => Promise<void> | void;
  onReconnect?: () => Promise<void> | void;
}) {
  activeJobsByLocale = useActiveTranslationJobsByLocale({
    entityType: 'work',
    entityId: 'work-1',
    jobs,
    onLifecycleHint,
    onReconnect,
  });
  return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  activeJobsByLocale = new Map();
  lifecycleHandler = null;
  lifecycleReconnectHandler = null;
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

  it('uses lifecycle events only to request authoritative refetches', async () => {
    const onLifecycleHint = vi.fn(async () => undefined);
    const onReconnect = vi.fn(async () => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestHarness
          jobs={[createJob('queued', 'ko', TranslationJobStatus.QUEUED)]}
          onLifecycleHint={onLifecycleHint}
          onReconnect={onReconnect}
        />,
      );
    });

    const hint: TranslationLifecycleRefetchHint = {
      jobId: 'queued',
      entityType: 'work',
      entityId: 'work-1',
      targetLocale: 'ko',
      timestampMs: 1,
    };
    await act(async () => lifecycleHandler?.(hint));

    expect(onLifecycleHint).toHaveBeenCalledWith(hint);
    expect(activeJobsByLocale.get('ko')?.status).toBe(TranslationJobStatus.QUEUED);

    await act(async () => lifecycleReconnectHandler?.());
    expect(onReconnect).toHaveBeenCalledOnce();
  });
});
