import type { ComponentType } from 'react';
import type { MapLibreMapProps } from './MapLibreMap.types';

type PublicMapRuntime = ComponentType<MapLibreMapProps>;
type ImportPublicMapRuntime = () => Promise<PublicMapRuntime>;

let publicMapRuntimePromise: Promise<PublicMapRuntime> | undefined;

/** Shares one browser runtime import between the map preload and its dynamic renderer. */
export function loadPublicMapRuntime(importRuntime: ImportPublicMapRuntime): Promise<PublicMapRuntime> {
  if (!publicMapRuntimePromise) {
    publicMapRuntimePromise = importRuntime().catch((error: unknown) => {
      publicMapRuntimePromise = undefined;
      throw error;
    });
  }

  return publicMapRuntimePromise;
}

/** Starts a map runtime import without turning a speculative preload failure into an unhandled rejection. */
export function preloadPublicMapRuntime(importRuntime: ImportPublicMapRuntime): Promise<void> {
  return loadPublicMapRuntime(importRuntime).then(
    () => undefined,
    () => undefined,
  );
}
