import { describe, expect, it } from 'vitest';
import { decodeBrowserFlowResponse } from './auth-browser-transport';

const asFlow = (payload: unknown) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const id = (payload as { id?: unknown }).id;
  return typeof id === 'string' ? { id } : null;
};

describe('decodeBrowserFlowResponse', () => {
  it('distinguishes a continued flow from completion', async () => {
    await expect(decodeBrowserFlowResponse(Response.json({ id: 'flow-1' }), { asFlow })).resolves.toEqual({
      kind: 'continued',
      flow: { id: 'flow-1' },
      ok: true,
    });
    await expect(
      decodeBrowserFlowResponse(Response.json({ session: { id: 'session-1' } }), { asFlow }),
    ).resolves.toEqual({ kind: 'completed', payload: { session: { id: 'session-1' } } });
  });

  it('uses Retry-After delta seconds and HTTP dates', async () => {
    await expect(
      decodeBrowserFlowResponse(new Response('{}', { status: 429, headers: { 'Retry-After': '42' } }), {
        asFlow,
        now: 0,
      }),
    ).resolves.toEqual({ kind: 'rate-limited', retryAfterSeconds: 42 });
    await expect(
      decodeBrowserFlowResponse(
        new Response('{}', {
          status: 429,
          headers: { 'Retry-After': 'Thu, 01 Jan 1970 00:01:00 GMT' },
        }),
        { asFlow, now: 30_000 },
      ),
    ).resolves.toEqual({ kind: 'rate-limited', retryAfterSeconds: 30 });
  });

  it('returns an explicit restart only for a caller-approved destination', async () => {
    const response = new Response('{"error":"expired"}', { status: 410 });
    await expect(
      decodeBrowserFlowResponse(response, {
        asFlow,
        restartUrl: () => '/api/auth/login',
      }),
    ).resolves.toEqual({ kind: 'restart', url: '/api/auth/login' });
  });

  it('retains failed status and payload without throwing provider text into the UI', async () => {
    await expect(
      decodeBrowserFlowResponse(new Response('{"error":{"message":"provider detail"}}', { status: 503 }), {
        asFlow,
      }),
    ).resolves.toEqual({
      kind: 'failed',
      status: 503,
      payload: { error: { message: 'provider detail' } },
    });
  });
});
