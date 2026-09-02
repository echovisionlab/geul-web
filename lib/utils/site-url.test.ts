import { describe, expect, it } from 'vitest';
import { resolveSiteHref } from './site-url';

describe('resolveSiteHref', () => {
  it.each([
    [undefined, '/'],
    [null, '/'],
    ['', '/'],
    ['  ', '/'],
    ['https://example.com/path', 'https://example.com/path'],
    ['http://example.com', 'http://example.com'],
    ['//cdn.example.com/file.png', 'https://cdn.example.com/file.png'],
    ['/about', '/about'],
    ['example.com/page', 'https://example.com/page'],
    ['example.com:3000', 'https://example.com:3000'],
    ['mailto:hello@example.com', 'mailto:hello@example.com'],
  ])('resolves %s to %s', (siteOrigin, expected) => {
    expect(resolveSiteHref(siteOrigin)).toBe(expected);
  });
});
