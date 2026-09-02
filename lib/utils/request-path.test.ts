import { describe, expect, it } from 'vitest';
import {
  buildSearchSuffix,
  getRequestPathnameFromHeaders,
  getRequestPathWithSearchFromHeaders,
  type RequestHeaderSource,
} from './request-path';

function createHeaders(entries: Record<string, string | null | undefined>): RequestHeaderSource {
  return {
    get(name: string) {
      return entries[name] ?? null;
    },
  };
}

describe('getRequestPathnameFromHeaders', () => {
  it('returns x-pathname when present', () => {
    expect(getRequestPathnameFromHeaders(createHeaders({ 'x-pathname': '/admin/pages/123' }), '/admin')).toBe(
      '/admin/pages/123',
    );
  });

  it('falls back when pathname is missing or invalid', () => {
    expect(getRequestPathnameFromHeaders(createHeaders({}), '/admin')).toBe('/admin');
    expect(getRequestPathnameFromHeaders(createHeaders({ 'x-pathname': 'admin' }), '/admin')).toBe('/admin');
  });
});

describe('getRequestPathWithSearchFromHeaders', () => {
  it('prefers the precomputed full path header', () => {
    expect(
      getRequestPathWithSearchFromHeaders(
        createHeaders({
          'x-path-with-search': '/admin/pages/123?lang=ko&tab=summary',
          'x-pathname': '/admin/pages/123',
          'x-search': '?lang=en',
        }),
        '/admin',
      ),
    ).toBe('/admin/pages/123?lang=ko&tab=summary');
  });

  it('reconstructs the path from pathname and search', () => {
    expect(
      getRequestPathWithSearchFromHeaders(
        createHeaders({
          'x-pathname': '/my/security',
          'x-search': '?flow=abc&reauth=passkey',
        }),
        '/my',
      ),
    ).toBe('/my/security?flow=abc&reauth=passkey');
  });

  it('normalizes search strings without a leading question mark', () => {
    expect(
      getRequestPathWithSearchFromHeaders(
        createHeaders({
          'x-pathname': '/admin/pages/123',
          'x-search': 'lang=ja',
        }),
        '/admin',
      ),
    ).toBe('/admin/pages/123?lang=ja');
  });

  it('falls back to pathname only when no query is present', () => {
    expect(
      getRequestPathWithSearchFromHeaders(
        createHeaders({
          'x-pathname': '/admin/pages/123',
        }),
        '/admin',
      ),
    ).toBe('/admin/pages/123');
  });
});

describe('buildSearchSuffix', () => {
  it('serializes scalar and array query params', () => {
    expect(
      buildSearchSuffix({
        lang: 'ko',
        tab: ['summary', 'history'],
      }),
    ).toBe('?lang=ko&tab=summary&tab=history');
  });

  it('skips undefined values and returns an empty suffix when no params exist', () => {
    expect(
      buildSearchSuffix({
        lang: undefined,
      }),
    ).toBe('');
  });
});
