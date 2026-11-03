// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { act, render, screen, within, waitFor } from '@/test/render';
import { PlacesManageModal } from './PlacesManageModal';

vi.mock('@vis.gl/react-google-maps', () => ({ useMapsLibrary: () => null }));
vi.mock('@/features/map/MapProvider', () => ({ MapProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/map/BaseMap', () => ({ BaseMap: () => null }));
vi.mock('@/lib/api/map-place-browser-client', () => ({
  createMapPlaceBrowserClient: () => ({ searchMapPlaces: async () => ({ places: [] }) }),
}));

it('keeps creation pending and retains its draft after failure, closing only after confirmed success', async () => {
  let finish!: (success: boolean) => void;
  const onCreatePlace = vi
    .fn()
    .mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValueOnce(true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { user } = render(
    <QueryClientProvider client={client}>
      <PlacesManageModal
        opened
        onClose={vi.fn()}
        places={[]}
        center={{ lat: 1, lng: 2 }}
        onAddPlace={vi.fn()}
        onRemovePlace={vi.fn()}
        onCenterOnPlace={vi.fn()}
        onCreatePlace={onCreatePlace}
      />
    </QueryClientProvider>,
  );
  const search = screen.getByRole('combobox');
  await user.click(search);
  await user.paste('New place');
  await user.click(await screen.findByRole('option', { name: /Create.*New place/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Create New Place' });
  await user.click(within(dialog).getByRole('textbox', { name: 'Address' }));
  await user.paste('Address');
  const submit = within(dialog).getByRole('button', { name: 'Create & Add' });
  await user.click(submit);
  expect(submit).toHaveAttribute('aria-busy', 'true');
  expect(dialog).toBeVisible();
  await user.click(submit);
  expect(onCreatePlace).toHaveBeenCalledOnce();
  await act(async () => finish(false));
  await waitFor(() => expect(submit).not.toHaveAttribute('aria-busy', 'true'));
  expect(within(dialog).getByRole('textbox', { name: 'Address' })).toHaveValue('Address');
  await user.click(submit);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create New Place' })).not.toBeInTheDocument());
  expect(onCreatePlace).toHaveBeenCalledTimes(2);
  client.clear();
});
