import { afterEach, describe, expect, it, vi } from 'vitest';
import { listVersionsRequest, restoreVersionRequest } from './version-history';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listVersionsRequest', () => {
  it.each(['post', 'page', 'work'] as const)(
    'preserves the default %s list URL and request options',
    async (entityType) => {
      const result = { versions: [], total: 0 };
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(result)));
      vi.stubGlobal('fetch', fetchMock);

      await expect(listVersionsRequest(entityType, `${entityType}-1`)).resolves.toEqual(result);
      expect(fetchMock).toHaveBeenCalledWith(`/api/version-history/${entityType}/${entityType}-1?page=1&pageSize=20`, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
    },
  );

  it('forwards explicit pagination and the query cancellation signal to fetch', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ versions: [], total: 0 })));
    vi.stubGlobal('fetch', fetchMock);

    await listVersionsRequest('work', 'work-1', 7, 40, controller.signal);

    expect(fetchMock).toHaveBeenCalledWith('/api/version-history/work/work-1?page=7&pageSize=40', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
  });

  it('preserves a service error payload for the query to handle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
    );

    await expect(listVersionsRequest('page', 'page-1')).resolves.toEqual({ error: 'Forbidden' });
  });

  it('propagates cancellation without turning it into a successful empty list', async () => {
    const controller = new AbortController();
    const aborted = new DOMException('Cancelled', 'AbortError');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
          }),
      ),
    );
    const request = listVersionsRequest('post', 'post-1', 1, 20, controller.signal);
    const rejection = expect(request).rejects.toBe(aborted);

    controller.abort(aborted);

    await rejection;
  });
});

describe('restoreVersionRequest', () => {
  it.each(['post', 'page', 'work'] as const)('posts the exact %s version restore payload', async (entityType) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(restoreVersionRequest(entityType, `${entityType}-1`, 'version-7')).resolves.toEqual({
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/version-history/${entityType}/${entityType}-1/restore`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId: 'version-7' }),
    });
  });
});
