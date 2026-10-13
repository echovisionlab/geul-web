import type { ComponentType } from 'react';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { PostSpotlightRuntimeProps } from './PostSpotlightRuntime';

let pending: Promise<ComponentType<PostSpotlightRuntimeProps>> | undefined;

/** Share concurrent gestures while allowing a failed chunk request to be retried. */
export function loadPostSpotlightRuntime() {
  // Search uses React Query; the provider loads with the runtime, not with the page.
  pending ??= withQueryClient(
    import('./PostSpotlightRuntime').then(({ PostSpotlightRuntime }) => PostSpotlightRuntime),
  ).catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
