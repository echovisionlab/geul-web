// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { TranslationSettingsPage } from '@/features/translation/admin/TranslationSettingsPage';
import { translationAdminFixture } from '@/stories/pages/fixtures/translation-admin';
import { render, screen, waitFor } from '@/test/render';

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
      settings: { defaultLocale: 'ko' },
      updateMask: { paths: ['default_locale'] },
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
