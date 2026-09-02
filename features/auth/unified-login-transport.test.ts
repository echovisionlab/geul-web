import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/public-runtime-config', () => ({
  getPublicAuthUrl: () => '/api/auth',
}));

import { createUnifiedLoginTransport } from './unified-login-transport';

const flow = {
  id: 'flow-1',
  ui: { nodes: [] },
};

describe('createUnifiedLoginTransport', () => {
  const fetchFn = vi.fn<typeof fetch>();

  beforeEach(() => fetchFn.mockReset());

  it('uses only the unified public login endpoints', async () => {
    fetchFn
      .mockResolvedValueOnce(Response.json(flow))
      .mockResolvedValueOnce(Response.json({ session: { id: 'session-1' } }));
    const transport = createUnifiedLoginTransport(fetchFn);

    await transport.load('flow-1', '/api/auth/login');
    await transport.submit('flow-1', { method: 'code', code: '123456' }, '/api/auth/login');

    expect(fetchFn.mock.calls[0]?.[0]).toBe('/api/auth/login/flows?id=flow-1');
    expect(fetchFn.mock.calls[1]?.[0]).toBe('/api/auth/login?flow=flow-1');
    expect(JSON.parse(String(fetchFn.mock.calls[1]?.[1]?.body))).toEqual({
      method: 'code',
      code: '123456',
    });
  });
});
