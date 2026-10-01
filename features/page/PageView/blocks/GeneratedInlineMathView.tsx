'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';

export function GeneratedInlineMathView({ source }: { source: string }) {
  const html = katex.renderToString(source, { displayMode: false, throwOnError: false });
  return <span className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}
