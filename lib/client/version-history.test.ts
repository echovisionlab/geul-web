import { afterEach, describe, expect, it, vi } from 'vitest';
import { restoreVersionRequest } from './version-history';

afterEach(() => {
  vi.unstubAllGlobals();
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
