'use client';

import type { ComponentType } from 'react';

/**
 * Wraps a lazily loaded component in the application `QueryClientProvider`. The provider and
 * TanStack Query load with the component, not with the importer: routes that only reach React
 * Query behind `import()` (editors, map/form block runtimes, search) keep it out of their first
 * load. Every provider shares the browser's single `QueryClient`, so the cache is the same as
 * under a route-level provider.
 */
export async function withQueryClient<P extends object>(
  component: Promise<ComponentType<P>>,
): Promise<ComponentType<P>> {
  const [Component, { ReactQueryProvider }] = await Promise.all([component, import('./ReactQueryProvider')]);
  function WithQueryClient(props: P) {
    return (
      <ReactQueryProvider>
        <Component {...props} />
      </ReactQueryProvider>
    );
  }
  WithQueryClient.displayName = `WithQueryClient(${Component.displayName ?? Component.name ?? 'Component'})`;
  return WithQueryClient;
}
