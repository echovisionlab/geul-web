// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { ShareLinkItemSchema } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShareLinks, type ShareLinkServices } from './useShareLinks';
let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
let controller: ReturnType<typeof useShareLinks<'form-dashboard'>>;
function Probe({ services }: { services: ShareLinkServices }) {
  controller = useShareLinks({ entityType: 'form-dashboard', entityId: 'form-1', services });
  return <output>{controller.shareLinks.map((link) => link.label).join(', ')}</output>;
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  client?.clear();
});
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
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <Probe services={services} />
        </QueryClientProvider>,
      ),
    );
    await act(async () => {
      await vi.waitFor(() => expect(host.textContent).toBe('Review'));
    });
    expect(services.list).toHaveBeenCalledWith('form-dashboard', 'form-1');
    await act(async () => {
      await controller.create({ label: 'Archive' });
    });
    await act(async () => {
      await vi.waitFor(() => expect(host.textContent).toBe('Review, Archive'));
    });
    expect(services.create).toHaveBeenCalledWith('form-dashboard', 'form-1', { label: 'Archive' });
    await act(async () => {
      await controller.remove('one');
    });
    await act(async () => {
      await vi.waitFor(() => expect(host.textContent).toBe('Archive'));
    });
    expect(services.remove).toHaveBeenCalledWith('form-dashboard', 'form-1', 'one');
  });
});
