import katex from 'katex';

export interface RenderedMath {
  html: string;
  error: string | null;
}

/**
 * KaTeX's tolerant renderer is intentionally used for the preview: an author
 * must always be able to see and edit the exact source they entered.  The
 * strict pass only supplies the visible authoring error.
 */
export function renderMath(latex: string, displayMode: boolean): RenderedMath {
  try {
    katex.renderToString(latex, { displayMode, throwOnError: true, strict: 'ignore' });
    return {
      html: katex.renderToString(latex, { displayMode, throwOnError: false, strict: 'ignore' }),
      error: null,
    };
  } catch (error) {
    return {
      html: katex.renderToString(latex, { displayMode, throwOnError: false, strict: 'ignore' }),
      error: error instanceof Error ? error.message : 'Invalid LaTeX',
    };
  }
}
