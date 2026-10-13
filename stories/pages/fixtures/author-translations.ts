import { createClient, createRouterTransport, ConnectError, Code } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import type { QueryClient } from '@tanstack/react-query';
import * as proto from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import type { TranslationServices } from '@/features/translation/TranslationServicesContext';

export type AuthorTranslationState =
  'ready' | 'loading' | 'load-error' | 'request-error' | 'queued' | 'running' | 'completed' | 'generation-disabled';

/** Real Connect client/schema, routed entirely in memory. Each story owns its state. */
export function authorTranslationFixture(state: AuthorTranslationState) {
  let requestFails = state === 'request-error';
  let requestedAt = 0;
  let currentStatus =
    state === 'queued'
      ? proto.TranslationJobStatus.QUEUED
      : state === 'running'
        ? proto.TranslationJobStatus.RUNNING
        : null;
  let targetExists = state === 'completed';
  const locales = ['ko', 'en'].map((code) =>
    create(proto.TranslationLocaleSchema, {
      code,
      displayName: code === 'ko' ? '한국어' : 'English',
      enabled: true,
      isPublic: true,
      machineTranslationAllowed: true,
    }),
  );
  const entries = () =>
    create(proto.ListEntityTranslationsResponseSchema, {
      sourceLocale: 'ko',
      entries: [
        create(proto.TranslationEntrySchema, { locale: 'ko', title: '밤의 기록' }),
        ...(targetExists
          ? [
              create(proto.TranslationEntrySchema, {
                locale: 'en',
                title: 'Night notes',
                contentText: 'Translated editorial draft.',
                updatedAt: timestampFromDate(new Date('2026-10-11T00:00:00Z')),
              }),
            ]
          : []),
      ],
    });
  const jobs = () => {
    if (requestedAt && state !== 'queued' && state !== 'running') {
      const elapsed = Date.now() - requestedAt;
      currentStatus =
        elapsed < 1500 ? proto.TranslationJobStatus.QUEUED : elapsed < 3500 ? proto.TranslationJobStatus.RUNNING : null;
      if (!currentStatus) {
        targetExists = true;
      }
    }
    return create(proto.ListTranslationJobsResponseSchema, {
      jobs: currentStatus
        ? [
            create(proto.TranslationJobSchema, {
              id: 'author-translation-en',
              target: { entityType: proto.TranslationEntityType.POST, entityId: 'local-post' },
              sourceLocale: 'ko',
              targetLocale: 'en',
              status: currentStatus,
            }),
          ]
        : [],
    });
  };
  async function read<T>(value: T): Promise<T> {
    if (state === 'loading') {
      return new Promise(() => {});
    }
    if (state === 'load-error') {
      throw new ConnectError('Fixture translation load failed', Code.Unavailable);
    }
    return value;
  }
  const client = createClient(
    proto.TranslationService,
    createRouterTransport((router) =>
      router.service(proto.TranslationService, {
        listTranslationLocales: () => read({ locales }),
        listEntityTranslations: () => read(entries()),
        listTranslationJobs: () => read(jobs()),
        getTranslationSettings: () => read({ generationEnabled: state !== 'generation-disabled' }),
        regenerateEntityTranslations: () => {
          if (requestFails) {
            requestFails = false;
            throw new ConnectError('Fixture translation request failed', Code.Unavailable);
          }
          requestedAt = Date.now();
          currentStatus = proto.TranslationJobStatus.QUEUED;
          return {};
        },
        cancelTranslationJob: () => {
          requestedAt = 0;
          currentStatus = null;
          return {};
        },
        setEntitySourceLocale: () => {
          throw new ConnectError('Changing the fixture source language is unavailable', Code.FailedPrecondition);
        },
      }),
    ),
  );
  const services: Omit<TranslationServices, 'openLocale'> = {
    client,
    mutateTarget: async ({ action }) => {
      targetExists = action === 'create';
      return {
        documentRevision: 'local-document-revision',
        configurationRevision: 'local-configuration-revision',
        localeRevision: 'local-locale-revision',
        localeExists: targetExists,
      };
    },
  };
  function seed(queryClient: QueryClient) {
    const keys = [
      ['translation-locales'],
      ['entity-translations', 'post', 'local-post'],
      ['entity-translation-jobs', 'post', 'local-post', 'all'],
      ['translation-settings'],
    ];
    for (const queryKey of keys) {
      queryClient.removeQueries({ queryKey, exact: true });
      queryClient.setQueryDefaults(queryKey, { staleTime: 0, refetchOnMount: 'always', retry: false });
    }
  }
  return { services, seed };
}
