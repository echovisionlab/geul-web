// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { ClientDetailPageView } from '@/features/admin/client/ClientDetailPageView';
import { render, screen, waitFor } from '@/test/render';

vi.mock('next/navigation', () => ({ useParams: () => ({}), useRouter: () => ({ push: vi.fn() }) }));

const savedClient = {
  id: 'client-1',
  name: 'Client One',
  website: 'https://client.example',
  logoUrl: null,
  logoLightUrl: null,
  logoDarkUrl: null,
  createdAt: null,
};

it('forwards the website when creating a client', async () => {
  const create = vi.fn(async () => ({ ok: true as const, data: { id: 'client-1' } }));
  const client = new QueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ClientDetailPageView clientId="new" createAction={create} onNavigate={vi.fn()} />
    </QueryClientProvider>,
  );
  try {
    await view.user.type(screen.getByRole('textbox', { name: /Name/ }), 'Client One');
    await view.user.type(screen.getByRole('textbox', { name: 'Website' }), 'https://client.example');
    await view.user.click(screen.getByRole('button', { name: 'Create Client' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith('Client One', 'https://client.example'));
  } finally {
    view.unmount();
    client.clear();
  }
});

it('forwards a cleared website on update', async () => {
  const update = vi.fn(async () => ({ ok: true as const, success: true as const }));
  const client = new QueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ClientDetailPageView clientId="client-1" readAction={async () => savedClient} updateAction={update} />
    </QueryClientProvider>,
  );
  try {
    const website = await screen.findByRole('textbox', { name: 'Website' });
    await waitFor(() => expect(website).toHaveValue(savedClient.website));
    await view.user.clear(website);
    await view.user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('client-1', { name: undefined, website: null }));
  } finally {
    view.unmount();
    client.clear();
  }
});

it('keeps a dirty draft through a refreshed query and submits only the changed field', async () => {
  const update = vi.fn(async () => ({ ok: true as const, success: true as const }));
  const client = new QueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ClientDetailPageView clientId="client-1" readAction={async () => savedClient} updateAction={update} />
    </QueryClientProvider>,
  );
  try {
    const name = await screen.findByRole('textbox', { name: /Name/ });
    await waitFor(() => expect(name).toHaveValue(savedClient.name));
    await view.user.clear(name);
    await view.user.type(name, 'Local draft');
    act(() =>
      client.setQueryData(['clients', 'detail', 'client-1'], {
        ...savedClient,
        name: 'Remote name',
        website: 'https://remote.example',
      }),
    );
    expect(name).toHaveValue('Local draft');
    expect(screen.getByRole('textbox', { name: 'Website' })).toHaveValue(savedClient.website);
    await view.user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('client-1', { name: 'Local draft', website: undefined }));
  } finally {
    view.unmount();
    client.clear();
  }
});
