import type { ComponentType } from 'react';
import type { PostSpotlightRuntimeProps } from './PostSpotlightRuntime';

let pending: Promise<ComponentType<PostSpotlightRuntimeProps>> | undefined;

/** Share concurrent gestures while allowing a failed chunk request to be retried. */
export function loadPostSpotlightRuntime() {
  pending ??= import('./PostSpotlightRuntime')
    .then(({ PostSpotlightRuntime }) => PostSpotlightRuntime)
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
