// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { act, render, screen, waitFor } from '@/test/render';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
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

function settingsTree(client: QueryClient, props: Partial<ComponentProps<typeof FormSettingsContent>> = {}) {
  return (
    <QueryClientProvider client={client}>
      <FormSettingsContent {...settingsProps} {...props} />
      <FormTranslationsPanel formId="form-1" />
    </QueryClientProvider>
  );
}
it('upgrades and downgrades mounted form settings and translation controls', () => {
  const client = new QueryClient();
  setProviderAccessLevel(mocks.provider, 'view');
  mocks.updateFromTitle.mockClear();
  const view = render(settingsTree(client));
  const slug = screen.getByRole('textbox', { name: 'Slug' });
  const translation = screen.getByRole('textbox', { name: 'Translation' });
  const settings = screen.getAllByRole('switch');
  expect(settings.length).toBeGreaterThan(0);
  expect(slug).toBeDisabled();
  settings.forEach((input) => expect(input).toBeDisabled());
  expect(translation).toBeDisabled();
  expect(mocks.updateFromTitle).not.toHaveBeenCalled();
  act(() => setProviderAccessLevel(mocks.provider, 'edit'));
  expect(slug).not.toBeDisabled();
  settings.forEach((input) => expect(input).not.toBeDisabled());
  expect(translation).not.toBeDisabled();
  expect(mocks.translations.mock.lastCall?.[0].canAdministerTranslations).toBe(true);
  expect(mocks.updateFromTitle).toHaveBeenCalled();
  act(() => setProviderAccessLevel(mocks.provider, 'view'));
  expect(slug).toBeDisabled();
  settings.forEach((input) => expect(input).toBeDisabled());
  expect(translation).toBeDisabled();
  expect(screen.getByRole('textbox', { name: 'Slug' })).toBe(slug);
  expect(screen.getByRole('textbox', { name: 'Translation' })).toBe(translation);
  view.unmount();
  client.clear();
});
it('routes source title edits through the shared slug hook instead of saving the slug directly', () => {
  const client = new QueryClient();
  const update = vi.fn();
  setProviderAccessLevel(mocks.provider, 'edit');
  mocks.updateFromTitle.mockClear();
  mocks.title = 'Form';
  const view = render(settingsTree(client, { bindings: { update } }));
  expect(mocks.updateFromTitle).toHaveBeenLastCalledWith('Form');
  mocks.title = 'Renamed form';
  view.rerender(settingsTree(client, { bindings: { update } }));
  expect(mocks.updateFromTitle).toHaveBeenLastCalledWith('Renamed form');
  expect(update).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
  mocks.title = 'Form';
});
it('serializes settings writes and shows synchronization until every queued write completes', async () => {
  const first = Promise.withResolvers<{}>();
  const second = Promise.withResolvers<{}>();
  const update = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  setProviderAccessLevel(mocks.provider, 'edit');
  const view = render(settingsTree(client, { bindings: { update } }));
  await view.user.click(screen.getByRole('switch', { name: 'Allow public URL access' }));
  await view.user.click(screen.getByRole('switch', { name: 'Require Authentication' }));
  expect(update).toHaveBeenCalledOnce();
  expect(screen.getByRole('group', { name: 'Access Control' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByText('Syncing...')).toBeInTheDocument();
  await act(async () => first.resolve({}));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  expect(update).toHaveBeenNthCalledWith(1, 'form-1', { isPublic: false });
  expect(update).toHaveBeenNthCalledWith(2, 'form-1', { requireAuth: true });
  expect(screen.getByRole('group', { name: 'Access Control' })).toHaveAttribute('aria-busy', 'true');
  await act(async () => second.resolve({}));
  await waitFor(() =>
    expect(screen.getByRole('group', { name: 'Access Control' })).toHaveAttribute('aria-busy', 'false'),
  );
  expect(screen.getByText('Synced')).toBeInTheDocument();
  view.unmount();
  client.clear();
});
it.each(['result', 'rejection'] as const)(
  'keeps an unsaved field failure after another queued field succeeds (%s)',
  async (failure) => {
    const first = Promise.withResolvers<{ error?: string }>();
    const second = Promise.withResolvers<{}>();
    const update = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValue({});
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    setProviderAccessLevel(mocks.provider, 'edit');
    const view = render(settingsTree(client, { bindings: { update } }));
    await view.user.click(screen.getByRole('switch', { name: 'Allow public URL access' }));
    await view.user.click(screen.getByRole('switch', { name: 'Require Authentication' }));
    await act(async () => {
      if (failure === 'result') {
        first.resolve({ error: 'Public access was not saved' });
      } else {
        first.reject(new Error('Public access was not saved'));
      }
    });
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    await act(async () => second.resolve({}));
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Access Control' })).toHaveAttribute('aria-busy', 'false'),
    );
    expect(screen.getByRole('switch', { name: 'Allow public URL access' })).not.toBeChecked();
    expect(screen.getByRole('alert')).toHaveTextContent('Public access was not saved');
    expect(screen.queryByText('Synced')).not.toBeInTheDocument();
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    await view.user.click(screen.getByRole('switch', { name: 'Require Authentication' }));
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Access Control' })).toHaveAttribute('aria-busy', 'false'),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Public access was not saved');
    expect(screen.queryByText('Synced')).not.toBeInTheDocument();
    await view.user.click(screen.getByRole('switch', { name: 'Allow public URL access' }));
    expect(await screen.findByText('Synced')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    view.unmount();
    client.clear();
  },
);
it.each([false, true])(
  'preserves save failure feedback and ignores an old target completion (changed: %s)',
  async (changed) => {
    const pending = Promise.withResolvers<{ error: string }>();
    const update = vi.fn().mockReturnValue(pending.promise);
    const client = new QueryClient();
    setProviderAccessLevel(mocks.provider, 'edit');
    const view = render(settingsTree(client, { bindings: { update } }));
    await view.user.click(screen.getByRole('switch', { name: 'Allow public URL access' }));
    if (changed) {
      view.rerender(settingsTree(client, { formId: 'form-2', bindings: { update } }));
    }
    await act(async () => pending.resolve({ error: 'Old save failed' }));
    if (changed) {
      expect(screen.queryByText('Old save failed')).not.toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Allow public URL access' })).toBeChecked();
    } else {
      expect(await screen.findByRole('alert')).toHaveTextContent('Old save failed');
      expect(screen.getByRole('switch', { name: 'Allow public URL access' })).not.toBeChecked();
    }
    view.unmount();
    client.clear();
  },
);
