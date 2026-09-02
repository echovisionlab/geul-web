// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrintCodeSource } from './PrintCodeSource';

vi.mock('shiki/bundle/full', () => ({
  codeToHtml: vi.fn(
    async (source: string, options: { lang: string }) =>
      `<pre class="shiki"><code><span class="line" style="--shiki-light:#0550ae">${options.lang}:${source}</span></code></pre>`,
  ),
}));

const roots: { unmount: () => void }[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
});

describe('PrintCodeSource', () => {
  it('collapses Shiki separator newlines while preserving whitespace inside each code line', () => {
    const css = readFileSync(resolve(process.cwd(), 'features/editor/tiptap/code/PrintCodeSource.module.css'), 'utf8');

    expect(css).toMatch(/pre\.shiki\)[^{]*\{[^}]*white-space:\s*normal\s*!important/isu);
    expect(css).toMatch(/pre\.shiki \.line\)[^{]*\{[^}]*white-space:\s*pre-wrap/isu);
  });

  it('keeps a plain source fallback and replaces it with highlighted, line-addressable markup', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(<PrintCodeSource language="typescript" source="const answer = 42;" />);
    });

    expect(host.querySelector('[data-print-code-source]')?.getAttribute('data-highlight-status')).toBe('ready');
    expect(host.querySelector('.shiki .line')?.textContent).toBe('typescript:const answer = 42;');
  });
});
