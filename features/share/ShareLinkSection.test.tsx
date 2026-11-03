// @vitest-environment jsdom
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { ShareLinkItemSchema, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { notifications } from '@/components/core/Notification';
import { ShareLinkSection } from './ShareLinkSection';
import { ShareLinkServicesProvider, type ShareLinkServices } from './ShareLinkServicesContext';

afterEach(() => {
  notifications.clean();
  vi.restoreAllMocks();
});
it('tracks concurrent row deletions independently and ignores detached completion', async () => {
  const a = Promise.withResolvers<void>();
  const b = Promise.withResolvers<void>();
  const services: ShareLinkServices = {
    list: vi.fn().mockResolvedValue(
      ['a', 'b'].map((id) =>
        create(ShareLinkItemSchema, {
          id,
          label: id,
          url: `https://example.test/s/${id}`,
          expiresAt: timestampFromDate(new Date('2099-01-01')),
        }),
      ),
    ),
    create: vi.fn(),
    remove: vi.fn((_type, _entity, id) => (id === 'a' ? a.promise : b.promise)),
  };
  vi.spyOn(notifications, 'show');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ShareLinkServicesProvider services={services}>
        <ShareLinkSection entityType="page" entityId="page" />
      </ShareLinkServicesProvider>
    </QueryClientProvider>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Loading...');
  const remove = await screen.findAllByRole('button', { name: 'Delete share link' });
  await view.user.click(remove[0]);
  await view.user.click(remove[1]);
  expect(remove[0]).toHaveAttribute('aria-busy', 'true');
  expect(remove[1]).toHaveAttribute('aria-busy', 'true');
  await act(async () => a.resolve());
  await waitFor(() => expect(remove[0]).not.toHaveAttribute('aria-busy', 'true'));
  expect(remove[1]).toHaveAttribute('aria-busy', 'true');
  expect(services.remove).toHaveBeenCalledTimes(2);
  expect(notifications.show).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => b.resolve());
  expect(notifications.show).toHaveBeenCalledTimes(1);
  client.clear();
});

it('keeps the link form through a failed lookup and retry without showing an empty result', async () => {
  const retry = Promise.withResolvers<ShareLinkItem[]>();
  const services: ShareLinkServices = {
    list: vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockReturnValueOnce(retry.promise),
    create: vi.fn(),
    remove: vi.fn(),
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ShareLinkServicesProvider services={services}>
        <ShareLinkSection entityType="page" entityId="failed-page" />
      </ShareLinkServicesProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText('No links created')).not.toBeInTheDocument();
  await view.user.click(screen.getByRole('button', { name: 'New Link' }));
  const label = screen.getByRole('textbox', { name: 'Label (optional)' });
  await view.user.type(label, 'Review draft');
  const retryButton = screen.getByRole('button', { name: 'Try again' });
  await view.user.click(retryButton);
  expect(await screen.findByRole('status')).toHaveTextContent('Loading...');
  expect(label).toHaveValue('Review draft');
  await act(async () => retry.resolve([]));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(label).toHaveValue('Review draft');
  client.clear();
});
