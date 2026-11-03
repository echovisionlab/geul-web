// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { act, render, screen } from '@/test/render';
import enMessages from '@/messages/en.json';
import { ClientDetailPageView } from './ClientDetailPageView';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'client' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/actions/client', () => ({ createClientAction: vi.fn(), updateClientAction: vi.fn() }));
vi.mock('@/lib/queries/client-browser', () => ({ getClient: vi.fn() }));

it.each(['missing', 'failed'] as const)('does not open an empty edit form after a %s read', async (state) => {
  let resolve!: (value: null) => void;
  let reject!: (error: unknown) => void;
  const pending = new Promise<null>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ClientDetailPageView clientId="client" readAction={() => pending} />
    </QueryClientProvider>,
  );
  expect(screen.getByRole('status')).toHaveTextContent(enMessages.common.states.loading);
  await act(async () => {
    if (state === 'missing') {
      resolve(null);
    } else {
      reject(new Error('Unavailable'));
    }
  });
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  client.clear();
});
