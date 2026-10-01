import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  privacyGet: vi.fn(),
  termsGet: vi.fn(),
  privacyClient: vi.fn(),
  termsClient: vi.fn(),
  requestCaches: [] as Map<string, unknown>[],
}));

// Model React's per-request cache; resetting the maps models a new request.
// This verifies query wiring, not React's caching implementation.
vi.mock('react', () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
    const values = new Map<string, unknown>();
    mocks.requestCaches.push(values);
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      if (!values.has(key)) {
        values.set(key, fn(...args));
      }
      return values.get(key);
    }) as T;
  },
}));
vi.mock('@/lib/api/server-client', () => ({
  createPublicPrivacyClientWithAuth: mocks.privacyClient,
  createPublicTermsClientWithAuth: mocks.termsClient,
}));

import { getPublicPrivacyPage, getPublicTermsPage } from './legal-public.server';

beforeEach(() => {
  vi.clearAllMocks();
  for (const cache of mocks.requestCaches) {
    cache.clear();
  }
  mocks.privacyClient.mockResolvedValue({ get: mocks.privacyGet });
  mocks.termsClient.mockResolvedValue({ get: mocks.termsGet });
});

describe.each([
  { kind: 'privacy', read: getPublicPrivacyPage, get: mocks.privacyGet, client: mocks.privacyClient },
  { kind: 'terms', read: getPublicTermsPage, get: mocks.termsGet, client: mocks.termsClient },
])('$kind public server snapshot', ({ kind, read, get, client }) => {
  it('shares one response between metadata and body reads in the same request', async () => {
    get.mockResolvedValue({ [kind]: { id: 'current', version: 1, title: 'Published policy' } });
    const [metadataSnapshot, bodySnapshot] = await Promise.all([read('en'), read('en')]);
    expect(get).toHaveBeenCalledExactlyOnceWith({});
    expect(client).toHaveBeenCalledExactlyOnceWith('en');
    expect(bodySnapshot).toBe(metadataSnapshot);
    expect(bodySnapshot.data.active?.id).toBe('current');
    expect(bodySnapshot.updatedAt).toBeGreaterThan(0);
  });

  it('separates locales and reads a newly published version in the next request', async () => {
    get.mockResolvedValue({ [kind]: { id: 'v1', version: 1, title: 'Policy' } });
    await Promise.all([read('en'), read('ko')]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(client).toHaveBeenCalledWith('en');
    expect(client).toHaveBeenCalledWith('ko');
    for (const cache of mocks.requestCaches) {
      cache.clear();
    }
    get.mockResolvedValue({ [kind]: { id: 'v2', version: 2, title: 'Updated policy' } });
    expect((await read('en')).data.active?.id).toBe('v2');
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('distinguishes an authoritative absence from a service failure', async () => {
    get.mockRejectedValueOnce(new ConnectError('No active policy', Code.NotFound));
    expect((await read('en')).data).toEqual({ active: null, scheduled: null });
    const error = new ConnectError('Service unavailable', Code.Unavailable);
    get.mockRejectedValueOnce(error);
    await expect(read('ko')).rejects.toBe(error);
  });
});
