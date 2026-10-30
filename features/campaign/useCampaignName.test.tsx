// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@/test/render';
import { updateCampaignNameAction } from '@/lib/actions/campaign';
import { DEFAULT_CAMPAIGN_FIELDS } from '@/lib/collab/schemas/campaign-fields.schema';
import { useAuthoritativeConfiguration } from '@/lib/editor/useAuthoritativeConfiguration';
import { useCampaignName } from './useCampaignName';

vi.mock('@/lib/actions/campaign', () => ({ updateCampaignNameAction: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

describe('campaign name persistence', () => {
  it('preserves a newer draft through peer metadata and an older name acknowledgement', async () => {
    vi.useFakeTimers();
    const first = deferred<{ ok: true; name: string; changed: boolean }>();
    const second = deferred<{ ok: true; name: string; changed: boolean }>();
    vi.mocked(updateCampaignNameAction)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result, unmount } = renderHook(
      () => {
        const configuration = useAuthoritativeConfiguration({
          document: 'campaign:name-test',
          initialConfiguration: { ...DEFAULT_CAMPAIGN_FIELDS, name: 'Campaign' },
        });
        const name = useCampaignName({
          campaignId: 'name-test',
          configuration,
          editable: true,
          refetchConfiguration: async () => undefined,
        });
        return { ...name, configuration };
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );
    try {
      act(() => result.current.changeName('First draft'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      act(() => {
        result.current.changeName('Second draft');
        result.current.configuration.adoptRead(result.current.configuration.beginRead(), { name: 'Peer name' });
      });
      expect(result.current.name).toBe('Second draft');

      await act(async () => {
        first.resolve({ ok: true, name: 'Canonical first', changed: true });
        await first.promise;
      });
      expect(result.current.name).toBe('Second draft');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      await act(async () => {
        second.resolve({ ok: true, name: 'Canonical second', changed: true });
        await second.promise;
      });

      expect(result.current.name).toBe('Canonical second');
      expect(updateCampaignNameAction).toHaveBeenNthCalledWith(1, 'name-test', 'First draft', expect.any(String));
      expect(updateCampaignNameAction).toHaveBeenNthCalledWith(2, 'name-test', 'Second draft', expect.any(String));
    } finally {
      unmount();
      queryClient.clear();
    }
  });
});
