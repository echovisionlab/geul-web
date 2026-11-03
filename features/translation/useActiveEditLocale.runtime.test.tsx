// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { Button } from '@/components/core/Button';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { registerEditorSave } from '@/lib/editor/editor-save-registry';
import { useActiveEditLocale } from './useActiveEditLocale';
import { EditorActiveLocaleControl } from './EditorActiveLocaleControl';

const api = vi.hoisted(() => ({ entries: vi.fn(), locales: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: api.replace }),
  usePathname: () => '/admin/email-layouts/layout',
  useSearchParams: () => new URLSearchParams('lang=en'),
}));
vi.mock('@/lib/api/browser/secure-translation', () => ({
  createTranslationClient: () => ({
    listTranslationLocales: api.locales,
    listEntityTranslations: api.entries,
  }),
}));
const dispose: Array<() => void> = [];
beforeEach(() => {
  vi.clearAllMocks();
  api.entries.mockResolvedValue({ sourceLocale: 'en', entries: [] });
  api.locales.mockResolvedValue({ locales: [] });
});
afterEach(() => {
  dispose.splice(0).forEach((cleanup) => cleanup());
});
function Harness({ id = 'layout' }: { id?: string }) {
  const locale = useActiveEditLocale({
    entityType: 'email_layout',
    entityId: id,
    sourceTitle: 'Layout',
    sourceSummary: '',
  });
  return (
    <>
      {locale.errorQuery ? <QueryErrorAlert queries={[locale.errorQuery]} /> : null}
      {locale.isLoading ? <p>Loading editor</p> : <input aria-label="Editor title" defaultValue="Layout" />}
      <output aria-label="Room availability">{locale.isSourceLocaleReady ? 'Ready' : 'Unresolved'}</output>
      <EditorActiveLocaleControl state={locale} />
      <Button onClick={() => locale.setActiveLocale('ko')}>Change language</Button>
    </>
  );
}
function scenario() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  dispose.push(() => client.clear());
  return {
    ...render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    ),
    client,
  };
}

it('keeps language controls pending throughout the save barrier and prevents a stale target navigation', async () => {
  let finish!: (value: boolean) => void;
  const flush = new Promise<boolean>((done) => {
    finish = done;
  });
  dispose.push(registerEditorSave('email_layout:layout', { flush: () => flush, hasPending: () => false }));
  const view = scenario();
  const change = await screen.findByRole('button', { name: 'Change language' });
  const title = await screen.findByRole('textbox', { name: 'Editor title' });
  await view.user.clear(title);
  await view.user.paste('Unsaved title');
  await view.user.click(change);
  expect(screen.getByRole('textbox', { name: 'Editor title' })).toBe(title);
  expect(title).toHaveValue('Unsaved title');
  expect(screen.getByRole('button', { name: /Switch content language/ })).toHaveAttribute('aria-busy', 'true');
  expect(api.replace).not.toHaveBeenCalled();
  view.rerender(
    <QueryClientProvider client={view.client}>
      <Harness id="other-layout" />
    </QueryClientProvider>,
  );
  await act(async () => finish(true));
  expect(api.replace).not.toHaveBeenCalled();
});

it('exposes a failed locale query instead of treating it as a resolved absent translation', async () => {
  api.entries.mockRejectedValueOnce(new Error('Unavailable'));
  const { user } = scenario();
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Change language' })).not.toHaveAttribute('aria-busy', 'true');
  const retry = screen.getByRole('button', { name: 'Try again' });
  await user.click(retry);
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

it('retains resolved room selection when a background translation refresh fails', async () => {
  const view = scenario();
  await screen.findByRole('textbox', { name: 'Editor title' });
  expect(screen.getByLabelText('Room availability')).toHaveTextContent('Ready');
  api.entries.mockRejectedValueOnce(new Error('Refresh failed'));
  await act(async () => {
    await view.client.invalidateQueries({ queryKey: ['entity-translations', 'email_layout', 'layout'] });
  });
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByLabelText('Room availability')).toHaveTextContent('Ready');
});

it('releases the pending language control and reports a refused save barrier', async () => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  dispose.push(registerEditorSave('email_layout:layout', { flush: save, hasPending: () => false }));
  const { user } = scenario();
  const title = await screen.findByRole('textbox', { name: 'Editor title' });
  const change = screen.getByRole('button', { name: 'Change language' });
  await waitFor(() => expect(change).not.toHaveAttribute('aria-busy', 'true'));
  await user.click(change);
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(change).not.toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('textbox', { name: 'Editor title' })).toBe(title);
  expect(api.replace).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() =>
    expect(api.replace).toHaveBeenCalledWith('/admin/email-layouts/layout?lang=ko', { scroll: false }),
  );
});
