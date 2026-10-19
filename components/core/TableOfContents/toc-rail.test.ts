import { describe, expect, it } from 'vitest';
import { tocAncestors, tocNearestMark, tocOutline, tocRailIndices, tocScrubIndex } from './toc-rail';

describe('decorative reading rail density', () => {
  it('keeps short outlines complete', () => {
    expect(tocRailIndices(5)).toEqual([0, 1, 2, 3, 4]);
    expect(tocRailIndices(0)).toEqual([]);
  });
  it.each([60, 120, 1000])('bounds marks and represents both ends of %i headings', (count) => {
    const indices = tocRailIndices(count);
    expect(indices).toHaveLength(48);
    expect(indices[0]).toBe(0);
    expect(indices.at(-1)).toBe(count - 1);
    expect(indices).toEqual([...new Set(indices)].sort((a, b) => a - b));
  });
});

describe('nested outline', () => {
  it('nests by document structure, one step for a skipped level, and closes deeper sections', () => {
    const outline = tocOutline([2, 4, 5, 3, 2, 6, 2]);
    expect(outline.depths).toEqual([0, 1, 2, 1, 0, 1, 0]);
    expect(outline.parents).toEqual([-1, 0, 1, 0, -1, 4, -1]);
    expect(outline.roots.map((node) => node.index)).toEqual([0, 4, 6]);
    expect(outline.roots[0].children.map((node) => node.index)).toEqual([1, 3]);
  });
  it('starts below the first heading level without inventing parents', () => {
    expect(tocOutline([3, 2, 3]).depths).toEqual([0, 0, 1]);
  });
  it('lists every containing section nearest first', () => {
    const { parents } = tocOutline([2, 3, 4, 5, 2]);
    expect(tocAncestors(parents, 3)).toEqual([2, 1, 0]);
    expect(tocAncestors(parents, 4)).toEqual([]);
  });
});

describe('rail scrubbing position', () => {
  it('maps the rail proportionally and clamps outside it', () => {
    expect(tocScrubIndex(100, 100, 400, 5)).toBe(0);
    expect(tocScrubIndex(300, 100, 400, 5)).toBe(2);
    expect(tocScrubIndex(900, 100, 400, 5)).toBe(4);
    expect(tocScrubIndex(-50, 100, 400, 5)).toBe(0);
    expect(tocScrubIndex(300, 100, 0, 5)).toBe(0);
    expect(tocScrubIndex(300, 100, 400, 1)).toBe(0);
  });
});

describe('tocNearestMark', () => {
  it('lights the sampled mark closest to a heading in a long outline', () => {
    const marks = tocRailIndices(100);
    expect(tocNearestMark(marks, 0)).toBe(0);
    expect(tocNearestMark(marks, 99)).toBe(marks.length - 1);
    expect(marks[tocNearestMark(marks, 50)]).toBeCloseTo(50, -1);
    expect(tocNearestMark([], 3)).toBe(-1);
  });
});
