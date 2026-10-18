// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { TranslationProviderType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import {
  TranslationSettingsPage,
  type TranslationSettingsPageClient,
} from '@/features/translation/admin/TranslationSettingsPage';
import { translationAdminFixture } from '@/stories/pages/fixtures/translation-admin';
import { render, screen, waitFor, within } from '@/test/render';

it('saves a masked locale update, refetches settings and retains input changed during the save', async () => {
  const fixture = translationAdminFixture('ready');
  const read = vi.fn(fixture.getTranslationSettings);
  let finishSave!: () => Promise<void>;
  const update = vi.fn<typeof fixture.updateTranslationSettings>(
    (input) =>
      new Promise((resolve) => {
        finishSave = async () => resolve(await fixture.updateTranslationSettings(input));
      }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TranslationSettingsPage
        client={{ ...fixture, getTranslationSettings: read, updateTranslationSettings: update }}
      />
    </QueryClientProvider>,
  );
  try {
    const locale = await screen.findByRole('combobox', { name: 'Default locale' });
    const save = screen.getByRole('button', { name: 'Save settings' });
    expect(save).toBeDisabled();
    await view.user.click(locale);
    await view.user.click(screen.getByRole('option', { name: 'Korean (KO)' }));
    await view.user.click(save);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update).toHaveBeenCalledWith({
      settings: { defaultLocale: 'ko', protectedTerms: [] },
      updateMask: { paths: ['default_locale'] },
      baseSettings: { defaultLocale: 'en', protectedTerms: ['Geul', 'Night Signals'] },
    });
    await view.user.click(locale);
    await view.user.click(screen.getByRole('option', { name: 'Japanese (JA)' }));
    await act(finishSave);
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(save).toBeEnabled());
    expect(locale).toHaveValue('Japanese (JA)');
  } finally {
    view.unmount();
    client.clear();
  }
});

function renderSettings(client: TranslationSettingsPageClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <TranslationSettingsPage client={client} />
    </QueryClientProvider>,
  );
  return {
    ...view,
    dispose: () => {
      view.unmount();
      queryClient.clear();
    },
  };
}

it('creates the named LLM provider through its credentials dialog', async () => {
  const fixture = translationAdminFixture('empty');
  const create = vi.fn(fixture.createTranslationProvider);
  const view = renderSettings({ ...fixture, createTranslationProvider: create });
  try {
    await view.user.click(await screen.findByRole('button', { name: 'Add provider' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Create translation provider' }));
    await view.user.click(dialog.getByRole('textbox', { name: 'Provider name' }));
    await view.user.paste('Primary Gemini');
    await view.user.click(dialog.getByLabelText('LLM API key'));
    await view.user.paste('gemini-secret');
    await view.user.click(dialog.getByRole('button', { name: 'Create provider' }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Primary Gemini',
        type: TranslationProviderType.LLM,
        isActive: true,
        priority: 0,
        config: expect.objectContaining({
          case: 'llmConfig',
          value: expect.objectContaining({ apiKey: 'gemini-secret', model: 'gemini-2.5-flash-lite' }),
        }),
      }),
    );
    expect(await screen.findByRole('group', { name: 'Primary Gemini' })).toBeInTheDocument();
  } finally {
    view.dispose();
  }
});

it('updates the selected DeepL provider with a blank credential to retain its stored secret', async () => {
  const fixture = translationAdminFixture('ready');
  const result = await fixture.createTranslationProvider({
    name: 'DeepL Provider',
    type: TranslationProviderType.DEEPL,
    isActive: false,
    priority: 20,
    config: { case: 'deeplConfig', value: { apiKey: 'stored-secret', apiBaseUrl: 'https://api.deepl.com' } },
  });
  const update = vi.fn(fixture.updateTranslationProvider);
  const view = renderSettings({ ...fixture, updateTranslationProvider: update });
  try {
    const group = within(await screen.findByRole('group', { name: 'DeepL Provider' }));
    await view.user.click(group.getByRole('button', { name: 'Edit provider DeepL Provider' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit translation provider' }));
    expect(dialog.getByLabelText('DeepL API key')).toHaveValue('');
    expect(dialog.getByLabelText('DeepL API key')).toHaveAccessibleDescription('Leave blank to keep the stored key.');
    await view.user.clear(dialog.getByRole('textbox', { name: 'Provider name' }));
    await view.user.paste('DeepL Updated');
    await view.user.clear(dialog.getByRole('textbox', { name: 'DeepL API base URL' }));
    await view.user.paste('https://api-free.deepl.com');
    await view.user.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.provider!.id,
        name: 'DeepL Updated',
        type: TranslationProviderType.DEEPL,
        isActive: false,
        priority: 20,
        config: expect.objectContaining({
          case: 'deeplConfig',
          value: expect.objectContaining({ apiKey: '', apiBaseUrl: 'https://api-free.deepl.com' }),
        }),
      }),
    );
    expect(await screen.findByRole('group', { name: 'DeepL Updated' })).toBeInTheDocument();
  } finally {
    view.dispose();
  }
});

it('deletes only the selected provider after its confirmation', async () => {
  const fixture = translationAdminFixture('ready');
  const result = await fixture.createTranslationProvider({
    name: 'Archive DeepL',
    type: TranslationProviderType.DEEPL,
    config: { case: 'deeplConfig', value: { apiKey: 'stored-secret' } },
  });
  const remove = vi.fn(fixture.deleteTranslationProvider);
  const view = renderSettings({ ...fixture, deleteTranslationProvider: remove });
  try {
    const group = within(await screen.findByRole('group', { name: 'Archive DeepL' }));
    await view.user.click(group.getByRole('button', { name: 'Delete provider Archive DeepL' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete translation provider' }));
    expect(dialog.getByText(/Delete Archive DeepL\?/)).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
    await view.user.click(dialog.getByRole('button', { name: 'Delete provider' }));
    await waitFor(() => expect(remove).toHaveBeenCalledExactlyOnceWith({ id: result.provider!.id }));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Archive DeepL' })).not.toBeInTheDocument());
    expect(screen.getByRole('group', { name: 'Editorial translation' })).toBeInTheDocument();
  } finally {
    view.dispose();
  }
});
