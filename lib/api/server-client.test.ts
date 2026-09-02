import { ClientService as PublicClientService } from '@echovisionlab/geul-proto/public/client_pb.ts';
import { ManifestService } from '@echovisionlab/geul-proto/public/manifest_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REQUEST_ID_HEADER } from '@/lib/observability/request-correlation';
import { createManifestClient, createPublicClientClientWithAuth, createPublicManifestClient } from './server-client';

type TestTransport = {
  options: {
    fetch: typeof fetch;
  };
};

const { cookiesMock, createClientMock, createConnectTransportMock, fetchMock, getRequestHeadersMock } = vi.hoisted(
  () => ({
    cookiesMock: vi.fn(),
    createClientMock: vi.fn((service, transport) => ({ service, transport })),
    createConnectTransportMock: vi.fn((options) => ({ options })),
    fetchMock: vi.fn(),
    getRequestHeadersMock: vi.fn(),
  }),
);

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('@connectrpc/connect', async () => {
  const actual = await vi.importActual<typeof import('@connectrpc/connect')>('@connectrpc/connect');
  return {
    ...actual,
    createClient: createClientMock,
  };
});

vi.mock('@connectrpc/connect-web', () => ({
  createConnectTransport: createConnectTransportMock,
}));

vi.mock('@/lib/auth/session-cookie', () => ({
  buildCookieHeader: vi.fn(() => 'site_session=validated'),
}));

vi.mock('@/lib/env', () => ({
  getApiUrl: vi.fn(() => 'https://api.example.test'),
  getSessionCookieName: vi.fn(() => 'ory_kratos_session'),
  getKratosUrl: vi.fn(() => 'https://kratos.example.test'),
}));

vi.mock('@/lib/utils/header.server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

beforeEach(() => {
  createClientMock.mockClear();
  createConnectTransportMock.mockClear();
  cookiesMock.mockResolvedValue({ getAll: () => [{ name: 'site_session', value: 'raw' }] });
  getRequestHeadersMock.mockResolvedValue(
    new Headers({
      'accept-language': 'ko-KR',
      'user-agent': 'Vitest',
    }),
  );
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('createPublicClientClientWithAuth', () => {
  it('creates the public client transport with optional auth and locale forwarding', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await createPublicClientClientWithAuth('ja-JP');
    expect(createClientMock).toHaveBeenCalledWith(PublicClientService, expect.any(Object));
    expect(createConnectTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://api.example.test' }),
    );

    const transport = createClientMock.mock.calls[0]?.[1] as TestTransport;
    const fetcher = transport.options.fetch;
    const response = await fetcher('https://api.example.test/client', {
      headers: { 'x-test': '1' },
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.cache).toBe('no-store');
    expect(fetchMock.mock.calls[1]?.[1]?.cache).toBe('no-store');

    const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(firstHeaders.get('Cookie')).toBe('site_session=validated');
    expect(firstHeaders.get('Accept-Language')).toBe('ja-JP');
    expect(firstHeaders.get('user-agent')).toBe('Vitest');

    const retryHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    expect(retryHeaders.has('Cookie')).toBe(false);
    expect(retryHeaders.get('Accept-Language')).toBe('ja-JP');
  });
});

describe('manifest clients', () => {
  it('uses the incoming request locale when no manifest locale override is provided', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await createManifestClient();
    expect(createClientMock).toHaveBeenCalledWith(ManifestService, expect.any(Object));

    const transport = createClientMock.mock.calls[0]?.[1] as TestTransport;
    const fetcher = transport.options.fetch;
    await fetcher('https://api.example.test/manifest', {
      headers: { 'x-test': '1' },
      method: 'POST',
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Accept-Language')).toBe('ko-KR');
    expect(headers.get('Cookie')).toBe('site_session=validated');
  });

  it('forwards the resolved request locale when creating the optional-auth manifest client', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await createManifestClient('en');
    expect(createClientMock).toHaveBeenCalledWith(ManifestService, expect.any(Object));

    const transport = createClientMock.mock.calls[0]?.[1] as TestTransport;
    const fetcher = transport.options.fetch;
    await fetcher('https://api.example.test/manifest', {
      headers: { 'x-test': '1' },
      method: 'POST',
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Accept-Language')).toBe('en');
    expect(headers.get('Cookie')).toBe('site_session=validated');
  });

  it('forwards the resolved request locale when using the public manifest fallback client', async () => {
    getRequestHeadersMock.mockResolvedValue(
      new Headers({
        'accept-language': 'ko-KR',
        cookie: 'incoming=secret',
        'x-request-id': '018f47a2-8a3d-4e17-9d42-6f12c89b1234',
      }),
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    createPublicManifestClient('ja');
    expect(createClientMock).toHaveBeenCalledWith(ManifestService, expect.any(Object));

    const transport = createClientMock.mock.calls[0]?.[1] as TestTransport;
    const fetcher = transport.options.fetch;
    await fetcher('https://api.example.test/manifest', {
      headers: { 'x-test': '1' },
      method: 'POST',
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Accept-Language')).toBe('ja');
    expect(headers.get(REQUEST_ID_HEADER)).toBe('018f47a2-8a3d-4e17-9d42-6f12c89b1234');
    expect(headers.has('Cookie')).toBe(false);
  });

  it('does not add a locale header for unauthenticated public manifest calls without an override', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    createPublicManifestClient();
    expect(createClientMock).toHaveBeenCalledWith(ManifestService, expect.any(Object));

    const transport = createClientMock.mock.calls[0]?.[1] as TestTransport;
    const fetcher = transport.options.fetch;
    await fetcher('https://api.example.test/manifest', {
      headers: { 'x-test': '1' },
      method: 'POST',
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('x-test')).toBe('1');
    expect(headers.has('Accept-Language')).toBe(false);
  });

  it.each([
    ['a malformed request ID', 'caller-controlled'],
    ['a missing request ID', undefined],
  ])('does not forward %s from the public manifest fallback client', async (_description, requestId) => {
    getRequestHeadersMock.mockResolvedValue(
      new Headers({
        cookie: 'incoming=secret',
        ...(requestId ? { 'x-request-id': requestId } : {}),
      }),
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    createPublicManifestClient();
    const transport = createClientMock.mock.calls[0]?.[1] as TestTransport;
    await transport.options.fetch('https://api.example.test/manifest', {
      headers: {
        Cookie: 'caller=secret',
        [REQUEST_ID_HEADER]: 'stale-request-id',
      },
      method: 'POST',
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.has(REQUEST_ID_HEADER)).toBe(false);
    expect(headers.has('Cookie')).toBe(false);
  });
});
