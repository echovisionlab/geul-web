/** Decorative density only: every heading remains in the scrolling outline. */
export function tocRailIndices(count: number): number[] {
  const markCount = Math.min(48, Math.max(0, count));
  return Array.from({ length: markCount }, (_, index) =>
    markCount < 2 ? 0 : Math.round((index / (markCount - 1)) * (count - 1)),
  );
}

/** Visual nesting stops at three levels so deep headings neither drift nor squeeze their titles. */
export const TOC_MAX_VISUAL_DEPTH = 2;

export interface TocOutlineNode {
  index: number;
  depth: number;
  children: TocOutlineNode[];
}

export interface TocOutline {
  roots: TocOutlineNode[];
  /** Tree depth per item (0 = outermost), independent of skipped heading levels. */
  depths: number[];
  /** Parent item index per item, or -1 for a root. */
  parents: number[];
}

/**
 * Builds the nested outline from authored heading levels in document order. A skipped level
 * (h2 → h4) nests one step, never two, and a shallower heading closes every deeper section.
 */
export function tocOutline(levels: readonly number[]): TocOutline {
  const roots: TocOutlineNode[] = [];
  const depths: number[] = [];
  const parents: number[] = [];
  const stack: { node: TocOutlineNode; level: number }[] = [];
  levels.forEach((level, index) => {
    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    const node: TocOutlineNode = { index, depth: stack.length, children: [] };
    (parent ? parent.node.children : roots).push(node);
    depths.push(stack.length);
    parents.push(parent ? parent.node.index : -1);
    stack.push({ node, level });
  });
  return { roots, depths, parents };
}

/** Item indices that contain `index` (nearest first), so the reader keeps the parent context. */
export function tocAncestors(parents: readonly number[], index: number): number[] {
  const ancestors: number[] = [];
  for (let parent = parents[index] ?? -1; parent >= 0; parent = parents[parent] ?? -1) {
    ancestors.push(parent);
  }
  return ancestors;
}

/** Maps a pointer position along the rail to the heading at the same proportional position. */
export function tocScrubIndex(position: number, start: number, length: number, count: number): number {
  if (count < 2 || length <= 0) {
    return 0;
  }
  const fraction = Math.min(1, Math.max(0, (position - start) / length));
  return Math.round(fraction * (count - 1));
}
