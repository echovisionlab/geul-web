import { createClient } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMapPlaceForBlockWithBrowserClient, createMapPlaceWithBrowserClient } from './map-place-browser-client';

const createMapPlaceMock = vi.fn();

vi.mock('@connectrpc/connect', async () => {
  const actual = await vi.importActual<typeof import('@connectrpc/connect')>('@connectrpc/connect');
  return {
    ...actual,
    createClient: vi.fn(),
  };
});

vi.mock('@connectrpc/connect-web', () => ({
  createConnectTransport: vi.fn(() => ({})),
}));

beforeEach(() => {
  createMapPlaceMock.mockReset();
  vi.mocked(createClient).mockReturnValue({
    createMapPlace: createMapPlaceMock,
  } as unknown as ReturnType<typeof createClient>);
});

describe('map place browser client', () => {
  it('forwards Google place IDs for normal create requests', async () => {
    createMapPlaceMock.mockResolvedValue({ id: 'place-1' });

    await expect(
      createMapPlaceWithBrowserClient({
        name: 'Polarfront Lab',
        address: 'Seoul',
        lat: 37.539639,
        lng: 126.9904063,
        google_place_id: 'google-place-1',
      }),
    ).resolves.toEqual({ data: { id: 'place-1' } });

    expect(createMapPlaceMock).toHaveBeenCalledWith(expect.objectContaining({ googlePlaceId: 'google-place-1' }));
  });

  it('forwards Google place IDs for block create requests', async () => {
    createMapPlaceMock.mockResolvedValue({ id: 'place-1', lat: 37.539639, lng: 126.9904063 });

    await expect(
      createMapPlaceForBlockWithBrowserClient({
        name: 'Polarfront Lab',
        address: 'Seoul',
        lat: 37.539639,
        lng: 126.9904063,
        google_place_id: 'google-place-1',
      }),
    ).resolves.toEqual({ id: 'place-1', lat: 37.539639, lng: 126.9904063 });

    expect(createMapPlaceMock).toHaveBeenCalledWith(expect.objectContaining({ googlePlaceId: 'google-place-1' }));
  });
});
