import { describe, expect, it } from 'vitest';
import { buildFilterUrl, buildPaginationUrl, buildSearchUrl, buildSortUrl, parseTableQuery } from './table-url';

function params(query: Record<string, unknown> = {}) {
  return new URLSearchParams({
    lang: 'ko',
    other: JSON.stringify({ page: 3 }),
    artists: JSON.stringify(query),
  });
}

function parsedUrl(url: string) {
  return new URL(url, 'https://example.com/artists');
}

describe('table URL helpers', () => {
  it('updates pagination while preserving unrelated query parameters and namespaced state', () => {
    const current = params({ search: 'A & 한글', pageSize: 50 });
    const url = parsedUrl(buildPaginationUrl('artists', current, 2, '/artists'));
    expect(url.pathname).toBe('/artists');
    expect(url.searchParams.get('lang')).toBe('ko');
    expect(url.searchParams.get('other')).toBe('{"page":3}');
    expect(JSON.parse(url.searchParams.get('artists')!)).toEqual({ page: 2, pageSize: 50, search: 'A & 한글' });
    expect(current.get('artists')).toBe('{"search":"A & 한글","pageSize":50}');
  });

  it('removes default pagination and empty search, filters and sorts from the URL', () => {
    expect(buildPaginationUrl('artists', new URLSearchParams(), 1)).toBe('?');
    expect(buildPaginationUrl('artists', new URLSearchParams(), 1, '/artists')).toBe('/artists');
    const url = parsedUrl(buildSearchUrl('artists', params({ page: 5, pageSize: 20, sorts: [], filters: [] }), ''));
    expect(url.searchParams.has('artists')).toBe(false);
    expect(url.searchParams.get('lang')).toBe('ko');
  });

  it('resets page for search and preserves sorting and filters with exact query encoding', () => {
    const query = {
      sorts: [{ field: 'name', direction: 'desc' }],
      filters: [{ field: 'country', op: 'eq', value: 'KR' }],
    };
    const current = params({ page: 4, ...query });
    const url = buildSearchUrl('artists', current, 'A & B+한글', '/artists');
    const expected = new URLSearchParams(current.toString());
    expected.set('artists', JSON.stringify({ search: 'A & B+한글', ...query }));
    expect(url).toBe(`/artists?${expected}`);
  });

  it('resets page for sort and filter updates and retains search', () => {
    const sorts = [{ field: 'name', direction: 'asc' as const }];
    const filters = [{ field: 'country', op: 'in', value: ['KR', 'US'] }];
    const current = params({ page: 5, search: 'test' });
    expect(parseTableQuery(parsedUrl(buildSortUrl('artists', current, sorts)).searchParams, 'artists')).toEqual({
      page: 1,
      pageSize: 20,
      search: 'test',
      sorts,
      filters: undefined,
      filterBy: undefined,
    });
    expect(
      parseTableQuery(parsedUrl(buildFilterUrl('artists', current, filters, 'OR')).searchParams, 'artists'),
    ).toEqual({ page: 1, pageSize: 20, search: 'test', sorts: undefined, filters, filterBy: 'OR' });
  });

  it.each([
    new URLSearchParams(),
    new URLSearchParams({ artists: 'invalid JSON' }),
    new URLSearchParams({ artists: 'null' }),
  ])('falls back to defaults for absent or unparsable query %s', (current) => {
    expect(parseTableQuery(current, 'artists')).toEqual({ page: 1, pageSize: 20 });
  });

  it('preserves permissive parsing semantics and applies only nullish defaults', () => {
    expect(parseTableQuery(params({ page: 0, pageSize: 101, search: '', filterBy: 'AND' }), 'artists')).toEqual({
      page: 0,
      pageSize: 101,
      search: '',
      sorts: undefined,
      filters: undefined,
      filterBy: 'AND',
    });
    expect(parseTableQuery(params({ page: null, pageSize: null }), 'artists').pageSize).toBe(20);
  });
});
