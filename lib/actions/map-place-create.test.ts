import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMapPlaceClient } from '@/lib/api/server-client';
import { createMapPlaceAction } from './map-place-create';

const createMapPlaceMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createMapPlaceClient: vi.fn(),
}));

beforeEach(() => {
  createMapPlaceMock.mockReset();
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(createMapPlaceClient).mockResolvedValue({
    createMapPlace: createMapPlaceMock,
  } as unknown as Awaited<ReturnType<typeof createMapPlaceClient>>);
});

describe('createMapPlaceAction', () => {
  it('forwards Google place IDs when creating a map place', async () => {
    createMapPlaceMock.mockResolvedValue({ id: 'place-1' });

    await expect(
      createMapPlaceAction({
        name: 'Polarfront Lab',
        address: 'Seoul',
        lat: 37.539639,
        lng: 126.9904063,
        google_place_id: 'google-place-1',
      }),
    ).resolves.toEqual({ data: { id: 'place-1' } });

    expect(createMapPlaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        googlePlaceId: 'google-place-1',
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/admin/map/places');
  });
});
