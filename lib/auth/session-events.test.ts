// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticatedBrowserFetch, SESSION_INVALIDATED_EVENT } from './session-events';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authenticatedBrowserFetch', () => {
  it('notifies the session provider when an authenticated RPC returns 401', async () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_INVALIDATED_EVENT, listener);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await authenticatedBrowserFetch('/api/rpc/example', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledWith('/api/rpc/example', {
      method: 'POST',
      credentials: 'include',
    });
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_INVALIDATED_EVENT, listener);
  });

  it('does not invalidate the session for a non-authentication error', async () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_INVALIDATED_EVENT, listener);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await authenticatedBrowserFetch('/api/rpc/example');

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_INVALIDATED_EVENT, listener);
  });
});
