type VideoJsRuntime = typeof import('./videojs-player');

let runtimePromise: Promise<VideoJsRuntime> | null = null;

/** Share concurrent loads; a failed chunk load can be retried on the next mount. */
export function loadVideoJsRuntime(): Promise<VideoJsRuntime> {
  if (!runtimePromise) {
    runtimePromise = import('./videojs-player').catch((error: unknown) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}
