// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { TestProviders } from '@/test/TestProviders';
import { FormSettingsContent } from './FormSettingsContent';
import { FormTranslationsPanel } from './FormTranslationsPanel';

const mocks = vi.hoisted(() => ({ provider: {}, title: 'Form', updateFromTitle: vi.fn(), translations: vi.fn() }));
vi.mock('@/lib/contexts/FormEditorContext', () => ({
  useFormEditorContext: () => ({ provider: mocks.provider, fields: { title: mocks.title }, isSynced: true }),
}));
vi.mock('./FormTranslationContext', () => ({
  useFormTranslationContext: () => ({
    activeEditLocale: { activeLocale: 'en', isSourceLocale: true, canEditActiveLocale: true, hasLiveRow: true },
  }),
}));
vi.mock('@/lib/hooks/useSlugManagement', () => ({
  useSlugManagement: () => ({ updateFromTitle: mocks.updateFromTitle, handleBlur: vi.fn(), handleChange: vi.fn() }),
}));
vi.mock('@/lib/hooks/useOgImage', () => ({ useOgImage: () => ({ trackLatest: vi.fn() }) }));
vi.mock('@/lib/hooks/useOgGenerationLookupSignal', () => ({ useOgGenerationLookupSignal: vi.fn() }));
vi.mock('@/lib/hooks/useUpload', () => ({ useUpload: () => ({ upload: vi.fn() }) }));
vi.mock('@/features/metadata/OgImagePreview', () => ({ OgImagePreview: () => null }));
vi.mock('@/features/upload/ImageUploadCropController', () => ({ ImageUploadCropController: () => null }));
vi.mock('@/features/share/ShareLinkSection', () => ({ ShareLinkSection: () => null }));
vi.mock('@/features/metadata/UrlSection', () => ({
  UrlSection: ({ disabled }: { disabled: boolean }) => <input aria-label="Slug" disabled={disabled} />,
}));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({
  EntityTranslationsPanel: (props: { canAdministerTranslations: boolean; canMutateTargets: boolean }) => {
    mocks.translations(props);
    return <input aria-label="Translation" disabled={!props.canMutateTargets} />;
  },
}));

const settingsProps = {
  formId: 'form-1',
  baseUrl: 'https://example.test',
  initialSlug: 'form',
  initialIsPublic: true,
  initialOpensAt: null,
  initialClosesAt: null,
  initialMaxSubmissions: null,
  initialRequireAuth: false,
  initialAllowedRoles: [],
  initialAllowDuplicateSubmission: true,
  initialOgImageUrl: null,
  initialFeaturedImageUrl: null,
  initialHasPassword: false,
} satisfies ComponentProps<typeof FormSettingsContent>;

it('upgrades and downgrades mounted form settings and translation controls', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const client = new QueryClient();
  try {
    setProviderAccessLevel(mocks.provider, 'view');
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <TestProviders>
            <FormSettingsContent {...settingsProps} />
            <FormTranslationsPanel formId="form-1" />
          </TestProviders>
        </QueryClientProvider>,
      ),
    );
    const slug = host.querySelector<HTMLInputElement>('[aria-label="Slug"]')!;
    const translation = host.querySelector<HTMLInputElement>('[aria-label="Translation"]')!;
    const settings = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(settings.length).toBeGreaterThan(0);
    expect(slug.disabled).toBe(true);
    expect(settings.every((input) => input.disabled)).toBe(true);
    expect(translation.disabled).toBe(true);
    expect(mocks.updateFromTitle).not.toHaveBeenCalled();
    act(() => setProviderAccessLevel(mocks.provider, 'edit'));
    expect(slug.disabled).toBe(false);
    expect(settings.every((input) => !input.disabled)).toBe(true);
    expect(translation.disabled).toBe(false);
    expect(mocks.translations.mock.lastCall?.[0].canAdministerTranslations).toBe(true);
    expect(mocks.updateFromTitle).toHaveBeenCalled();
    act(() => setProviderAccessLevel(mocks.provider, 'view'));
    expect(slug.disabled).toBe(true);
    expect(settings.every((input) => input.disabled)).toBe(true);
    expect(translation.disabled).toBe(true);
    expect(host.querySelector('[aria-label="Slug"]')).toBe(slug);
    expect(host.querySelector('[aria-label="Translation"]')).toBe(translation);
  } finally {
    act(() => root.unmount());
    client.clear();
    host.remove();
  }
});

it('routes source title edits through the shared slug hook instead of saving the slug directly', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const client = new QueryClient();
  const update = vi.fn();
  const renderSettings = () =>
    root.render(
      <QueryClientProvider client={client}>
        <TestProviders>
          <FormSettingsContent {...settingsProps} bindings={{ update }} />
        </TestProviders>
      </QueryClientProvider>,
    );
  try {
    setProviderAccessLevel(mocks.provider, 'edit');
    mocks.updateFromTitle.mockClear();
    mocks.title = 'Form';
    await act(async () => renderSettings());
    expect(mocks.updateFromTitle).toHaveBeenLastCalledWith('Form');

    mocks.title = 'Renamed form';
    await act(async () => renderSettings());

    expect(mocks.updateFromTitle).toHaveBeenLastCalledWith('Renamed form');
    expect(update).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    client.clear();
    host.remove();
    mocks.title = 'Form';
  }
});
