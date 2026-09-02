import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicClientClientWithAuth } from '@/lib/api/server-client';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import { getClientsForBlockByIdsAction, listClientsForBlockAction } from './client';

const listMock = vi.fn();
const getMock = vi.fn();

vi.mock('@/lib/api/server-client', () => ({
  createPublicClientClientWithAuth: vi.fn(),
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
  }),
}));

beforeEach(() => {
  listMock.mockReset();
  getMock.mockReset();
  vi.mocked(createPublicClientClientWithAuth).mockReset();
  vi.mocked(createPublicClientClientWithAuth).mockResolvedValue({
    get: getMock,
    list: listMock,
  } as unknown as Awaited<ReturnType<typeof createPublicClientClientWithAuth>>);
});

describe('listClientsForBlockAction', () => {
  it('maps public client summaries for page block rendering', async () => {
    const createdAt = new Date('2026-05-01T12:00:00.000Z');
    listMock.mockResolvedValue({
      clients: [
        {
          id: 'client-1',
          name: 'Client One',
          website: 'https://client.example',
          logoLightAsset: assetRefFixture('https://cdn.example/light.png'),
          logoDarkAsset: assetRefFixture('https://cdn.example/dark.png'),
          createdAt: timestampFromDate(createdAt),
        },
        {
          id: 'client-2',
          name: 'Client Two',
          website: undefined,
          logoLightAsset: assetRefFixture('https://cdn.example/fallback.png'),
          createdAt: undefined,
        },
        {
          id: 'client-3',
          name: 'Client Three',
          website: undefined,
          createdAt: undefined,
        },
      ],
      pagination: { total: 12 },
    });

    await expect(listClientsForBlockAction({ limit: 2, offset: 4, requestedLocale: 'ko' })).resolves.toEqual({
      clients: [
        {
          id: 'client-1',
          name: 'Client One',
          website: 'https://client.example',
          logoUrl: 'https://cdn.example/light.png',
          logoLightUrl: 'https://cdn.example/light.png',
          logoDarkUrl: 'https://cdn.example/dark.png',
          createdAt,
        },
        {
          id: 'client-2',
          name: 'Client Two',
          website: null,
          logoUrl: 'https://cdn.example/fallback.png',
          logoLightUrl: 'https://cdn.example/fallback.png',
          logoDarkUrl: null,
          createdAt: null,
        },
        {
          id: 'client-3',
          name: 'Client Three',
          website: null,
          logoUrl: null,
          logoLightUrl: null,
          logoDarkUrl: null,
          createdAt: null,
        },
      ],
      pagination: { total: 12, limit: 2, offset: 4 },
    });

    expect(createPublicClientClientWithAuth).toHaveBeenCalledWith('ko');
    expect(listMock).toHaveBeenCalledWith({ pagination: { limit: 2, offset: 4 } });
  });

  it('uses default pagination and empty results when the public API omits optional fields', async () => {
    listMock.mockResolvedValue({});

    await expect(listClientsForBlockAction({ requestedLocale: undefined })).resolves.toEqual({
      clients: [],
      pagination: { total: 0, limit: 24, offset: 0 },
    });

    expect(listMock).toHaveBeenCalledWith({ pagination: { limit: 24, offset: 0 } });
  });

  it('returns an empty block result when listing clients fails', async () => {
    listMock.mockRejectedValue(new Error('backend unavailable'));

    await expect(listClientsForBlockAction({ requestedLocale: null })).resolves.toEqual({
      clients: [],
      pagination: { total: 0, limit: 24, offset: 0 },
    });
  });
});

describe('getClientsForBlockByIdsAction', () => {
  it('maps selected clients and skips missing ids', async () => {
    getMock
      .mockResolvedValueOnce({
        client: {
          id: 'client-1',
          name: 'Client One',
          website: undefined,
          logoLightAsset: assetRefFixture('https://cdn.example/logo.png'),
          logoDarkAsset: assetRefFixture('https://cdn.example/logo-dark.png'),
        },
      })
      .mockResolvedValueOnce({
        client: {
          id: 'client-2',
          name: 'Client Two',
          website: 'https://client.example',
          logoLightAsset: assetRefFixture('https://cdn.example/logo-light.png'),
        },
      })
      .mockResolvedValueOnce({
        client: {
          id: 'client-3',
          name: 'Client Three',
          website: undefined,
        },
      })
      .mockRejectedValueOnce(new ConnectError('missing', Code.NotFound))
      .mockResolvedValueOnce({ client: undefined });

    await expect(
      getClientsForBlockByIdsAction({
        ids: ['client-1', 'client-2', 'client-3', 'missing', 'empty'],
        requestedLocale: 'ja',
      }),
    ).resolves.toEqual([
      {
        id: 'client-1',
        name: 'Client One',
        website: null,
        logoUrl: 'https://cdn.example/logo.png',
        logoLightUrl: 'https://cdn.example/logo.png',
        logoDarkUrl: 'https://cdn.example/logo-dark.png',
      },
      {
        id: 'client-2',
        name: 'Client Two',
        website: 'https://client.example',
        logoUrl: 'https://cdn.example/logo-light.png',
        logoLightUrl: 'https://cdn.example/logo-light.png',
        logoDarkUrl: null,
      },
      {
        id: 'client-3',
        name: 'Client Three',
        website: null,
        logoUrl: null,
        logoLightUrl: null,
        logoDarkUrl: null,
      },
    ]);

    expect(createPublicClientClientWithAuth).toHaveBeenCalledWith('ja');
    expect(getMock).toHaveBeenNthCalledWith(1, { id: 'client-1' });
    expect(getMock).toHaveBeenNthCalledWith(2, { id: 'client-2' });
    expect(getMock).toHaveBeenNthCalledWith(3, { id: 'client-3' });
    expect(getMock).toHaveBeenNthCalledWith(4, { id: 'missing' });
    expect(getMock).toHaveBeenNthCalledWith(5, { id: 'empty' });
  });

  it('returns an empty selected client list when a non-not-found lookup fails', async () => {
    getMock.mockRejectedValue(new ConnectError('unavailable', Code.Unavailable));

    await expect(getClientsForBlockByIdsAction({ ids: ['client-1'], requestedLocale: undefined })).resolves.toEqual([]);
  });
});
