// @vitest-environment jsdom

import { act, createContext, lazy, Suspense, useContext } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { renderSettledServerHtml, trackServerLoader } from './settled-server-render';

describe('settled server hydration fixtures', () => {
  it('resolves a real lazy tree and hydrates the same provider and DOM without renderer conflicts', async () => {
    const ValueContext = createContext('default');
    const pending: Promise<unknown>[] = [];
    function Content() {
      return <p>{useContext(ValueContext)}</p>;
    }
    const LazyContent = lazy(trackServerLoader(async () => ({ default: Content }), pending));
    const screen = (
      <ValueContext.Provider value="Published lazy content">
        <Suspense fallback={<span>Loading</span>}>
          <LazyContent />
        </Suspense>
      </ValueContext.Provider>
    );
    const consoleError = vi.spyOn(console, 'error');
    const onRecoverableError = vi.fn();
    const container = document.createElement('div');
    let root: Root | undefined;
    try {
      container.innerHTML = await renderSettledServerHtml(screen, pending);
      const serverParagraph = container.querySelector('p');
      expect(serverParagraph?.textContent).toBe('Published lazy content');
      expect(container.textContent).not.toContain('Loading');
      await act(async () => {
        root = hydrateRoot(container, screen, { onRecoverableError });
      });
      expect(container.querySelector('p')).toBe(serverParagraph);
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      consoleError.mockRestore();
    }
  });

  it('propagates failed imports and ordinary render failures', async () => {
    const pending: Promise<unknown>[] = [];
    const loading = trackServerLoader(() => Promise.reject(new Error('reader import failed')), pending);
    const rejectedImport = loading();
    const observedImport = expect(rejectedImport).rejects.toThrow('reader import failed');
    await expect(renderSettledServerHtml(<p>Content</p>, pending)).rejects.toThrow('reader import failed');
    await observedImport;
    function Broken(): never {
      throw new Error('reader render failed');
    }
    await expect(renderSettledServerHtml(<Broken />, [])).rejects.toThrow('reader render failed');
  });
});
