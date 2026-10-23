'use client';

import { useCallback, useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { getClient } from '@/lib/queries/client-browser';

export interface WorkClientDetails {
  id: string;
  name: string;
  logoUrl: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  website: string | null;
}

export function workClientDetailQueryKey(clientId: string) {
  return ['client', 'detail', clientId] as const;
}

/**
 * Details for a Work's selected clients, read once per client. A client that no longer exists
 * stays without details instead of being requested again.
 */
export function useWorkClientDetails(
  clientIds: readonly string[],
  initialClientDetails: readonly WorkClientDetails[],
  readClient: (clientId: string) => Promise<WorkClientDetails | null> = getClient,
) {
  const queryClient = useQueryClient();
  const initialById = useMemo(
    () => new Map(initialClientDetails.map((client) => [client.id, client])),
    [initialClientDetails],
  );
  const queries = useQueries({
    queries: clientIds.map((clientId) => ({
      queryKey: workClientDetailQueryKey(clientId),
      queryFn: async (): Promise<WorkClientDetails | null> => {
        const client = await readClient(clientId);
        return client
          ? {
              id: client.id,
              name: client.name,
              logoUrl: client.logoUrl,
              logoLightUrl: client.logoLightUrl,
              logoDarkUrl: client.logoDarkUrl,
              website: client.website,
            }
          : null;
      },
      initialData: initialById.get(clientId),
      staleTime: Infinity,
    })),
  });
  const clients = clientIds.map((clientId, index) => ({
    clientId,
    details: queries[index]?.data ?? null,
    isLoading: queries[index]?.isLoading ?? false,
  }));
  /** A client picked from search results already has its details. */
  const rememberClient = useCallback(
    (client: WorkClientDetails) => queryClient.setQueryData(workClientDetailQueryKey(client.id), client),
    [queryClient],
  );
  return { clients, rememberClient };
}
