import { describe, expect, it } from 'vitest';
import { buildUploadProxyRequestHeaders, buildUploadProxyResponseHeaders } from './upload-proxy';

describe('upload proxy routing', () => {
  it('forwards only content and range metadata plus the server-owned cookie', () => {
    const headers = buildUploadProxyRequestHeaders(
      new Headers({
        accept: '*/*',
        authorization: 'Bearer caller-token',
        'content-length': '12',
        'content-range': 'bytes 0-11/12',
        'content-type': 'application/octet-stream',
        cookie: 'caller=injected',
        'if-range': '"etag-1"',
        range: 'bytes=0-11',
        'x-request-id': '018f47a2-8a3d-4e17-9d42-6f12c89b1234',
        'x-gateway-assertion': 'caller-assertion',
        'x-identity-id': 'caller-identity',
        'x-member-id': 'caller-member',
        'x-session-id': 'caller-session',
        'x-user-role': 'admin',
      }),
      'ory_kratos_session=server-cookie',
    );

    expect(Object.fromEntries(headers.entries())).toEqual({
      'content-length': '12',
      'content-range': 'bytes 0-11/12',
      'content-type': 'application/octet-stream',
      cookie: 'ory_kratos_session=server-cookie',
      'if-range': '"etag-1"',
      range: 'bytes=0-11',
      'x-request-id': '018f47a2-8a3d-4e17-9d42-6f12c89b1234',
    });
  });

  it('preserves end-to-end response metadata while stripping hop-by-hop and rewritten body headers', () => {
    const headers = buildUploadProxyResponseHeaders(
      new Headers({
        connection: 'keep-alive',
        'content-encoding': 'gzip',
        'content-length': '120',
        'content-range': 'bytes 0-11/120',
        'content-type': 'application/octet-stream',
        etag: '"etag-1"',
        'transfer-encoding': 'chunked',
        'x-request-id': 'request-1',
      }),
    );

    expect(Object.fromEntries(headers.entries())).toEqual({
      'content-range': 'bytes 0-11/120',
      'content-type': 'application/octet-stream',
      etag: '"etag-1"',
      'x-request-id': 'request-1',
    });
  });
});
