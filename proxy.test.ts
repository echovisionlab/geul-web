import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { REQUEST_ID_HEADER } from '@/lib/observability/request-correlation';
import { proxy } from './proxy';

describe('proxy', () => {
  it('replaces a caller request ID and returns the canonical value', async () => {
    const response = await proxy(
      new NextRequest('https://www.example.invalid/posts/example', {
        headers: { [REQUEST_ID_HEADER]: 'caller-controlled' },
      }),
    );
    const requestId = response.headers.get(REQUEST_ID_HEADER);

    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(response.headers.get(`x-middleware-request-${REQUEST_ID_HEADER.toLowerCase()}`)).toBe(requestId);
  });

  it('does not add correlation headers to the health endpoint', async () => {
    const response = await proxy(new NextRequest('https://www.example.invalid/api/health'));

    expect(response.headers.has(REQUEST_ID_HEADER)).toBe(false);
  });
});
