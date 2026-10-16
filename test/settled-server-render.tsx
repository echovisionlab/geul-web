import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';

/** Observe the real lazy loader without preloading unrelated reader modules. */
export function trackServerLoader<T>(loader: () => Promise<T>, pending: Promise<unknown>[]): () => Promise<T> {
  return () => {
    const loading = loader();
    pending.push(loading);
    return loading;
  };
}

/**
 * Hydration fixtures use the legacy server renderer's secondary context slot;
 * React's streaming server and DOM renderers both own the primary slot. Retry
 * only when a real lazy loader was requested, retaining its resolved component
 * tree rather than hydrating a suspended fallback. Streaming itself is covered
 * by the separate Node SSR contracts.
 */
export async function renderSettledServerHtml(content: ReactNode, pending: Promise<unknown>[]): Promise<string> {
  for (;;) {
    let html: string | undefined;
    let failure: unknown;
    try {
      html = renderToString(content);
    } catch (error) {
      failure = error;
    }
    const loading = pending.splice(0);
    if (loading.length === 0) {
      if (failure !== undefined) {
        throw failure;
      }
      return html!;
    }
    await Promise.all(loading);
  }
}
