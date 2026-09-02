import { describe, expect, it } from 'vitest';
import { createShellLayoutMatrix, SHELL_LAYOUT_CONTENT_SHAPES, toDocumentLayoutViewModel } from './shell-layout-matrix';

const matrix = createShellLayoutMatrix();

describe('public shell layout matrix', () => {
  it('covers every independent content shape, height, chrome, and footer combination exactly once', () => {
    expect(matrix).toHaveLength(6 * 2 * 2 * 2);
    expect(new Set(matrix.map(({ id }) => id))).toHaveLength(matrix.length);

    for (const contentShape of SHELL_LAYOUT_CONTENT_SHAPES) {
      expect(matrix.filter(({ input }) => input.contentShape === contentShape)).toHaveLength(8);
    }
    for (const contentHeight of ['content', 'viewport'] as const) {
      expect(matrix.filter(({ input }) => input.contentHeight === contentHeight)).toHaveLength(24);
    }
    for (const pageChrome of ['flow', 'pinned'] as const) {
      expect(matrix.filter(({ input }) => input.pageChrome === pageChrome)).toHaveLength(24);
    }
    for (const footer of ['flow', 'pinned'] as const) {
      expect(matrix.filter(({ input }) => input.footer === footer)).toHaveLength(24);
    }
  });

  it.each(matrix)(
    '$id preserves independent layout props and the document-scroll contract',
    ({ input, expectation }) => {
      expect(toDocumentLayoutViewModel(input)).toEqual({
        contentHeight: input.contentHeight,
        pageChrome: input.pageChrome,
        footer: input.footer,
      });
      expect(expectation.footerPinned).toBe(input.footer === 'pinned');
      expect(expectation.nestedScrollOwner).toBe(false);

      if (input.footer === 'pinned') {
        expect(expectation.documentScrolls).toBe(
          ['single-scroll-scene', 'scroll-scene-with-blocks', 'long-no-scene'].includes(input.contentShape),
        );
      }

      if (input.contentHeight === 'viewport' && input.footer === 'flow') {
        expect(expectation.documentScrolls).toBe(true);
      }

      if (input.contentHeight === 'content' && input.footer === 'flow') {
        expect(expectation.documentScrolls).toBe(input.contentShape !== 'short-no-scene');
      }

      if (expectation.hasScene) {
        expect(['scene', 'after']).toContain(expectation.lastSectionId);
      } else {
        expect(['short', 'after']).toContain(expectation.lastSectionId);
      }
    },
  );
});
