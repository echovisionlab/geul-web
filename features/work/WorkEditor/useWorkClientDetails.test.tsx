// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { render, screen, waitFor } from '@/test/render';
import { SortableClient } from './WorkClientsSection';
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

describe('useWorkClientDetails', () => {
  it.each([
    { outcome: 'no longer exists', isError: false, read: async () => null },
    {
      outcome: 'cannot be read',
      isError: true,
      read: async () => {
        throw new Error('unavailable');
      },
    },
  ])('requests a client that $outcome once and shows it without details', async ({ read, isError }) => {
    const readClient = vi.fn<(clientId: string) => Promise<WorkClientDetails | null>>(read);
    const { result } = renderClientDetails(['client-gone'], readClient);
    await waitFor(() => expect(result.current.clients[0]?.isLoading).toBe(false));

    expect(readClient).toHaveBeenCalledTimes(1);
    expect(result.current.clients).toEqual([
      { clientId: 'client-gone', details: null, isLoading: false, isError, retry: expect.any(Function) },
    ]);
  });

  it('shows initial and remembered details without requesting them', async () => {
    const readClient = vi.fn(async () => null);
    const { result, rerender } = renderClientDetails(['client-acme'], readClient, [acme]);
    const beta: WorkClientDetails = { id: 'client-beta', name: 'Beta', logoUrl: null, website: null };
    act(() => {
      result.current.rememberClient(beta);
    });
    rerender({ ids: ['client-acme', 'client-beta'] });

    expect(readClient).not.toHaveBeenCalled();
    expect(result.current.clients.map((client) => client.details?.name)).toEqual(['Acme', 'Beta']);
  });
});

it.each([
  { isError: false, message: 'Not available' },
  { isError: true, message: 'Failed to load data.' },
])('ends the client row wait with $message and keeps removal available', async ({ isError, message }) => {
  const onRetry = vi.fn();
  const onRemove = vi.fn();
  const { user } = render(
    <SortableClient
      clientId="gone"
      client={null}
      canEdit
      isLoading={false}
      isError={isError}
      onRetry={onRetry}
      onRemove={onRemove}
      reorderAriaLabel="Reorder client"
      openWebsiteAriaLabel="Website"
      removeAriaLabel="Remove client"
    />,
  );
  expect(screen.getByText(message)).toBeVisible();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  if (isError) {
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  }
  await user.click(screen.getByRole('button', { name: 'Remove client' }));
  expect(onRemove).toHaveBeenCalledWith('gone');
});
