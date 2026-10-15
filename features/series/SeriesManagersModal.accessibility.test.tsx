// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { SeriesManagersModal, type SeriesManagerBindings } from './SeriesManagersModal';
vi.mock('@/lib/actions/series', () => ({ addSeriesManagerAction: vi.fn(), removeSeriesManagerAction: vi.fn() }));
vi.mock('@/lib/queries/series-browser', () => ({
  listSeriesManagers: vi.fn(),
  searchSeriesManagerCandidates: vi.fn(),
}));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));
let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
afterEach(() => {
  act(() => root?.unmount());
  client?.clear();
  host?.remove();
});
describe('series manager local service interaction', () => {
  it('describes repeated remove targets and moves focus to member search after deletion', async () => {
    let managers = [{ memberId: 'june', nickname: 'June Han', avatarUrl: undefined, createdAt: undefined }];
    const bindings: SeriesManagerBindings = {
      list: async () => managers,
      search: async () => [],
      add: async () => ({ success: true }),
      remove: async (_series, id) => {
        managers = managers.filter((manager) => manager.memberId !== id);
        return { success: true };
      },
    };
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    await act(async () =>
      root.render(
        <TestProviders>
          <QueryClientProvider client={client}>
            <SeriesManagersModal seriesId="series" opened onClose={() => {}} canManageManagers bindings={bindings} />
          </QueryClientProvider>
        </TestProviders>,
      ),
    );
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toHaveAccessibleName('Managers (1)'));
    const remove = document.querySelector<HTMLButtonElement>('button[aria-label="Remove"]')!;
    expect(remove).toHaveAccessibleDescription('June Han');
    expect(document.querySelector('[role="list"]')).toHaveAccessibleName('Managers (1)');
    await act(async () => {
      remove.focus();
      remove.click();
    });
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toHaveAccessibleName('Managers (0)'));
    expect(document.querySelector('input[role="combobox"]')).toHaveAccessibleName('Search by name...');
    expect(document.querySelector('input[role="combobox"]')).toHaveFocus();
  });
});
