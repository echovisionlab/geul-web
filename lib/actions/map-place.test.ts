import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMapPlaceClient,
  createPublicMapPlaceClient,
  createPublicMapPlaceClientWithAuth,
} from '@/lib/api/server-client';
import {
  getMapPlaceAction,
  getMapPlacesByIdsAction,
  getPublicMapPlacesByIdsAction,
  listMapPlacesAdminAction,
  updateMapPlaceAction,
} from './map-place';

const listMapPlacesAdminMock = vi.fn();
const getMapPlaceMock = vi.fn();
const updateMapPlaceMock = vi.fn();
const getMapPlacesByIdsMock = vi.fn();
const publicGetByIdsMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createMapPlaceClient: vi.fn(),
  createPublicMapPlaceClient: vi.fn(),
  createPublicMapPlaceClientWithAuth: vi.fn(),
}));

function mapPlaceResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'place-1',
    name: 'Polarfront Lab',
    address: 'Seoul',
    lat: 37.539639,
    lng: 126.9904063,
    googlePlaceId: 'google-place-1',
    addressComponents: undefined,
    imageFileId: undefined,
    imageUrl: undefined,
    createdBy: undefined,
    updatedBy: undefined,
    createdByUser: undefined,
    updatedByUser: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  listMapPlacesAdminMock.mockReset();
  getMapPlaceMock.mockReset();
  updateMapPlaceMock.mockReset();
  getMapPlacesByIdsMock.mockReset();
  publicGetByIdsMock.mockReset();
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(createMapPlaceClient).mockResolvedValue({
    listMapPlacesAdmin: listMapPlacesAdminMock,
    getMapPlace: getMapPlaceMock,
    updateMapPlace: updateMapPlaceMock,
    getMapPlacesByIds: getMapPlacesByIdsMock,
  } as unknown as Awaited<ReturnType<typeof createMapPlaceClient>>);
  vi.mocked(createPublicMapPlaceClient).mockReturnValue({
    getByIds: publicGetByIdsMock,
  } as unknown as ReturnType<typeof createPublicMapPlaceClient>);
  vi.mocked(createPublicMapPlaceClientWithAuth).mockResolvedValue({
    getByIds: publicGetByIdsMock,
  } as unknown as Awaited<ReturnType<typeof createPublicMapPlaceClientWithAuth>>);
});

describe('map place actions', () => {
  it('maps Google place IDs from the admin list response', async () => {
    listMapPlacesAdminMock.mockResolvedValue({
      places: [mapPlaceResponse()],
      pagination: { total: 1 },
    });

    await expect(listMapPlacesAdminAction({ page: 1, pageSize: 10 })).resolves.toMatchObject({
      data: [{ id: 'place-1', google_place_id: 'google-place-1' }],
      total: 1,
    });
  });

  it('maps Google place IDs from the admin detail response', async () => {
    getMapPlaceMock.mockResolvedValue(mapPlaceResponse());

    await expect(getMapPlaceAction('place-1')).resolves.toMatchObject({
      id: 'place-1',
      googlePlaceId: 'google-place-1',
    });
  });

  it('forwards Google place IDs and explicit clears on update', async () => {
    updateMapPlaceMock.mockResolvedValue({});

    await expect(updateMapPlaceAction('place-1', { google_place_id: 'google-place-1' })).resolves.toEqual({
      success: true,
    });
    await expect(updateMapPlaceAction('place-1', { google_place_id: null })).resolves.toEqual({
      success: true,
    });

    expect(updateMapPlaceMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'place-1', googlePlaceId: 'google-place-1' }),
    );
    expect(updateMapPlaceMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'place-1', googlePlaceId: '' }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/admin/map/places');
  });

  it('maps Google place IDs for selected admin map places', async () => {
    getMapPlacesByIdsMock.mockResolvedValue({ places: [mapPlaceResponse()] });

    await expect(getMapPlacesByIdsAction(['place-1'])).resolves.toEqual([
      expect.objectContaining({ id: 'place-1', googlePlaceId: 'google-place-1' }),
    ]);
  });

  it('maps Google place IDs for public selected map places', async () => {
    publicGetByIdsMock.mockResolvedValue({ places: [mapPlaceResponse()] });

    await expect(getPublicMapPlacesByIdsAction(['place-1'], 'ko')).resolves.toEqual([
      expect.objectContaining({ id: 'place-1', googlePlaceId: 'google-place-1' }),
    ]);
    expect(createPublicMapPlaceClientWithAuth).toHaveBeenCalledWith('ko');
  });
});
