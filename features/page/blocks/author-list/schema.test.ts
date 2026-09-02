import { describe, expect, it } from 'vitest';
import { parseAuthorIds, parseAuthorListProps } from './schema';

describe('author list schema', () => {
  it('keeps existing blocks in automatic mode', () => {
    expect(parseAuthorListProps({})).toMatchObject({ source: 'automatic', authorIds: '', limit: '6' });
  });

  it('deduplicates selected IDs without changing their order', () => {
    expect(parseAuthorIds('author-2, author-1,author-2')).toEqual(['author-2', 'author-1']);
  });

  it('caps defensive client parsing at the contract maximum', () => {
    const ids = Array.from({ length: 30 }, (_, index) => `author-${index}`);
    expect(parseAuthorIds(ids.join(','))).toEqual(ids.slice(0, 24));
  });
});
