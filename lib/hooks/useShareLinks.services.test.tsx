// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@/test/render';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { ShareLinkItemSchema, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShareLinks, type ShareLinkServices } from './useShareLinks';
let client: QueryClient;
function setup(services: ShareLinkServices) {
  client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
  return renderHook(() => useShareLinks({ entityType: 'form-dashboard', entityId: 'form-1', services }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}
afterEach(() => client?.clear());
describe('share links local service binding', () => {
  it('reads, creates and removes through the same controller with inherited queries disabled', async () => {
    let rows = [
      create(ShareLinkItemSchema, {
        id: 'one',
        label: 'Review',
        token: 'local-one',
        url: 'https://example.com/s/local-one',
        expiresAt: timestampFromDate(new Date('2030-01-01T00:00:00Z')),
      }),
    ];
    const services: ShareLinkServices = {
      list: vi.fn(async () => rows),
      create: vi.fn(async (_type, _id, options) => {
        rows = [
          ...rows,
          create(ShareLinkItemSchema, {
            id: 'two',
            label: options?.label,
            token: 'local-two',
            url: 'https://example.com/s/local-two',
            expiresAt: timestampFromDate(new Date('2030-01-01T00:00:00Z')),
          }),
        ];
      }),
      remove: vi.fn(async (_type, _id, id) => {
        rows = rows.filter((row) => row.id !== id);
      }),
    };
    const { result } = setup(services);
    await waitFor(() => expect(result.current.shareLinks.map((link) => link.label)).toEqual(['Review']));
    expect(services.list).toHaveBeenCalledWith('form-dashboard', 'form-1');
    await act(async () => {
      await result.current.create({ label: 'Archive' });
    });
    await waitFor(() => expect(result.current.shareLinks.map((link) => link.label)).toEqual(['Review', 'Archive']));
    expect(services.create).toHaveBeenCalledWith('form-dashboard', 'form-1', { label: 'Archive' });
    await act(async () => {
      await result.current.remove('one');
    });
    await waitFor(() => expect(result.current.shareLinks.map((link) => link.label)).toEqual(['Archive']));
    expect(services.remove).toHaveBeenCalledWith('form-dashboard', 'form-1', 'one');
  });
});

it('exposes query failure and keeps refetch pending until the retry finishes', async () => {
  const failure = new Error('Unavailable');
  const retry = Promise.withResolvers<ShareLinkItem[]>();
  const services: ShareLinkServices = {
    list: vi.fn().mockRejectedValueOnce(failure).mockReturnValueOnce(retry.promise),
    create: vi.fn(),
    remove: vi.fn(),
  };
  const { result } = setup(services);
  await waitFor(() => expect(result.current.error).toBe(failure));
  expect(result.current.isFetching).toBe(false);
  let completion!: Promise<unknown>;
  act(() => {
    completion = result.current.refetch();
  });
  expect(completion).toBeInstanceOf(Promise);
  await waitFor(() => expect(result.current.isFetching).toBe(true));
  await act(async () => {
    retry.resolve([]);
    await completion;
  });
  await waitFor(() => expect(result.current.isFetching).toBe(false));
  expect(result.current.error).toBeNull();
});
