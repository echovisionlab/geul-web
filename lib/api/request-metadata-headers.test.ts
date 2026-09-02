import { describe, expect, it } from 'vitest';
import { REQUEST_ID_HEADER } from '@/lib/observability/request-correlation';
import { forwardIncomingRequestMetadataHeaders } from './request-metadata-headers';

describe('forwardIncomingRequestMetadataHeaders', () => {
  it('forwards browser metadata without forwarding unrelated incoming headers', () => {
    const incoming = new Headers({
      cookie: 'session=secret',
      'user-agent': 'Mozilla/5.0',
      'x-request-id': '018f47a2-8a3d-4e17-9d42-6f12c89b1234',
      'accept-language': 'ko-KR,ko;q=0.9',
    });
    const outgoing = new Headers();

    forwardIncomingRequestMetadataHeaders(outgoing, incoming);

    expect(outgoing.get('user-agent')).toBe('Mozilla/5.0');
    expect(outgoing.get(REQUEST_ID_HEADER)).toBe('018f47a2-8a3d-4e17-9d42-6f12c89b1234');
    expect(outgoing.has('cookie')).toBe(false);
    expect(outgoing.has('accept-language')).toBe(false);
  });

  it('does not forward caller-controlled IP forwarding headers', () => {
    const incoming = new Headers({
      forwarded: 'for=198.51.100.1',
      'x-forwarded-for': '198.51.100.1, 10.0.0.1',
      'x-real-ip': '198.51.100.1',
      'cf-connecting-ip': '2001:db8::1',
      'true-client-ip': '2001:db8::2',
      'user-agent': 'Firefox',
    });
    const outgoing = new Headers();

    forwardIncomingRequestMetadataHeaders(outgoing, incoming);

    expect(outgoing.get('user-agent')).toBe('Firefox');
    expect(outgoing.has('forwarded')).toBe(false);
    expect(outgoing.has('x-forwarded-for')).toBe(false);
    expect(outgoing.has('x-real-ip')).toBe(false);
    expect(outgoing.has('cf-connecting-ip')).toBe(false);
    expect(outgoing.has('true-client-ip')).toBe(false);
  });

  it('does not forward a malformed request ID', () => {
    const incoming = new Headers({
      'x-request-id': 'caller-controlled',
    });
    const outgoing = new Headers({
      'x-request-id': 'stale',
    });

    forwardIncomingRequestMetadataHeaders(outgoing, incoming);

    expect(outgoing.has(REQUEST_ID_HEADER)).toBe(false);
  });
});
