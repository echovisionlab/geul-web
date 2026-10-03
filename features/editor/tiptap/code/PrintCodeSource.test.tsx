// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrintCodeSource } from './PrintCodeSource';
import { codeToHtml } from './print-code-highlighter';

vi.mock('./print-code-highlighter', () => ({
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
  vi.mocked(codeToHtml).mockClear();
});

function renderSource(language: string, source: string) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  act(() => root.render(<PrintCodeSource language={language} source={source} />));
  return { host, root };
}

describe('PrintCodeSource', () => {
  it('keeps printable escaped raw source immediately while highlighting is pending', async () => {
    let finish!: (html: string) => void;
    vi.mocked(codeToHtml).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { host } = renderSource('ts', '<script>  source\n  next line');
    expect(host.querySelector('pre code')?.textContent).toBe('<script>  source\n  next line');
    expect(host.querySelector('script')).toBeNull();
    window.dispatchEvent(new Event('beforeprint'));
    expect(host.querySelector('pre code')?.textContent).toBe('<script>  source\n  next line');
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => finish('<pre class="shiki"><code>highlighted</code></pre>'));
    expect(host.querySelector('.shiki')).not.toBeNull();
  });

  it('retains plain source if the language is unknown or highlighting fails', async () => {
    vi.mocked(codeToHtml).mockRejectedValueOnce(new Error('Unknown language'));
    const { host } = renderSource('unknown-language', 'raw source');
    await act(async () => {
      await Promise.resolve();
    });
    expect(host.querySelector('[data-highlight-status]')?.getAttribute('data-highlight-status')).toBe('fallback');
    expect(host.querySelector('pre code')?.textContent).toBe('raw source');
  });

  it('ignores obsolete highlighting after source changes and after unmount', async () => {
    let finishOld!: (html: string) => void;
    vi.mocked(codeToHtml).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    const { host, root } = renderSource('ts', 'old source');
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => root.render(<PrintCodeSource language="js" source="new source" />));
    await act(async () => finishOld('<pre class="shiki">old highlighted</pre>'));
    expect(host.textContent).toBe('js:new source');

    let reject!: (error: Error) => void;
    vi.mocked(codeToHtml).mockImplementationOnce(
      () =>
        new Promise((_resolve, rejectPromise) => {
          reject = rejectPromise;
        }),
    );
    await act(async () => root.render(<PrintCodeSource language="js" source="unmounted source" />));
    act(() => root.unmount());
    await act(async () => reject(new Error('late failure')));
    expect(host.childNodes).toHaveLength(0);
  });

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
