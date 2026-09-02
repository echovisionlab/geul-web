// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesManagersModal } from './SeriesManagersModal';

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  list: vi.fn(),
  notification: vi.fn(),
  remove: vi.fn(),
  search: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    namespace === 'seriesMembers' && key === 'title' ? 'Managers' : key,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notification },
}));

vi.mock('@/lib/actions/series', () => ({
  addSeriesManagerAction: mocks.add,
  removeSeriesManagerAction: mocks.remove,
}));

vi.mock('@/lib/queries/series-browser', () => ({
  listSeriesManagers: mocks.list,
  searchSeriesManagerCandidates: mocks.search,
}));

let container: HTMLDivElement;
let root: Root;

async function renderModal(canManageManagers: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider env="test">
          <SeriesManagersModal seriesId="series-1" opened onClose={vi.fn()} canManageManagers={canManageManagers} />
        </MantineProvider>
      </QueryClientProvider>,
    );
  });
}

describe('SeriesManagersModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([{ memberId: 'member-1', nickname: 'Onboarded member', avatarUrl: null }]);
    mocks.search.mockResolvedValue([]);
    mocks.add.mockResolvedValue({ success: true });
    mocks.remove.mockResolvedValue({ error: 'raw permission detail' });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('presents Series authorities as managers and does not expose controls to a read-only manager', async () => {
    await renderModal(false);

    await vi.waitFor(() => expect(document.body.textContent).toContain('Onboarded member'));
    expect(document.body.textContent).toContain('Managers');
    expect(document.querySelector('[aria-label="remove"]')).toBeNull();
    expect(document.querySelector('input')).toBeNull();
  });

  it('uses localized feedback instead of a raw server error when manager removal fails', async () => {
    await renderModal(true);
    await vi.waitFor(() => expect(document.querySelector('[aria-label="remove"]')).not.toBeNull());

    act(() => document.querySelector<HTMLButtonElement>('[aria-label="remove"]')?.click());

    await vi.waitFor(() =>
      expect(mocks.notification).toHaveBeenCalledWith({
        message: 'notifications.removeFailed',
        color: 'red',
      }),
    );
    expect(mocks.notification).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'raw permission detail' }));
  });

  it('shows a localized error instead of treating a manager lookup failure as zero managers', async () => {
    mocks.list.mockRejectedValue(new Error('private RPC detail'));

    await renderModal(true);

    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('states.loadFailed'));
    expect(document.body.textContent).not.toContain('Onboarded member');
    expect(document.querySelector('input')).toBeNull();
  });
});
