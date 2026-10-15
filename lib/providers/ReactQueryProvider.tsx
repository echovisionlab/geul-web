'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { subscribeToProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(getQueryClient);
  // An open room's access changed (Notion refetches roles): client-read permissions and actions
  // follow at once.
  useEffect(
    () =>
      subscribeToProviderAccessLevel((_access, _provider, changed) => {
        if (changed) {
          void queryClient.invalidateQueries();
        }
      }),
    [queryClient],
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
