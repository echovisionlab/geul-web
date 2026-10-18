import { describe, expect, it } from 'vitest';
import { getEntityMarqueeHref, reorderByIds } from './resolve';

describe('entity marquee resolver', () => {
  it('derives static public hrefs server-side for client and label items', () => {
    expect(getEntityMarqueeHref('client', { id: 'client-1', website: 'https://client.example.com' }, 'entity')).toBe(
      'https://client.example.com',
    );
    expect(getEntityMarqueeHref('label', { id: 'label-1', slug: 'test-label' }, 'entity')).toBe('/labels/test-label');
    expect(getEntityMarqueeHref('label', { id: 'label-1' }, 'entity')).toBe('/labels/label-1');
  });

  it('disables item hrefs at marquee level', () => {
    expect(
      getEntityMarqueeHref('client', { id: 'client-1', website: 'https://client.example.com' }, 'none'),
    ).toBeUndefined();
  });

  it('preserves selected item ordering and drops stale ids', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    expect(reorderByIds(items, ['c', 'missing', 'a'])).toEqual([{ id: 'c' }, { id: 'a' }]);
  });
});
