import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import * as proto from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import type { TranslationSettingsPageClient } from '@/features/translation/admin/TranslationSettingsPage';
import type { TranslationOverviewPageClient } from '@/features/translation/admin/TranslationOverviewPage';
import type { TranslationJobsPageClient } from '@/features/translation/admin/TranslationJobsPage';
export type TranslationPreviewState = 'ready' | 'empty' | 'error' | 'pending' | 'save-error';
/** Typed in-memory RPC boundary. Never constructs a browser/backend transport. */
export function translationAdminFixture(state: TranslationPreviewState) {
  let settings = create(proto.TranslationSettingsSchema, {
    defaultLocale: 'en',
    protectedTerms: ['Geul', 'Night Signals'],
  });
  const locales = ['en', 'ko', 'ja'].map((code) =>
    create(proto.TranslationLocaleSchema, {
      code,
      displayName: new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code,
      enabled: true,
      isPublic: true,
      machineTranslationAllowed: true,
    }),
  );
  let providers =
    state === 'empty'
      ? []
      : [
          create(proto.TranslationProviderSchema, {
            id: 'provider-local',
            name: 'Editorial translation',
            type: proto.TranslationProviderType.LLM,
            isActive: true,
            priority: 1,
            config: { case: 'llmConfig', value: { model: 'preview-model' } },
          }),
        ];
  let jobs =
    state === 'empty'
      ? []
      : [
          create(proto.TranslationJobSchema, {
            id: 'job-local',
            target: { entityType: proto.TranslationEntityType.POST, entityId: 'night-signals' },
            sourceLocale: 'en',
            targetLocale: 'ko',
            status: proto.TranslationJobStatus.RUNNING,
            requestedAt: timestampFromDate(new Date('2026-10-10T08:00:00Z')),
          }),
        ];
  let nextId = 1;
  async function read<T>(value: T): Promise<T> {
    if (state === 'pending') {
      return new Promise(() => {});
    }
    if (state === 'error') {
      throw new Error('Local preview unavailable');
    }
    return value;
  }
  function write() {
    if (state === 'save-error') {
      throw new Error('Local preview save failed');
    }
  }
  const client: TranslationSettingsPageClient & TranslationOverviewPageClient & TranslationJobsPageClient = {
    getTranslationOverview: async () =>
      read(
        create(proto.GetTranslationOverviewResponseSchema, {
          stats: {
            totalLocales: 3,
            enabledLocales: 3,
            publicLocales: 3,
            sourceEntities: state === 'empty' ? 0 : 12,
            activeJobs: jobs.length,
            existingEntries: state === 'empty' ? 0 : 18,
          },
          localeHealth:
            state === 'empty'
              ? []
              : locales.map((locale) => ({
                  locale,
                  existingEntries: 6,
                  activeJobs: locale.code === 'ko' ? jobs.length : 0,
                })),
          entityHealth:
            state === 'empty'
              ? []
              : [
                  {
                    entityType: proto.TranslationEntityType.POST,
                    sourceEntities: 12,
                    existingEntries: 18,
                    activeJobs: jobs.length,
                  },
                ],
        }),
      ),
    getTranslationSettings: async () =>
      read(
        create(proto.GetTranslationSettingsResponseSchema, {
          settings,
          generationEnabled: providers.some((p) => p.isActive),
        }),
      ),
    listTranslationLocales: async () => read(create(proto.ListTranslationLocalesResponseSchema, { locales })),
    listTranslationProviders: async () => read(create(proto.ListTranslationProvidersResponseSchema, { providers })),
    listTranslationJobs: async () => read(create(proto.ListTranslationJobsResponseSchema, { jobs })),
    cancelTranslationJob: async ({ jobId }) => {
      write();
      jobs = jobs.filter((j) => j.id !== jobId);
      return create(proto.CancelTranslationJobResponseSchema);
    },
    updateTranslationSettings: async (input) => {
      write();
      const paths = input.updateMask?.paths ?? [];
      settings = create(proto.TranslationSettingsSchema, {
        ...settings,
        defaultLocale: paths.includes('default_locale')
          ? (input.settings?.defaultLocale ?? settings.defaultLocale)
          : settings.defaultLocale,
        protectedTerms: paths.includes('protected_terms')
          ? (input.settings?.protectedTerms ?? settings.protectedTerms)
          : settings.protectedTerms,
      });
      return create(proto.UpdateTranslationSettingsResponseSchema, { settings });
    },
    createTranslationProvider: async (request) => {
      const input = create(proto.CreateTranslationProviderRequestSchema, request);
      write();
      const provider = create(proto.TranslationProviderSchema, {
        id: `provider-${nextId++}`,
        name: input.name,
        type: input.type,
        isActive: input.isActive,
        priority: input.priority,
        config: input.config,
      });
      providers = [...providers, provider];
      return create(proto.CreateTranslationProviderResponseSchema, { provider });
    },
    updateTranslationProvider: async (request) => {
      const input = create(proto.UpdateTranslationProviderRequestSchema, request);
      write();
      const current = providers.find((p) => p.id === input.id);
      if (!current) {
        throw new Error('Local provider not found');
      }
      const provider = create(proto.TranslationProviderSchema, {
        ...current,
        name: input.name ?? current.name,
        type: input.type ?? current.type,
        priority: input.priority ?? current.priority,
        isActive: input.isActive ?? current.isActive,
        config: input.config?.case ? input.config : current.config,
      });
      providers = providers.map((p) => (p.id === provider.id ? provider : p));
      return create(proto.UpdateTranslationProviderResponseSchema, { provider });
    },
    deleteTranslationProvider: async ({ id }) => {
      write();
      providers = providers.filter((p) => p.id !== id);
      return create(proto.DeleteTranslationProviderResponseSchema);
    },
  };
  return client;
}
