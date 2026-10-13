import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { RenderedMath } from './math-render';

export type { RenderedMath };

type RenderMath = (latex: string, displayMode: boolean) => RenderedMath;

let renderer: RenderMath | null = null;
let pending: Promise<RenderMath> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getRenderer(): RenderMath | null {
  return renderer;
}

/** Loads KaTeX and its stylesheet (about 74 kB gzip) once, when a math node first renders. */
export function loadMathRenderer(): Promise<RenderMath> {
  pending ??= import('./math-render').then(
    (module) => {
      renderer = module.renderMath;
      for (const listener of listeners) {
        listener();
      }
      return renderer;
    },
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
}

/**
 * Renders math once KaTeX has loaded. Returns `null` while it loads, and when `enabled` is false.
 * A failed chunk load leaves the source visible; the next math render retries.
 */
export function useRenderedMath(latex: string, displayMode: boolean, enabled = true): RenderedMath | null {
  const render = useSyncExternalStore(subscribe, getRenderer, getRenderer);
  useEffect(() => {
    if (enabled && !render) {
      loadMathRenderer().catch(() => undefined);
    }
  }, [enabled, render]);
  return useMemo(() => (enabled && render ? render(latex, displayMode) : null), [displayMode, enabled, latex, render]);
}
