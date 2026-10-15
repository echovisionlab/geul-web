import { describe, expect, it } from 'vitest';
import { moveColumnSection } from './move-column-section';
import type { ColumnData } from '../types';

const columns: ColumnData[] = [
  {
    id: 'left',
    sections: [
      { id: 'a', type: 'rich-text' },
      { id: 'b', type: 'rich-text' },
      { id: 'c', type: 'embed' },
    ],
  },
  { id: 'right', sections: [{ id: 'd', type: 'rich-text' }] },
  { id: 'empty', sections: [] },
];
describe('column block movement', () => {
  it('reorders children in both directions without changing the source', () => {
    expect(moveColumnSection(columns, 'a', 'c')?.[0]?.sections.map((section) => section.id)).toEqual(['b', 'c', 'a']);
    expect(moveColumnSection(columns, 'c', 'a')?.[0]?.sections.map((section) => section.id)).toEqual(['c', 'a', 'b']);
    expect(columns[0]?.sections.map((section) => section.id)).toEqual(['a', 'b', 'c']);
  });
  it('moves a child to another column while preserving its data', () => {
    const moved = moveColumnSection(columns, 'c', 'd');
    expect(moved?.[0]?.sections.map((section) => section.id)).toEqual(['a', 'b']);
    expect(moved?.[1]?.sections).toEqual([columns[0]?.sections[2], columns[1]?.sections[0]]);
  });
  it('accepts an empty column as a destination', () => {
    expect(moveColumnSection(columns, 'a', 'empty')?.[2]?.sections).toEqual([columns[0]?.sections[0]]);
  });
  it('ignores stale targets and unchanged drops', () => {
    expect(moveColumnSection(columns, 'a', 'a')).toBeNull();
    expect(moveColumnSection(columns, 'missing', 'd')).toBeNull();
    expect(moveColumnSection(columns, 'a', 'missing')).toBeNull();
  });
});
