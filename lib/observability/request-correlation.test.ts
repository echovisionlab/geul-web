import { describe, expect, it } from 'vitest';
import {
  REQUEST_ID_HEADER,
  createPublicRequestCorrelation,
  forwardRequestCorrelationHeader,
} from './request-correlation';

describe('Web request correlation', () => {
  it('creates a canonical public request ID', () => {
    const correlation = createPublicRequestCorrelation();

    expect(correlation.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('forwards only a canonical ingress request ID', () => {
    const target = new Headers();
    forwardRequestCorrelationHeader(
      target,
      new Headers({ [REQUEST_ID_HEADER]: '018f47a2-8a3d-4e17-9d42-6f12c89b1234' }),
    );

    expect(target.get(REQUEST_ID_HEADER)).toBe('018f47a2-8a3d-4e17-9d42-6f12c89b1234');
  });

  it('removes a stale target ID when ingress did not install a canonical value', () => {
    const target = new Headers({ [REQUEST_ID_HEADER]: 'stale' });
    forwardRequestCorrelationHeader(target, new Headers({ [REQUEST_ID_HEADER]: 'not-a-uuid' }));

    expect(target.has(REQUEST_ID_HEADER)).toBe(false);
  });
});
