import { expect, waitFor } from 'storybook/test';

/**
 * The page outline of a public document: exactly one `h1` and no skipped levels (each heading at most one
 * level below the previous). With a visible title the authored body sits one element below it; the
 * authored level stays on `data-heading-level`.
 */
export async function assertDocumentOutline({ canvasElement }: { canvasElement: HTMLElement }) {
  await waitFor(() => expect(canvasElement.querySelector('.prose [data-heading-level]')).not.toBeNull());
  const levels = [...canvasElement.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"][aria-level]')].map(
    (heading) => Number(heading.getAttribute('aria-level') ?? heading.tagName.slice(1)),
  );
  expect(levels.filter((level) => level === 1)).toHaveLength(1);
  expect(levels[0]).toBe(1);
  const skips = levels.flatMap((level, index) => (index > 0 && level > levels[index - 1] + 1 ? [index] : []));
  expect(skips).toEqual([]);
  assertOutlineClearance(canvasElement);
  assertReadingStartEdge(canvasElement);
  const frame = canvasElement.querySelector<HTMLElement>('[data-content-layout]');
  const controls = canvasElement.querySelector<HTMLElement>('[data-content-controls]');
  if (frame && controls) {
    const rtl = getComputedStyle(frame).direction === 'rtl';
    const a = frame.getBoundingClientRect();
    const b = controls.getBoundingClientRect();
    expect(Math.abs(rtl ? a.left - b.left : a.right - b.right)).toBeLessThanOrEqual(1);
  }
}

/** Running text starts where its title starts: the reading column sits on the document's start edge. */
function assertReadingStartEdge(canvasElement: HTMLElement) {
  const block = canvasElement.querySelector<HTMLElement>('.prose[data-reading-measure] > [data-document-block]');
  const title = canvasElement.querySelector<HTMLElement>('h1');
  if (!block || !title) {
    return;
  }
  const rtl = getComputedStyle(block).direction === 'rtl';
  const body = block.getBoundingClientRect();
  const heading = title.getBoundingClientRect();
  expect(Math.abs(rtl ? body.right - heading.right : body.left - heading.left)).toBeLessThanOrEqual(1);
}

/**
 * The reading column, its breakouts and the reading chrome never reach the outline beside them (the
 * persistent column from `lg`, the rail below): Core reserves the outline's inline space and the
 * `reading` measure is bounded by the document box that ends at the reserve.
 */
export function assertOutlineClearance(canvasElement: HTMLElement) {
  const navigation = canvasElement.querySelector<HTMLElement>('[data-presentation]');
  if (!navigation) {
    return;
  }
  const outline = navigation.getBoundingClientRect();
  const rtl = getComputedStyle(navigation).direction === 'rtl';
  const blocks = canvasElement.querySelectorAll<HTMLElement>(
    '.prose[data-reading-measure] > [data-document-block], [data-geul-layout-size="reading"]',
  );
  for (const block of blocks) {
    const box = block.getBoundingClientRect();
    if (!box.width) {
      continue;
    }
    expect(rtl ? box.left - outline.right : outline.left - box.right).toBeGreaterThanOrEqual(-0.5);
  }
}
