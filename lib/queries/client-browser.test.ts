import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientClient } from '@/lib/api/browser-client';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import { getClient, listClientsForSelector, searchClients } from './client-browser';

const getClientMock = vi.fn();
const listClientsMock = vi.fn();
const searchClientsMock = vi.fn();

vi.mock('@/lib/api/browser-client', () => ({
  createClientClient: vi.fn(),
}));

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({
    error: vi.fn(),
  }),
  serializeClientLogError: (error: unknown) => error,
}));

beforeEach(() => {
  getClientMock.mockReset();
  listClientsMock.mockReset();
  searchClientsMock.mockReset();
  vi.mocked(createClientClient).mockReset();
  vi.mocked(createClientClient).mockReturnValue({
    getClient: getClientMock,
    listClients: listClientsMock,
    searchClients: searchClientsMock,
  } as unknown as ReturnType<typeof createClientClient>);
});

describe('getClient', () => {
  it('maps a browser client lookup with themed logos', async () => {
    const createdAt = new Date('2026-05-01T15:00:00.000Z');
    getClientMock.mockResolvedValue({
      id: 'client-1',
      name: 'Client One',
      website: undefined,
      logoLightAsset: assetRefFixture('https://cdn.example/logo.png'),
      logoDarkAsset: assetRefFixture('https://cdn.example/logo-dark.png'),
      createdAt: timestampFromDate(createdAt),
    });

    await expect(getClient('client-1')).resolves.toEqual({
      id: 'client-1',
      name: 'Client One',
      website: null,
      logoUrl: 'https://cdn.example/logo.png',
      logoLightUrl: 'https://cdn.example/logo.png',
      logoDarkUrl: 'https://cdn.example/logo-dark.png',
      createdAt,
    });

    expect(getClientMock).toHaveBeenCalledWith({ id: 'client-1' });
  });

  it('maps optional browser client fields without default logo fallbacks', async () => {
    getClientMock.mockResolvedValue({
      id: 'client-2',
      name: 'Client Two',
      website: 'https://client.example',
      createdAt: undefined,
    });

    await expect(getClient('client-2')).resolves.toEqual({
      id: 'client-2',
      name: 'Client Two',
      website: 'https://client.example',
      logoUrl: null,
      logoLightUrl: null,
      logoDarkUrl: null,
      createdAt: null,
    });
  });

  it('returns null for missing browser client lookups', async () => {
    getClientMock.mockRejectedValue(new ConnectError('missing', Code.NotFound));

    await expect(getClient('missing')).resolves.toBeNull();
  });

  it('propagates non-not-found lookup failures', async () => {
    const error = new ConnectError('unavailable', Code.Unavailable);
    getClientMock.mockRejectedValue(error);

    await expect(getClient('client-1')).rejects.toBe(error);
  });
});

describe('searchClients', () => {
  it('maps browser client search results', async () => {
    searchClientsMock.mockResolvedValue({
      clients: [
        {
          id: 'client-1',
          name: 'Client One',
          website: 'https://client.example',
          logoLightAsset: assetRefFixture('https://cdn.example/logo.png'),
        },
        {
          id: 'client-2',
          name: 'Client Two',
          website: undefined,
          logoLightAsset: assetRefFixture('https://cdn.example/logo-light.png'),
          logoDarkAsset: assetRefFixture('https://cdn.example/logo-dark.png'),
        },
        {
          id: 'client-3',
          name: 'Client Three',
          website: undefined,
        },
      ],
    });

    await expect(searchClients('cli')).resolves.toEqual([
      {
        id: 'client-1',
        name: 'Client One',
        website: 'https://client.example',
        logoUrl: 'https://cdn.example/logo.png',
        logoLightUrl: 'https://cdn.example/logo.png',
        logoDarkUrl: null,
      },
      {
        id: 'client-2',
        name: 'Client Two',
        website: null,
        logoUrl: 'https://cdn.example/logo-light.png',
        logoLightUrl: 'https://cdn.example/logo-light.png',
        logoDarkUrl: 'https://cdn.example/logo-dark.png',
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

    expect(searchClientsMock).toHaveBeenCalledWith({ query: 'cli', limit: 10 });
  });

  it('returns an empty search result when the public API omits clients', async () => {
    searchClientsMock.mockResolvedValue({});

    await expect(searchClients('cli')).resolves.toEqual([]);
  });

  it('returns an empty search result when client search fails', async () => {
    searchClientsMock.mockRejectedValue(new Error('backend unavailable'));

    await expect(searchClients('cli')).resolves.toEqual([]);
  });
});

describe('listClientsForSelector', () => {
  it('maps browser client selector results', async () => {
    listClientsMock.mockResolvedValue({
      clients: [
        {
          id: 'client-1',
          name: 'Client One',
          website: undefined,
          logoLightAsset: assetRefFixture('https://cdn.example/logo-light.png'),
        },
        {
          id: 'client-2',
          name: 'Client Two',
          website: 'https://client.example',
          logoDarkAsset: assetRefFixture('https://cdn.example/logo-dark.png'),
        },
        {
          id: 'client-3',
          name: 'Client Three',
          website: undefined,
        },
      ],
    });

    await expect(listClientsForSelector()).resolves.toEqual([
      {
        id: 'client-1',
        name: 'Client One',
        website: null,
        logoUrl: 'https://cdn.example/logo-light.png',
        logoLightUrl: 'https://cdn.example/logo-light.png',
        logoDarkUrl: null,
      },
      {
        id: 'client-2',
        name: 'Client Two',
        website: 'https://client.example',
        logoUrl: 'https://cdn.example/logo-dark.png',
        logoLightUrl: null,
        logoDarkUrl: 'https://cdn.example/logo-dark.png',
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

    expect(listClientsMock).toHaveBeenCalledWith({ pagination: { limit: 100, offset: 0 } });
  });

  it('returns an empty selector result when the public API omits clients', async () => {
    listClientsMock.mockResolvedValue({});

    await expect(listClientsForSelector()).resolves.toEqual([]);
  });

  it('returns an empty selector result when listing clients fails', async () => {
    listClientsMock.mockRejectedValue(new Error('backend unavailable'));

    await expect(listClientsForSelector()).resolves.toEqual([]);
  });
});
