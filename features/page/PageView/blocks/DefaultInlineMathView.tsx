'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';

export function DefaultInlineMathView({ latex }: { latex: string }) {
  let html = latex;
  try {
    html = katex.renderToString(latex, {
      displayMode: false,
      throwOnError: false,
    });
  } catch {
    // fallback to raw latex
  }

  return <span className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}
