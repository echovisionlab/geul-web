import { describe, expect, it } from 'vitest';
import { reorderWithIntent } from './reorder-with-intent';

const items = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
const getId = (item: { key: string }) => item.key;
const keys = (result: { items: { key: string }[] } | null) => result?.items.map(getId);

describe('reorderWithIntent', () => {
  it('moves an item to the front with only a following neighbour', () => {
    const result = reorderWithIntent(items, 'c', 'a', getId);

    expect(keys(result)).toEqual(['c', 'a', 'b']);
    expect(result?.intent).toEqual({ itemId: 'c', previousItemId: undefined, nextItemId: 'a' });
  });

  it('moves an item to the end with only a preceding neighbour', () => {
    const result = reorderWithIntent(items, 'a', 'c', getId);

    expect(keys(result)).toEqual(['b', 'c', 'a']);
    expect(result?.intent).toEqual({ itemId: 'a', previousItemId: 'c', nextItemId: undefined });
  });

  it('names both neighbours when an item lands in the middle', () => {
    const result = reorderWithIntent(items, 'a', 'b', getId);

    expect(keys(result)).toEqual(['b', 'a', 'c']);
    expect(result?.intent).toEqual({ itemId: 'a', previousItemId: 'b', nextItemId: 'c' });
  });

  it.each([
    ['dropped outside a target', 'b', null],
    ['dropped onto itself', 'b', 'b'],
    ['dropped onto an unknown item', 'b', 'missing'],
    ['dragging an unknown item', 'missing', 'a'],
  ])('leaves the order unchanged when %s', (_case, activeId, overId) => {
    expect(reorderWithIntent(items, activeId, overId, getId)).toBeNull();
  });

  it('does not mutate the original list', () => {
    reorderWithIntent(items, 'c', 'a', getId);

    expect(items.map(getId)).toEqual(['a', 'b', 'c']);
  });
});
