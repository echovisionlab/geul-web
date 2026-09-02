import { describe, expect, it } from 'vitest';
import { buildRpcForwardHeaders } from './rpc-forward-headers';

describe('buildRpcForwardHeaders', () => {
  it('forwards Connect headers, validated cookies, and request metadata headers', () => {
    const headers = buildRpcForwardHeaders(
      new Headers({
        cookie: 'unvalidated=ignored',
        'content-type': 'application/json',
        'accept-language': 'ko-KR',
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '203.0.113.5, 10.0.0.1',
        'x-real-ip': '203.0.113.5',
      }),
      'validated=session',
    );

    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept-language')).toBe('ko-KR');
    expect(headers.get('user-agent')).toBe('Mozilla/5.0');
    expect(headers.has('x-forwarded-for')).toBe(false);
    expect(headers.has('x-real-ip')).toBe(false);
    expect(headers.get('cookie')).toBe('validated=session');
  });

  it('does not forward caller-controlled IP forwarding headers', () => {
    const headers = buildRpcForwardHeaders(
      new Headers({
        forwarded: 'for=198.51.100.1',
        'x-forwarded-for': '198.51.100.1, 10.0.0.1',
        'x-real-ip': '198.51.100.1',
        'cf-connecting-ip': '2001:db8::5',
        'true-client-ip': '2001:db8::6',
      }),
      '',
    );

    expect(headers.has('forwarded')).toBe(false);
    expect(headers.has('x-forwarded-for')).toBe(false);
    expect(headers.has('x-real-ip')).toBe(false);
    expect(headers.has('cf-connecting-ip')).toBe(false);
    expect(headers.has('true-client-ip')).toBe(false);
  });
});
