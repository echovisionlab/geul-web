// @vitest-environment jsdom

import { useEffect } from 'react';
import { expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { ReactQueryProvider } from '@/lib/providers/ReactQueryProvider';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { useEditorAccessLevel } from './useEditorAccessLevel';
import { useActiveEditLocale } from '@/features/translation/useActiveEditLocale';

const api = vi.hoisted(() => ({
  entries: vi.fn(),
  detail: vi.fn(),
  locales: vi.fn(async () => ({
    locales: [
      { code: 'en', enabled: true },
      { code: 'ko', enabled: true },
    ],
  })),
}));
vi.mock('@/lib/api/browser/secure-translation', () => ({
  createTranslationClient: () => ({
    listEntityTranslations: api.entries,
    getEntityTranslation: api.detail,
    listTranslationLocales: api.locales,
  }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/admin/posts/query-access-test',
  useSearchParams: () => new URLSearchParams('lang=ko'),
}));

it('refetches locale edit permissions on access invalidation despite the query freshness window', async () => {
  const provider = {};
  let mounts = 0;
  let latest: ReturnType<typeof useActiveEditLocale>;
  api.entries.mockResolvedValue({ sourceLocale: 'en', entries: [] });
  api.detail.mockResolvedValue({ entry: { locale: 'ko', title: 'Editable translation' } });
  function Surface() {
    const access = useEditorAccessLevel(provider);
    latest = useActiveEditLocale({
      entityType: 'post',
      entityId: 'query-access-test',
      sourceTitle: 'Source',
      sourceSummary: '',
      initialSourceLocale: 'en',
      initialRequestedLocale: 'ko',
    });
    useEffect(() => {
      mounts += 1;
    }, []);
    return <input aria-label="Locale title" disabled={access === 'view' || !latest.canEditActiveLocale} />;
  }
  setProviderAccessLevel(provider, 'view');
  render(
    <ReactQueryProvider>
      <Surface />
    </ReactQueryProvider>,
  );
  await waitFor(() => expect(latest!.isLoading).toBe(false));
  const input = screen.getByRole('textbox', { name: 'Locale title' });
  expect(input).toBeDisabled();
  expect(latest!.canEditActiveLocale).toBe(false);
  const reads = api.entries.mock.calls.length;
  api.entries.mockResolvedValue({ sourceLocale: 'en', entries: [{ locale: 'ko', title: 'Editable translation' }] });
  await act(async () => setProviderAccessLevel(provider, 'edit'));
  await waitFor(() => expect(input).toBeEnabled());
  expect(api.entries.mock.calls.length).toBeGreaterThan(reads);
  expect(latest!.canEditActiveLocale).toBe(true);
  act(() => setProviderAccessLevel(provider, 'view'));
  expect(input).toBeDisabled();
  expect(screen.getByRole('textbox', { name: 'Locale title' })).toBe(input);
  expect(mounts).toBe(1);
});
