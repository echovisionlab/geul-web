import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  client: vi.fn(),
  caches: [] as Map<string, unknown>[],
}));
vi.mock('react', () => ({
  cache: (fn: (...args: unknown[]) => unknown) => {
    const values = new Map<string, unknown>();
    mocks.caches.push(values);
    return (...args: unknown[]) => {
      const key = JSON.stringify(args);
      if (!values.has(key)) {
        values.set(key, fn(...args));
      }
      return values.get(key);
    };
  },
}));
vi.mock('@/lib/api/server-client', () => ({
  createPublicPrivacyClientWithAuth: mocks.client,
  createPublicTermsClientWithAuth: mocks.client,
}));

import { PrivacySchema } from '@echovisionlab/geul-proto/public/privacy_pb.ts';
import { TermsSchema } from '@echovisionlab/geul-proto/public/terms_pb.ts';
vi.mock('@/lib/api/browser/public-privacy', () => ({
  createPublicPrivacyClient: mocks.client,
  createPublicPrivacyClientWithLocale: mocks.client,
}));
vi.mock('@/lib/api/browser/public-terms', () => ({
  createPublicTermsClient: mocks.client,
  createPublicTermsClientWithLocale: mocks.client,
}));
import { getArchivedPrivacy } from './privacy-browser';
import { getArchivedTerms } from './terms-browser';
import { getPublicLegalHistory, getPublicLegalHistoryDetail } from './legal-history.server';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.caches.forEach((cache) => cache.clear());
  mocks.client.mockReturnValue({ get: mocks.get, list: mocks.list });
});

afterEach(() => vi.useRealTimers());

describe.each(['privacy', 'terms'] as const)('%s history server data', (kind) => {
  function entity(id: string) {
    return kind === 'privacy' ? create(PrivacySchema, { id, version: 2 }) : create(TermsSchema, { id, version: 2 });
  }
  it('memoizes a localized list without materializing the active document and separates requests/locales', async () => {
    mocks.get.mockResolvedValue({ [kind]: entity('current') });
    mocks.list.mockResolvedValue({ items: [] });
    const [a, b] = await Promise.all([getPublicLegalHistory(kind, 'ko'), getPublicLegalHistory(kind, 'ko')]);
    expect(a).toBe(b);
    expect(a.active).toEqual({ id: 'current', version: 2, effectiveFrom: null });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.list).toHaveBeenCalledTimes(1);
    await getPublicLegalHistory(kind, 'en');
    expect(mocks.client).toHaveBeenCalledWith('en');
    mocks.caches.forEach((cache) => cache.clear());
    await getPublicLegalHistory(kind, 'ko');
    expect(mocks.get).toHaveBeenCalledTimes(3);
  });
  it('uses the conditional archive summary and keeps the exact end date', async () => {
    mocks.get.mockImplementation(async ({ id }) => ({ [kind]: entity(id || 'current') }));
    const until = new Date('2026-09-01T00:00:00Z');
    mocks.list.mockResolvedValue({ items: [{ id: 'old', effectiveUntil: timestampFromDate(until) }] });
    const result = await getPublicLegalHistoryDetail(kind, 'old', 'ko');
    expect(result.data).toMatchObject({ id: 'old', status: 'archived', effectiveUntil: until });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith({ limit: 100, offset: 0 });
    expect(mocks.client).toHaveBeenCalledExactlyOnceWith('ko');
  });
  it('does not make current-version display wait for the list or fail with its error', async () => {
    mocks.get.mockResolvedValue({ [kind]: entity('current') });
    mocks.list.mockReturnValue(new Promise(() => {}));
    const result = await getPublicLegalHistoryDetail(kind, 'current', 'en');
    expect(result.data).toMatchObject({ status: 'active', effectiveUntil: null });
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('preserves null absence and transient failure for browser recovery', async () => {
    mocks.list.mockResolvedValue({ items: [] });
    mocks.get.mockRejectedValue(new ConnectError('Missing', Code.NotFound));
    expect((await getPublicLegalHistoryDetail(kind, 'absent', 'en')).data).toBeNull();
    const error = new ConnectError('Unavailable', Code.Unavailable);
    mocks.get.mockRejectedValue(error);
    await expect(getPublicLegalHistoryDetail(kind, 'old', 'ko')).rejects.toBe(error);
  });
  it('keeps archived list errors authoritative for detail but empty for list views', async () => {
    mocks.get.mockImplementation(async ({ id }) => ({ [kind]: entity(id || 'current') }));
    const error = new ConnectError('Unavailable', Code.Unavailable);
    mocks.list.mockRejectedValue(error);
    await expect(getPublicLegalHistoryDetail(kind, 'old', 'en')).rejects.toBe(error);
    expect((await getPublicLegalHistory(kind, 'en')).archived).toEqual([]);
  });
  it('measures the actual old/new archived query with identical 50 ms RPC delays', async () => {
    vi.useFakeTimers();
    const delayed = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 50));
    mocks.get.mockImplementation(({ id }) => delayed({ [kind]: entity(id || 'current') }));
    mocks.list.mockImplementation(() => delayed({ items: [{ id: 'old' }] }));
    const oldRead = kind === 'privacy' ? getArchivedPrivacy : getArchivedTerms;
    const beforeStart = Date.now();
    let beforeReady: number | undefined;
    const before = oldRead('old', 'ko').then(() => {
      beforeReady = Date.now() - beforeStart;
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(beforeReady).toBeUndefined();
    await vi.advanceTimersByTimeAsync(50);
    await before;
    const beforeCalls = { get: mocks.get.mock.calls.length, list: mocks.list.mock.calls.length };
    mocks.get.mockClear();
    mocks.list.mockClear();
    const afterStart = Date.now();
    let afterReady: number | undefined;
    const after = getPublicLegalHistoryDetail(kind, 'old', 'ko').then(() => {
      afterReady = Date.now() - afterStart;
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(afterReady).toBeUndefined();
    await vi.advanceTimersByTimeAsync(50);
    await after;
    expect(beforeReady).toBe(100);
    expect(afterReady).toBe(100);
    expect(beforeCalls).toEqual({ get: 2, list: 1 });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
});
