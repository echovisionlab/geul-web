import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clientRenderFailureRateLimit } from '@/lib/observability/client-render-failure-rate-limit';

const mocks = vi.hoisted(() => ({ emitSystemRecord: vi.fn(), loggerInfo: vi.fn() }));

vi.mock('@/lib/logging/system-record', () => ({ emitSystemRecord: mocks.emitSystemRecord }));
vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({ info: mocks.loggerInfo }),
}));

import { POST } from './route';

const requestId = '018f47a2-8a3d-4e17-9d42-6f12c89b1234';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('https://app.example/api/observability/client-render-failure', {
    method: 'POST',
    headers: {
      origin: 'https://app.example',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      'x-request-id': requestId,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('client render failure intake', () => {
  beforeEach(() => {
    mocks.emitSystemRecord.mockReset();
    mocks.loggerInfo.mockReset();
    clientRenderFailureRateLimit.resetForTesting();
  });

  it('emits a bounded supplemental classification for a minified React code', async () => {
    const response = await POST(
      request({
        surface: 'general',
        kind: 'react_error_boundary',
        report_id: '018f47a2-8a3d-4e17-9d42-6f12c89b1235',
        react_error_code: '418',
      }),
    );

    expect(response.status).toBe(204);
    expect(mocks.emitSystemRecord).toHaveBeenCalledOnce();
    expect(mocks.loggerInfo).toHaveBeenCalledWith('client.render.classified', {
      data: { react_error_code: 418, request_id: requestId },
    });
  });

  it('accepts an exact same-origin payload and emits only the canonical classification', async () => {
    const response = await POST(
      request({
        surface: 'general',
        kind: 'react_error_boundary',
        report_id: '018f47a2-8a3d-4e17-9d42-6f12c89b1235',
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.emitSystemRecord).toHaveBeenCalledOnce();
    const [module, record] = mocks.emitSystemRecord.mock.calls[0] as [string, Record<string, unknown>];
    expect(module).toBe('client-render-failure-intake');
    expect(record).toMatchObject({
      event: 'client.render.failed',
      outcome: 'failed',
      domain: 'client',
      component: 'general',
      reason: 'react_error_boundary',
      request_id: requestId,
    });
    expect(record).not.toHaveProperty('report_id');
    expect(record).not.toHaveProperty('message');
    expect(record).not.toHaveProperty('stack');
    expect(record).not.toHaveProperty('digest');
  });

  it.each([
    ['cross-site fetch metadata', { 'sec-fetch-site': 'cross-site' }, 403],
    ['cross-origin Origin', { origin: 'https://attacker.example' }, 403],
    ['missing Origin with fetch metadata', { origin: '' }, 403],
    ['non-JSON content', { 'content-type': 'text/plain' }, 415],
  ])('rejects %s', async (_name, headers, status) => {
    const response = await POST(
      request(
        {
          surface: 'general',
          kind: 'react_error_boundary',
          report_id: crypto.randomUUID(),
        },
        headers,
      ),
    );

    expect(response.status).toBe(status);
    expect(mocks.emitSystemRecord).not.toHaveBeenCalled();
  });

  it('accepts a same-origin request when fetch metadata was stripped by a proxy', async () => {
    const response = await POST(
      request(
        {
          surface: 'general',
          kind: 'react_error_boundary',
          report_id: crypto.randomUUID(),
        },
        { 'sec-fetch-site': '' },
      ),
    );

    expect(response.status).toBe(204);
    expect(mocks.emitSystemRecord).toHaveBeenCalledOnce();
  });

  it('accepts the public origin when the ingress forwards its external host', async () => {
    const response = await POST(
      request(
        {
          surface: 'general',
          kind: 'react_error_boundary',
          report_id: crypto.randomUUID(),
        },
        {
          origin: 'https://www.example.invalid',
          'x-forwarded-host': 'www.example.invalid',
          'x-forwarded-proto': 'https',
        },
      ),
    );

    expect(response.status).toBe(204);
    expect(mocks.emitSystemRecord).toHaveBeenCalledOnce();
  });

  it('accepts a request when the proxy strips both browser metadata headers', async () => {
    const response = await POST(
      request(
        {
          surface: 'general',
          kind: 'react_error_boundary',
          report_id: crypto.randomUUID(),
        },
        { origin: '', 'sec-fetch-site': '' },
      ),
    );

    expect(response.status).toBe(204);
    expect(mocks.emitSystemRecord).toHaveBeenCalledOnce();
  });

  it.each([
    ['unknown surface', { surface: 'editor' }],
    ['unknown kind', { kind: 'shader_compile_error' }],
    ['caller error details', { message: 'private', stack: 'private', digest: 'private' }],
    ['invalid report ID', { report_id: 'caller-controlled' }],
    ['invalid React error code', { react_error_code: '418-private' }],
  ])('rejects an otherwise valid payload with %s', async (_name, override) => {
    const response = await POST(
      request({
        surface: 'admin',
        kind: 'react_error_boundary',
        report_id: crypto.randomUUID(),
        ...override,
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.emitSystemRecord).not.toHaveBeenCalled();
  });

  it('rejects an oversized body before decoding it', async () => {
    const response = await POST(request('x'.repeat(257)));

    expect(response.status).toBe(413);
    expect(mocks.emitSystemRecord).not.toHaveBeenCalled();
  });

  it('caps unique valid reports per process without adding an IP or persistent key', async () => {
    for (let index = 0; index < 20; index += 1) {
      const response = await POST(
        request({
          surface: 'general',
          kind: 'react_error_boundary',
          report_id: `018f47a2-8a3d-4e17-9d42-6f12c89b${(2000 + index).toString().padStart(4, '0')}`,
        }),
      );
      expect(response.status).toBe(204);
    }

    const rejected = await POST(
      request({
        surface: 'global',
        kind: 'react_error_boundary',
        report_id: '018f47a2-8a3d-4e17-9d42-6f12c89b2999',
      }),
    );

    expect(rejected.status).toBe(429);
    expect(rejected.headers.get('cache-control')).toBe('no-store');
    expect(Number(rejected.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(mocks.emitSystemRecord).toHaveBeenCalledTimes(20);
  });

  it('drops a replay without consuming another burst slot or emitting again', async () => {
    const payload = {
      surface: 'admin',
      kind: 'react_error_boundary',
      report_id: '018f47a2-8a3d-4e17-9d42-6f12c89b3000',
    };

    expect((await POST(request(payload))).status).toBe(204);
    expect((await POST(request(payload))).status).toBe(204);
    expect(mocks.emitSystemRecord).toHaveBeenCalledOnce();
  });
});
