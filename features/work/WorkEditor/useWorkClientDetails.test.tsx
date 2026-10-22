// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkClientDetails, type WorkClientDetails } from './useWorkClientDetails';

const acme: WorkClientDetails = { id: 'client-acme', name: 'Acme', logoUrl: null, website: null };

function renderClientDetails(
  clientIds: string[],
  readClient: (clientId: string) => Promise<WorkClientDetails | null>,
  initialClientDetails: WorkClientDetails[] = [],
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(({ ids }) => useWorkClientDetails(ids, initialClientDetails, readClient), {
    wrapper,
    initialProps: { ids: clientIds },
  });
}

async function settle() {
  for (let index = 0; index < 5; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('useWorkClientDetails', () => {
  it.each([
    { outcome: 'no longer exists', read: async () => null },
    {
      outcome: 'cannot be read',
      read: async () => {
        throw new Error('unavailable');
      },
    },
  ])('requests a client that $outcome once and shows it without details', async ({ read }) => {
    const readClient = vi.fn<(clientId: string) => Promise<WorkClientDetails | null>>(read);
    const { result } = renderClientDetails(['client-gone'], readClient);
    await waitFor(() => expect(result.current.clients[0]?.isLoading).toBe(false));
    await settle();

    expect(readClient).toHaveBeenCalledTimes(1);
    expect(result.current.clients).toEqual([{ clientId: 'client-gone', details: null, isLoading: false }]);
  });

  it('shows initial and remembered details without requesting them', async () => {
    const readClient = vi.fn(async () => null);
    const { result, rerender } = renderClientDetails(['client-acme'], readClient, [acme]);
    const beta: WorkClientDetails = { id: 'client-beta', name: 'Beta', logoUrl: null, website: null };
    act(() => {
      result.current.rememberClient(beta);
    });
    rerender({ ids: ['client-acme', 'client-beta'] });
    await settle();

    expect(readClient).not.toHaveBeenCalled();
    expect(result.current.clients.map((client) => client.details?.name)).toEqual(['Acme', 'Beta']);
  });
});
