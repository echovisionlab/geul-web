export const MAPLIBRE_WORKER_URL = '/providers/maplibre/maplibre-gl-worker.mjs';

export function configureMapLibreWorker(setWorkerUrl: (url: string) => void): void {
  setWorkerUrl(MAPLIBRE_WORKER_URL);
}
