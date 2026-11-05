import { create } from '@bufbuild/protobuf';
import * as proto from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import type { TranslationSettingsPageClient } from '@/features/translation/admin/TranslationSettingsPage';
import type { TranslationOverviewPageClient } from '@/features/translation/admin/TranslationOverviewPage';
export type TranslationPreviewState = 'ready' | 'empty' | 'error' | 'pending' | 'save-error';
/** Typed in-memory RPC boundary. Never constructs a browser/backend transport. */
export function translationAdminFixture(state: TranslationPreviewState) {
  let settings = create(proto.TranslationSettingsSchema, { defaultLocale: 'en' });
  const locales = ['en', 'ko', 'ja'].map((code) =>
    create(proto.TranslationLocaleSchema, {
      code,
      displayName: new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code,
      enabled: true,
      isPublic: true,
    }),
  );
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
  const client: TranslationSettingsPageClient & TranslationOverviewPageClient = {
    getTranslationOverview: async () =>
      read(
        create(proto.GetTranslationOverviewResponseSchema, {
          stats: {
            totalLocales: 3,
            enabledLocales: 3,
            publicLocales: 3,
            sourceEntities: state === 'empty' ? 0 : 12,
            existingEntries: state === 'empty' ? 0 : 18,
          },
          localeHealth: state === 'empty' ? [] : locales.map((locale) => ({ locale, existingEntries: 6 })),
          entityHealth:
            state === 'empty'
              ? []
              : [{ entityType: proto.TranslationEntityType.POST, sourceEntities: 12, existingEntries: 18 }],
        }),
      ),
    getTranslationSettings: async () => read(create(proto.GetTranslationSettingsResponseSchema, { settings })),
    listTranslationLocales: async () => read(create(proto.ListTranslationLocalesResponseSchema, { locales })),
    updateTranslationSettings: async (input) => {
      write();
      const paths = input.updateMask?.paths ?? [];
      settings = create(proto.TranslationSettingsSchema, {
        ...settings,
        defaultLocale: paths.includes('default_locale')
          ? (input.settings?.defaultLocale ?? settings.defaultLocale)
          : settings.defaultLocale,
      });
      return create(proto.UpdateTranslationSettingsResponseSchema, { settings });
    },
  };
  return client;
}
