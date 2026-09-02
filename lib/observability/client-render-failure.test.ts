// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_RENDER_FAILURE_ENDPOINT, reportClientRenderFailure } from './client-render-failure';

describe('client render failure reporter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends only the bounded boundary classification and never serializes the Error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const error = Object.assign(new Error('private document text'), {
      digest: 'private-digest',
      code: 'private-code',
    });

    reportClientRenderFailure('admin', error);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(CLIENT_RENDER_FAILURE_ENDPOINT);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
    });
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(payload).toEqual({
      surface: 'admin',
      kind: 'react_error_boundary',
      report_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
    });
    expect(JSON.stringify(payload)).not.toContain(error.message);
    expect(JSON.stringify(payload)).not.toContain(error.stack);
    expect(JSON.stringify(payload)).not.toContain(error.digest);
    expect(JSON.stringify(payload)).not.toContain(error.code);
  });

  it('extracts only a bounded numeric code from a minified React error', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const error = new Error(
      'Minified React error #418; visit https://react.dev/errors/418?args[]=private-document-text',
    );

    reportClientRenderFailure('general', error);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(payload.react_error_code).toBe('418');
    expect(JSON.stringify(payload)).not.toContain('private-document-text');
    expect(JSON.stringify(payload)).not.toContain('react.dev');
  });

  it('reports the same Error object once and swallows intake failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('intake unavailable'));
    vi.stubGlobal('fetch', fetchMock);
    const error = new Error('render failed');

    expect(() => reportClientRenderFailure('general', error)).not.toThrow();
    expect(() => reportClientRenderFailure('general', error)).not.toThrow();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
